"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession, hasRole } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS, mockSessionState } from "@/services/account/mockStore";
import { isValidChannelName } from "@/services/creator/creatorSettingsTypes";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { CHANNEL_HANDLE_RULE_MESSAGE, CHANNEL_INTRO_MAX, type ChannelCreateResult, type SlugCheck } from "./channelTypes";
import { handleStatus, movedHandle, startHandle } from "./handleCore";

/**
 * 채널 만들기 — code-first (no Figma frame). Route `/channel/new`. A signed-in member without the
 * Creator role creates a channel and receives the role. TBD: review/approval, identity or platform
 * verification before receiving donations, how many channels per member. The address rule and reserved list are
 * shared with 후원 페이지 링크 설정 (services/channel/handleCore.ts).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Channel API is not connected yet.");
};

/** A new channel: the studio channel's current and held old addresses are taken like any other channel's. */
function slugCheck(slug: unknown): SlugCheck["status"] {
  const status = handleStatus(slug, false);
  return status === "SAME" ? "TAKEN" : status;
}

export async function checkChannelSlug(slug: unknown): Promise<SlugCheck> {
  assertMock();
  if (!(await getSession())) return { status: "INVALID" };
  await mockDelay(200);
  return { status: slugCheck(slug) };
}

export async function createChannel(input: unknown): Promise<ChannelCreateResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  if (hasRole(session, "CREATOR")) return { status: "ALREADY_CREATOR" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

  const slug = typeof v.slug === "string" ? v.slug.trim().toLowerCase() : "";
  const slugStatus = slugCheck(slug);
  if (slugStatus === "INVALID") return { status: "INVALID", field: "slug", message: CHANNEL_HANDLE_RULE_MESSAGE };
  if (slugStatus === "TAKEN") return { status: "SLUG_TAKEN" };

  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!isValidChannelName(name)) return { status: "INVALID", field: "name", message: "채널 이름은 2~20자의 한글, 영문, 숫자, 공백, _로 입력해 주세요." };
  if (MOCK_FORBIDDEN_WORDS.some((w) => name.toLowerCase().includes(w) || slug.includes(w))) return { status: "INVALID", field: "name", message: "사용할 수 없는 단어가 포함되어 있어요." };

  const intro = typeof v.intro === "string" ? v.intro.trim() : "";
  if (intro.length > CHANNEL_INTRO_MAX) return { status: "INVALID", field: "intro", message: `소개는 ${CHANNEL_INTRO_MAX}자 이내로 입력해 주세요.` };
  if (v.agreed !== true) return { status: "INVALID", field: "agreed", message: "크리에이터 이용약관에 동의해 주세요." };

  await mockDelay(500);
  // Checked again after the last await, in the same tick as the write: the address may have been taken meanwhile.
  if (slugCheck(slug) !== "AVAILABLE") return { status: "SLUG_TAKEN" };
  // Mock: the member's channel becomes the studio channel and the role is granted at once.
  // TODO: the backend creates the channel, records the terms consent (version + time) and grants the
  // role — possibly only after review (TBD).
  mockCreator.channelName = name;
  startHandle(slug);
  mockSessionState.roles = [...new Set([...(mockSessionState.roles ?? session.roles), "CREATOR" as const])];
  return { status: "CREATED", slug };
}

/**
 * 예전 채널 주소 (2026-10-08 결정): the current address an old one points to while it is held (30 days), or null.
 * Public — the channel page redirects with it.
 */
export async function getMovedChannelHandle(handle: unknown): Promise<string | null> {
  assertMock();
  return typeof handle === "string" ? movedHandle(handle) : null;
}
