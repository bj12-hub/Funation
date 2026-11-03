"use server";

import { requestFrom } from "@/lib/flextv/auth";
import {
  addBanWord,
  addChannelMember,
  fetchBanWords,
  fetchChannelMembers,
  fetchYoutubeLink,
  readChatTexts,
  removeBanWord,
  removeChannelMember,
  removeYoutubeLink,
  saveChatText,
  saveYoutubeLink,
  showYoutubeChat,
  type MemberList,
  type YoutubeLinkChange
} from "@/lib/flextv/chatSettings";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { BAN_WORD_MAX, CHAT_NOTICE_MAX } from "@/lib/flextv/rules";
import { myChannel, studioContext } from "./flextvStudio";
import type { ChatSettingResult, FlextvChatSettingsView } from "./flextvChatSettingsTypes";

/**
 * 채팅 관리 with FLEXTV (phase 9, docs/development/flextv-backend.md "9단계"): the chat pop-up 공지 and 규칙, the
 * channel's 금지어, 매니저 and 블랙리스트, and the YouTube live chat FLEXTV shows in the channel's chat. Route
 * `/creator/chat`. Members are named by their FLEXTV 아이디 here; their FLEXTV member numbers stay on the server.
 */

const serialize = createQueue("chatSettings");
const LOGIN_ID = /^[A-Za-z0-9_-]{1,40}$/;
const YOUTUBE_INPUT_MAX = 300;
const LIST_LABEL: Record<MemberList, string> = { managers: "매니저", blacklist: "블랙리스트" };

/** The studio's member and their channel; null when signed out or without a FLEXTV channel. */
async function context() {
  const ctx = await studioContext();
  if (!ctx) return null;
  const mine = await myChannel(ctx.token);
  return mine ? { ...ctx, channelId: mine.channel.channelId, data: mine.data } : null;
}

export async function getFlextvChatSettings(): Promise<FlextvChatSettingsView | null> {
  const ctx = await context();
  if (!ctx) return null;
  const [banWords, managers, blacklist, youtube] = await Promise.all([
    fetchBanWords(ctx.token, ctx.channelId),
    fetchChannelMembers(ctx.token, ctx.channelId, "managers"),
    fetchChannelMembers(ctx.token, ctx.channelId, "blacklist"),
    fetchYoutubeLink(ctx.token)
  ]);
  if (!banWords || !managers || !blacklist || youtube === "UNAUTHORIZED") return null;
  const member = ({ loginId, nickname, since }: { loginId: string; nickname: string; since: string }) => ({ loginId, nickname, since });
  return { ...readChatTexts(ctx.data), banWords, managers: managers.map(member), blacklist: blacklist.map(member), youtube };
}

/** An empty text takes the 공지 or the 규칙 away. */
export async function saveFlextvChatText(which: unknown, message: unknown): Promise<ChatSettingResult> {
  if (which !== "notice" && which !== "rule") return { status: "INVALID", message: "바꿀 항목을 다시 골라 주세요." };
  const value = typeof message === "string" ? message.trim() : "";
  if (value.length > CHAT_NOTICE_MAX) return { status: "INVALID", message: `${CHAT_NOTICE_MAX}자까지 쓸 수 있어요.` };
  const ctx = await context();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const caller = requestFrom(await requestDeviceContext());
  const change = await serialize(ctx.token, () => saveChatText(ctx.token, ctx.channelId, which, value, caller));
  return change === "OK" ? { status: "SAVED" } : { status: "UNAUTHORIZED" };
}

export async function addFlextvBanWord(word: unknown): Promise<ChatSettingResult> {
  const value = typeof word === "string" ? word.trim() : "";
  if (!value || value.length > BAN_WORD_MAX) return { status: "INVALID", message: `금지어를 1~${BAN_WORD_MAX}자로 입력해 주세요.` };
  const ctx = await context();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const caller = requestFrom(await requestDeviceContext());
  return serialize(ctx.token, async (): Promise<ChatSettingResult> => {
    const words = await fetchBanWords(ctx.token, ctx.channelId);
    if (!words) return { status: "UNAUTHORIZED" };
    if (words.some((w) => w.word === value)) return { status: "INVALID", message: "이미 등록된 금지어예요." };
    return (await addBanWord(ctx.token, ctx.channelId, value, caller)) === "OK" ? { status: "SAVED" } : { status: "UNAUTHORIZED" };
  });
}

