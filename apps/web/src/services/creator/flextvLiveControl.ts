"use server";

import { requestFrom } from "@/lib/flextv/auth";
import { addChannelMember } from "@/lib/flextv/chatSettings";
import { embedPlayerUrl } from "@/lib/flextv/live";
import { fetchStreamState, fetchViewers, fetchViewerTotal, kickViewer, muteViewer, toggleFreeze, type ControlOutcome } from "@/lib/flextv/liveControl";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { getFlextvRoomLive } from "@/services/live/flextvRoomLive";
import type { LiveControlAction, LiveControlResult, LiveControlView } from "./flextvLiveControlTypes";
import { myChannel, studioContext } from "./flextvStudio";

/**
 * 방송 설정's 지금 방송 panel with FLEXTV (phase 10, docs/development/flextv-backend.md "10단계", after funnation's
 * 방송하기 and FLEXTV's own chat window): the stream's figures and top donors, who is in the room, and FLEXTV's 채팅 금지
 * (60초) · 내보내기 · 블랙리스트 and 채팅 얼리기. A viewer is named by 아이디; their member number is looked up here, in
 * the room as FLEXTV lists it now.
 */

/** Null when not signed in as a streamer, or when nothing is on air. */
export async function getFlextvLiveControl(): Promise<LiveControlView | null> {
  if (!FLEXTV_STUDIO) return null;
  const ctx = await studioContext();
  if (!ctx) return null;
  const mine = await myChannel(ctx.token);
  if (!mine?.channel.live) return null;
  const { channelId } = mine.channel;
  const [state, people, totalViewers, live] = await Promise.all([
    fetchStreamState(channelId, ctx.token).catch(() => null),
    fetchViewers(channelId, ctx.token).catch(() => null),
    fetchViewerTotal(channelId).catch(() => null),
    getFlextvRoomLive(channelId)
  ]);
  return {
    channelId,
    playerUrl: embedPlayerUrl(channelId),
    startedAt: state?.startedAt ?? null,
    viewers: live?.viewers ?? null,
    totalViewers,
    frozen: state ? state.frozen : null,
    donors: live?.donors ?? [],
    people: people && people.map(({ loginId, nickname, role, fanLevel, muted }) => ({ loginId, nickname, role, fanLevel, muted }))
  };
}

const ACTIONS: readonly LiveControlAction[] = ["MUTE", "UNMUTE", "KICK", "BLACKLIST", "FREEZE"];
const serialize = createQueue("live-control");
const NOT_IN_ROOM = "지금 방송을 보고 있지 않은 회원이에요. 목록을 새로 불러왔어요.";
const UNREACHABLE = "FLEXTV가 응답하지 않았어요. 잠시 후 다시 시도해 주세요.";

export async function flextvLiveControl(input: { action: unknown; loginId?: unknown }): Promise<LiveControlResult> {
  if (!FLEXTV_STUDIO) return { status: "INVALID", message: UNREACHABLE };
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const action = ACTIONS.find((a) => a === input.action);
  if (!action) return { status: "INVALID", message: "잘못된 요청입니다." };
  const loginId = typeof input.loginId === "string" ? input.loginId.trim() : "";
  if (action !== "FREEZE" && !/^[A-Za-z0-9_.-]{1,40}$/.test(loginId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const mine = await myChannel(ctx.token);
  if (!mine) return { status: "UNAUTHORIZED" };
  if (!mine.channel.live) return { status: "INVALID", message: "방송 중일 때만 할 수 있어요." };
  const { channelId } = mine.channel;
  const caller = requestFrom(await requestDeviceContext());
  try {
    return await serialize(ctx.token, async (): Promise<LiveControlResult> => {
      if (action === "FREEZE") return answer(await toggleFreeze(ctx.token, channelId, caller));
      const viewer = (await fetchViewers(channelId, ctx.token)).find((v) => v.loginId.toLowerCase() === loginId.toLowerCase());
      if (!viewer) return { status: "INVALID", message: NOT_IN_ROOM };
      if (viewer.role === "OWNER") return { status: "INVALID", message: "나 자신에게는 할 수 없어요." };
      if (action === "MUTE" || action === "UNMUTE") return answer(await muteViewer(ctx.token, channelId, viewer.memberId, action === "MUTE", caller));
      if (action === "KICK") return answer(await kickViewer(ctx.token, channelId, viewer.memberId, caller));
      // 블랙리스트 as FLEXTV's chat menu does it: on the list, then out of the room.
      const listed = await addChannelMember(ctx.token, channelId, "blacklist", viewer.loginId, caller);
      if (listed === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
      if (listed !== "OK" && listed !== "ALREADY") return { status: "INVALID", message: "블랙리스트에 올리지 못했어요. 채팅 관리에서 확인해 주세요." };
      await kickViewer(ctx.token, channelId, viewer.memberId, caller).catch(() => null);
      return { status: "DONE" };
    });
  } catch {
    return { status: "INVALID", message: UNREACHABLE };
  }
}

const answer = (outcome: ControlOutcome): LiveControlResult =>
  outcome === "OK" ? { status: "DONE" } : outcome === "UNAUTHORIZED" ? { status: "UNAUTHORIZED" } : { status: "INVALID", message: "이 회원에게는 할 수 없어요. (매니저 · 운영진은 제외돼요)" };
