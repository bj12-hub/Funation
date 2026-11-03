"use server";

import { requestFrom } from "@/lib/flextv/auth";
import { checkChannelName, fetchLinks, saveLinks, updateChannel } from "@/lib/flextv/channelSettings";
import { isRecord } from "@/lib/flextv/client";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { CHANNEL_BANNER_MAX_BYTES, CHANNEL_BANNER_TYPES, CHANNEL_DESCRIPTION_MAX, CHANNEL_NAME_MAX, CHANNEL_NAME_MIN, LINK_PLATFORMS } from "@/lib/flextv/rules";
import { fetchMyChannelData } from "@/lib/flextv/studio";
import { matchesContent } from "@/services/creator/assetCore";
import { studioContext } from "./flextvStudio";
import { LINK_MAX, type ChannelNameCheck, type ChannelSettingResult, type FlextvChannelSettingsView } from "./flextvChannelSettingsTypes";

/**
 * 채널 설정 with FLEXTV (phase 7, docs/development/flextv-backend.md "7단계"): the streamer's FLEXTV 방송국 — its name,
 * 소개, banner and links. Route `/creator/settings`. Each change is checked here with FLEXTV's own form rules first
 * (lib/flextv/rules.ts); FLEXTV filters forbidden words in the name and the 소개 itself. The channel's picture is the
 * streamer's FLEXTV profile picture (마이페이지).
 */

const serialize = createQueue("channelSettings");
const httpsUrl = (value: unknown) => (typeof value === "string" && /^https:\/\//.test(value) ? value : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");

export async function getFlextvChannelSettings(): Promise<FlextvChannelSettingsView | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  const [data, links] = await Promise.all([fetchMyChannelData(ctx.token), fetchLinks(ctx.token)]);
  if (!isRecord(data) || !links) return null;
  const owner = isRecord(data.owner) ? data.owner : {};
  return {
    channelId: String(data.id ?? ""),
    name: text(data.name),
    description: text(data.description),
    bannerUrl: httpsUrl(data.backgroundImgUrl),
    avatarUrl: httpsUrl(owner.thumbUrl) ?? ctx.session.avatarUrl,
    links: links.platforms
  };
}

const nameError = (name: unknown) =>
  typeof name !== "string" || name.trim().length < CHANNEL_NAME_MIN || name.trim().length > CHANNEL_NAME_MAX ? `방송국 이름은 ${CHANNEL_NAME_MIN}~${CHANNEL_NAME_MAX}자로 입력해 주세요.` : null;

export async function checkFlextvChannelName(name: unknown): Promise<ChannelNameCheck> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const error = nameError(name);
  if (error) return { status: "INVALID", message: error };
  const answer = await checkChannelName(ctx.token, (name as string).trim());
  return answer === "AVAILABLE" ? { status: "AVAILABLE" } : answer === "TAKEN" ? { status: "TAKEN" } : { status: "UNAUTHORIZED" };
}

/** The name is asked again right before the change (FLEXTV's form checks it before saving, too). */
export async function saveFlextvChannelName(name: unknown): Promise<ChannelSettingResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const error = nameError(name);
  if (error) return { status: "INVALID", message: error };
  const value = (name as string).trim();
  const caller = requestFrom(await requestDeviceContext());
  return serialize(ctx.token, async () => {
    const free = await checkChannelName(ctx.token, value);
    if (free !== "AVAILABLE") return free === "TAKEN" ? { status: "TAKEN" } : { status: "UNAUTHORIZED" };
    return { status: (await updateChannel(ctx.token, { name: value }, caller)) === "OK" ? "SAVED" : "UNAUTHORIZED" };
  });
}

/** FLEXTV cannot empty the 소개 (its change needs a value). */
export async function saveFlextvChannelDescription(description: unknown): Promise<ChannelSettingResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const value = typeof description === "string" ? description.trim() : "";
  if (!value || value.length > CHANNEL_DESCRIPTION_MAX) return { status: "INVALID", message: `소개를 1~${CHANNEL_DESCRIPTION_MAX}자로 입력해 주세요.` };
  const caller = requestFrom(await requestDeviceContext());
  const change = await serialize(ctx.token, () => updateChannel(ctx.token, { description: value }, caller));
  return { status: change === "OK" ? "SAVED" : "UNAUTHORIZED" };
}

export async function uploadFlextvChannelBanner(formData: FormData): Promise<ChannelSettingResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const file = formData.get("banner");
  const types: readonly string[] = CHANNEL_BANNER_TYPES;
  if (!(file instanceof File) || !types.includes(file.type)) return { status: "INVALID", message: "JPG, PNG 이미지만 올릴 수 있어요." };
  if (file.size > CHANNEL_BANNER_MAX_BYTES) return { status: "INVALID", message: "20MB 미만의 이미지만 올릴 수 있어요." };
  // The bytes must really be that image type (a renamed file is refused).
  if (!matchesContent(Buffer.from(await file.arrayBuffer()), file.type)) return { status: "INVALID", message: "JPG, PNG 이미지만 올릴 수 있어요." };
  const caller = requestFrom(await requestDeviceContext());
  const change = await serialize(ctx.token, () => updateChannel(ctx.token, { banner: file, filename: file.name || "banner" }, caller));
  return { status: change === "OK" ? "SAVED" : "UNAUTHORIZED" };
}

/** The platform links; FLEXTV's five free links are read and sent back unchanged. */
export async function saveFlextvChannelLinks(input: unknown): Promise<ChannelSettingResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const raw = isRecord(input) ? input : {};
  const platforms = {} as Record<(typeof LINK_PLATFORMS)[number], string>;
  for (const key of LINK_PLATFORMS) {
    const value = typeof raw[key] === "string" ? raw[key].trim() : "";
    if (value && (value.length > LINK_MAX || !/^https?:\/\/[^\s]+$/i.test(value))) return { status: "INVALID", message: "링크는 http:// 또는 https://로 시작하는 주소로 입력해 주세요." };
    platforms[key] = value;
  }
  const caller = requestFrom(await requestDeviceContext());
  return serialize(ctx.token, async () => {
    const current = await fetchLinks(ctx.token);
    if (!current) return { status: "UNAUTHORIZED" };
    return { status: (await saveLinks(ctx.token, { platforms, extra: current.extra }, caller)) === "OK" ? "SAVED" : "UNAUTHORIZED" };
  });
}