export async function removeFlextvBanWord(id: unknown): Promise<ChatSettingResult> {
  if (typeof id !== "string" || !/^[1-9]\d{0,15}$/.test(id)) return { status: "INVALID", message: "지울 금지어를 다시 골라 주세요." };
  const ctx = await context();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const caller = requestFrom(await requestDeviceContext());
  const change = await serialize(ctx.token, () => removeBanWord(ctx.token, ctx.channelId, id, caller));
  return change === "OK" ? { status: "SAVED" } : { status: "UNAUTHORIZED" };
}

const memberList = (list: unknown): MemberList | null => (list === "managers" || list === "blacklist" ? list : null);

export async function addFlextvChatMember(list: unknown, loginId: unknown): Promise<ChatSettingResult> {
  const which = memberList(list);
  const value = typeof loginId === "string" ? loginId.trim() : "";
  if (!which || !LOGIN_ID.test(value)) return { status: "INVALID", message: "FLEXTV 아이디를 입력해 주세요." };
  const ctx = await context();
  if (!ctx) return { status: "UNAUTHORIZED" };
  if (value.toLowerCase() === ctx.session.ssumnationId.toLowerCase()) return { status: "INVALID", message: "나 자신은 등록할 수 없어요." };
  const caller = requestFrom(await requestDeviceContext());
  const change = await serialize(ctx.token, () => addChannelMember(ctx.token, ctx.channelId, which, value, caller));
  switch (change) {
    case "OK":
      return { status: "SAVED" };
    case "NO_MEMBER":
      return { status: "INVALID", message: "그 아이디의 FLEXTV 회원을 찾지 못했어요." };
    case "SELF":
      return { status: "INVALID", message: "나 자신은 등록할 수 없어요." };
    case "ALREADY":
      return { status: "INVALID", message: `이미 ${LIST_LABEL[which]}에 있어요.` };
    case "REFUSED":
      return { status: "INVALID", message: `이 회원은 ${LIST_LABEL[which]}에 넣을 수 없어요.` };
    default:
      return { status: "UNAUTHORIZED" };
  }
}

/** By 아이디: FLEXTV removes by member number, read from the list here. Someone no longer on it counts as removed. */
export async function removeFlextvChatMember(list: unknown, loginId: unknown): Promise<ChatSettingResult> {
  const which = memberList(list);
  if (!which || typeof loginId !== "string" || !LOGIN_ID.test(loginId)) return { status: "INVALID", message: "뺄 회원을 다시 골라 주세요." };
  const ctx = await context();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const caller = requestFrom(await requestDeviceContext());
  return serialize(ctx.token, async (): Promise<ChatSettingResult> => {
    const members = await fetchChannelMembers(ctx.token, ctx.channelId, which);
    if (!members) return { status: "UNAUTHORIZED" };
    const target = members.find((m) => m.loginId === loginId);
    if (!target) return { status: "SAVED" };
    const change = await removeChannelMember(ctx.token, ctx.channelId, which, target.memberId, caller);
    return change === "UNAUTHORIZED" ? { status: "UNAUTHORIZED" } : change === "OK" ? { status: "SAVED" } : { status: "INVALID", message: "빼지 못했어요. 잠시 후 다시 시도해 주세요." };
  });
}

const linkResult = (change: YoutubeLinkChange): ChatSettingResult =>
  change.kind === "OK" ? { status: "SAVED" } : change.kind === "INVALID" ? { status: "INVALID", message: change.message } : { status: "UNAUTHORIZED" };

/** A YouTube channel address, @handle or channel id, or a live video's address — as FLEXTV reads it. */
export async function saveFlextvYoutubeLink(url: unknown): Promise<ChatSettingResult> {
  const value = typeof url === "string" ? url.trim() : "";
  if (!value || value.length > YOUTUBE_INPUT_MAX) return { status: "INVALID", message: "유튜브 채널 주소를 입력해 주세요." };
  const ctx = await context();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const caller = requestFrom(await requestDeviceContext());
  return linkResult(await serialize(ctx.token, () => saveYoutubeLink(ctx.token, value, caller)));
}

export async function removeFlextvYoutubeLink(): Promise<ChatSettingResult> {
  const ctx = await context();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const caller = requestFrom(await requestDeviceContext());
  return linkResult(await serialize(ctx.token, () => removeYoutubeLink(ctx.token, caller)));
}

export async function showFlextvYoutubeChat(show: unknown): Promise<ChatSettingResult> {
  if (typeof show !== "boolean") return { status: "INVALID", message: "다시 시도해 주세요." };
  const ctx = await context();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const caller = requestFrom(await requestDeviceContext());
  return linkResult(await serialize(ctx.token, () => showYoutubeChat(ctx.token, show, caller)));
}
