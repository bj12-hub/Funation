"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { overlayKeyOpen } from "@/services/account/creatorAccess";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { ingestChat } from "@/services/broadcast/chatCore";
import { overlaySignal } from "@/services/creator/alertCore";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { overlayTheme } from "@/services/creator/overlayThemeStore";
import {
  addRumbleEntrant,
  closeRumbleRound,
  openRumbleRound,
  parseRumbleSettings,
  removeRumbleEntrant,
  rumbleHistory,
  rumbleRoundView,
  rumbleStore,
  startRumbleBattle,
  syncRumbleChat
} from "./rumbleCore";
import { RUMBLE_TITLE_DEFAULT, type RumbleOverlayView, type RumbleResult, type RumbleView } from "./rumbleTypes";

/**
 * 로얄 럼블 Server Actions — code-first (no Figma frame; StreamDonate 로얄 럼블 참고, P2 시청자 참여 게임). Studio route
 * `/creator/widgets/play/rumble` (creator session), OBS `/overlay/play/[key]?rumble` (integration key). Free: no FN and no
 * points move.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Viewer games API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v);
const result = (message: string | null): RumbleResult => (message ? { status: "INVALID", message } : { status: "SAVED" });

/** Chat entries since the round opened (the 통합 채팅 feed is read first). */
async function refreshEntrants() {
  await ingestChat();
  syncRumbleChat();
}

export async function getRumbleView(): Promise<RumbleView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await refreshEntrants();
  return {
    settings: structuredClone(rumbleStore().settings),
    round: rumbleRoundView(),
    history: rumbleHistory(),
    overlayPath: `/overlay/play/${mockCreator.integrationKey}`,
    serverNow: new Date().toISOString()
  };
}

/** Replaces the settings (they apply from the next 참가 모집). */
export async function saveRumble(input: unknown): Promise<RumbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseRumbleSettings(input, MOCK_FORBIDDEN_WORDS);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  rumbleStore().settings = parsed;
  return { status: "SAVED" };
}

/** 참가 모집 시작: a new round. `requestId`: a retried open is not another round. */
export async function openRumble(input: unknown): Promise<RumbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  return result(openRumbleRound(v.requestId));
}

export async function addRumble(input: unknown): Promise<RumbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  await refreshEntrants();
  return result(addRumbleEntrant({ roundId: v.roundId, name: v.name }, MOCK_FORBIDDEN_WORDS));
}

export async function removeRumble(input: unknown): Promise<RumbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  return result(removeRumbleEntrant({ roundId: v.roundId, entrantId: v.entrantId }));
}

/** 배틀 시작: the fight is decided now. `requestId`: a retried start is the same battle. */
export async function startRumble(input: unknown): Promise<RumbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  // Late chat entries still join before the fight is decided.
  await refreshEntrants();
  return result(startRumbleBattle({ roundId: v.roundId, requestId: v.requestId }));
}

export async function closeRumble(input: unknown): Promise<RumbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  return result(closeRumbleRound(rec(input).roundId));
}

/** OBS read — no login; the integration key is the secret. */
export async function getRumbleOverlay(key: unknown): Promise<RumbleOverlayView | "FORBIDDEN"> {
  assertMock();
  if (!overlayKeyOpen(key)) return "FORBIDDEN";
  await refreshEntrants();
  return {
    title: rumbleStore().settings.title || RUMBLE_TITLE_DEFAULT,
    round: rumbleRoundView(),
    theme: overlayTheme(),
    serverNow: new Date().toISOString(),
    ...overlaySignal("play")
  };
}
