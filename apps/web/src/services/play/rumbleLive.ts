"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { overlayKeyOpen } from "@/services/account/creatorAccess";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { overlaySignal } from "@/services/creator/alertCore";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { overlayTheme } from "@/services/creator/overlayThemeStore";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { closeLive, joinLive, kickLive, liveInvite, liveRoundView, liveState, liveStore, openLiveRound, parseLiveSettings, startLive } from "./rumbleLiveCore";
import { LIVE_TITLE_DEFAULT, type LiveInviteView, type LiveJoinResult, type LiveResult, type LiveState, type LiveView } from "./rumbleLiveTypes";

/**
 * 로얄 럼블 (조작형) Server Actions — code-first (no Figma frame; StreamDonate 참고, P2 시청자 참여 게임). Studio route
 * `/creator/widgets/play/live` (creator session); the player link `/play/rumble/[token]` (no login — the token is the
 * secret). The battle itself is read and steered through `/api/play/rumble-live/*` (several times a second).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Viewer games API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v);
const result = (message: string | null): LiveResult => (message ? { status: "INVALID", message } : { status: "SAVED" });

export async function getLiveView(): Promise<LiveView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return {
    settings: structuredClone(liveStore().settings),
    round: liveRoundView(),
    history: structuredClone(liveStore().history),
    overlayPath: `/overlay/play/${mockCreator.integrationKey}`,
    serverNow: new Date().toISOString()
  };
}

/** Replaces the settings (they apply from the next 참가 모집). */
export async function saveLive(input: unknown): Promise<LiveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseLiveSettings(input, MOCK_FORBIDDEN_WORDS);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  liveStore().settings = parsed;
  return { status: "SAVED" };
}

export async function openLive(input: unknown): Promise<LiveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  return result(openLiveRound(v.requestId));
}

export async function kickLivePlayer(input: unknown): Promise<LiveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  return result(kickLive({ roundId: v.roundId, playerId: v.playerId }));
}

export async function startLiveBattle(input: unknown): Promise<LiveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  return result(startLive({ roundId: v.roundId, requestId: v.requestId }));
}

export async function closeLiveRound(input: unknown): Promise<LiveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  return result(closeLive(rec(input).roundId));
}

/** OBS: the first state and the theme (the page then reads `/api/play/rumble-live/[key]`). The integration key is the secret. */
export async function getLiveOverlay(key: unknown): Promise<{ state: LiveState; theme: ResolvedTheme } | "FORBIDDEN"> {
  assertMock();
  if (!overlayKeyOpen(key)) return "FORBIDDEN";
  return { state: liveState(overlaySignal("play")), theme: overlayTheme() };
}

/** The link page — no login; the token is the secret. Null: the link opens no round now. */
export async function getLiveInvite(token: unknown): Promise<LiveInviteView | null> {
  assertMock();
  const v = liveInvite(token);
  return v && { ...v, title: v.title || LIVE_TITLE_DEFAULT };
}

export async function joinLiveRound(input: unknown): Promise<LiveJoinResult> {
  assertMock();
  const v = rec(input);
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const res = joinLive({ token: v.token, name: v.name, requestId: v.requestId }, MOCK_FORBIDDEN_WORDS);
  return "message" in res ? { status: "INVALID", message: res.message } : { status: "JOINED", ...res };
}
