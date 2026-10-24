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
  addMarbleEntrant,
  closeMarbleRound,
  joinMarbleInvite,
  marbleHistory,
  marbleInvite,
  marbleInvitePath,
  marbleRoundView,
  marbleStore,
  openMarbleRound,
  parseMarbleSettings,
  removeMarbleEntrant,
  startMarbleRace,
  syncChatEntrants
} from "./marbleCore";
import { MARBLE_TITLE_DEFAULT, type MarbleInviteView, type MarbleJoinResult, type MarbleOverlayView, type MarbleResult, type MarbleView } from "./marbleTypes";

/**
 * 마블 룰렛 Server Actions — code-first (no Figma frame; StreamDonate 마블 룰렛 참고, P2 시청자 참여 게임). Studio route
 * `/creator/widgets/play` (creator session), OBS `/overlay/play/[key]?marble` (integration key), the VIP 초대 링크
 * `/play/marble/[token]` (no login — the token is the secret). Free: no FN and no points move.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Viewer games API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v);
const result = (message: string | null): MarbleResult => (message ? { status: "INVALID", message } : { status: "SAVED" });

/** Chat entries since the round opened (the 통합 채팅 feed is read first). */
async function refreshEntrants() {
  await ingestChat();
  syncChatEntrants();
}

export async function getMarbleView(): Promise<MarbleView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await refreshEntrants();
  return {
    settings: structuredClone(marbleStore().settings),
    round: marbleRoundView(),
    invitePath: marbleInvitePath(),
    history: marbleHistory(),
    overlayPath: `/overlay/play/${mockCreator.integrationKey}`,
    serverNow: new Date().toISOString()
  };
}

/** Replaces the settings (they apply from the next 참가 모집). */
export async function saveMarble(input: unknown): Promise<MarbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseMarbleSettings(input, MOCK_FORBIDDEN_WORDS);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  marbleStore().settings = parsed;
  return { status: "SAVED" };
}

/** 참가 모집 시작: a new round. `requestId`: a retried open is not another round. */
export async function openMarble(input: unknown): Promise<MarbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  return result(openMarbleRound(v.requestId));
}

export async function addMarble(input: unknown): Promise<MarbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  await refreshEntrants();
  return result(addMarbleEntrant({ roundId: v.roundId, name: v.name }, MOCK_FORBIDDEN_WORDS));
}

export async function removeMarble(input: unknown): Promise<MarbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  return result(removeMarbleEntrant({ roundId: v.roundId, entrantId: v.entrantId }));
}

/** 레이스 시작: the order is drawn now. `requestId`: a retried start is the same race. */
export async function startMarble(input: unknown): Promise<MarbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  // Late chat entries still join before the order is drawn.
  await refreshEntrants();
  return result(startMarbleRace({ roundId: v.roundId, requestId: v.requestId }));
}

export async function closeMarble(input: unknown): Promise<MarbleResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  return result(closeMarbleRound(rec(input).roundId));
}

/** OBS read — no login; the integration key is the secret. The invite token never leaves the studio. */
export async function getMarbleOverlay(key: unknown): Promise<MarbleOverlayView | "FORBIDDEN"> {
  assertMock();
  if (!overlayKeyOpen(key)) return "FORBIDDEN";
  await refreshEntrants();
  return {
    title: marbleStore().settings.title || MARBLE_TITLE_DEFAULT,
    round: marbleRoundView(),
    history: marbleHistory(),
    theme: overlayTheme(),
    serverNow: new Date().toISOString(),
    ...overlaySignal("play")
  };
}

/** The VIP 초대 링크 page — no login; the token is the secret. Null: the link opens no round now. */
export async function getMarbleInvite(token: unknown): Promise<MarbleInviteView | null> {
  assertMock();
  const v = marbleInvite(token);
  return v && { ...v, title: v.title || MARBLE_TITLE_DEFAULT };
}

export async function joinMarble(input: unknown): Promise<MarbleJoinResult> {
  assertMock();
  const v = rec(input);
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const res = joinMarbleInvite({ token: v.token, name: v.name, requestId: v.requestId }, MOCK_FORBIDDEN_WORDS);
  return "message" in res ? { status: "INVALID", message: res.message } : { status: "JOINED", players: res.players };
}
