"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { liveBroadcastOf } from "./crewCore";
import { parsePrizeBoard, prizeSettingsOf } from "./crewPrizeCore";
import type { BroadcastResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 상품 순위표 Server Actions — code-first (no Figma frame; StreamDonate 랭킹(상품) · 시간 내 랭킹 참고), part of
 * `/creator/crew/broadcast`. Settings are kept per channel; showing it on OBS (`?prize`) and the 구간 (시작 ~ 정지) belong
 * to the live broadcast. Scores are display points only.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew prize board API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;
const stateOf = (b: MockBroadcast) => (b.prizeBoard ??= { visible: false, window: null, starts: [] });

/** Replaces the settings (제목 · 집계 기준 · 등수별 상품 · 벌칙 · 제외 · 상단 고정 · 표시). Saving the same value again is a no-op. */
export async function savePrizeBoard(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const memberIds = (mockCrew.crews[STUDIO_CHANNEL] ?? []).map((m) => m.id);
  const parsed = parsePrizeBoard(input, MOCK_FORBIDDEN_WORDS, memberIds);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.prizeBoards ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** OBS에 표시 / 숨기기. Setting the same value again is a no-op. */
export async function setPrizeBoardVisible(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (typeof v.on !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
  stateOf(live).visible = v.on;
  return { status: "SAVED" };
}

/**
 * 구간 시작: counts from now (a running or stopped 구간 starts over — 다시 시작). Only on the WINDOW basis. `requestId`
 * (one per intended start) makes a retried or double-clicked start a no-op instead of a second restart.
 */
export async function startPrizeWindow(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const state = stateOf(live);
  if (state.starts.includes(v.requestId)) return { status: "SAVED" };
  if (prizeSettingsOf(STUDIO_CHANNEL).basis !== "WINDOW") return { status: "INVALID", message: "집계 기준이 구간 점수일 때 시작할 수 있어요." };
  state.starts.push(v.requestId);
  state.window = { startedAt: new Date().toISOString(), stoppedAt: null };
  return { status: "SAVED" };
}

/** 구간 정지: freezes the 구간 (the board keeps its scores with a 마감 mark). Stopping a stopped 구간 is a no-op. */
export async function stopPrizeWindow(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const span = live.prizeBoard?.window;
  if (!span) return { status: "INVALID", message: "구간을 먼저 시작해 주세요." };
  span.stoppedAt ??= new Date().toISOString();
  return { status: "SAVED" };
}
