"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { liveBroadcastOf, startPointOf } from "./crewCore";
import { parsePrizeBoard, parseTeamPrize, prizeSettingsOf, teamPrizeSettingsOf } from "./crewPrizeCore";
import type { BroadcastResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 상품 순위표 · 팀 순위표 Server Actions — code-first (no Figma frame; StreamDonate 랭킹(상품) · 시간 내 랭킹 · 팀 랭킹(상품)
 * 참고), part of `/creator/crew/broadcast`. Settings are kept per channel; showing a board on OBS (`?prize` · `?teamprize`)
 * and its 구간 (시작 ~ 정지) belong to the live broadcast. `board`: "TEAM" for the 팀 순위표, "WINDOW_GAUGE" for the 시간 내
 * 통합 게이지 (`?windowgauge`, always on a 구간), missing (or "MEMBER") for the 상품 순위표 — each has its own 구간. Scores are
 * display points only.
 */
type Board = "MEMBER" | "TEAM" | "WINDOW_GAUGE";

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew prize board API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;
const badRequest = { status: "INVALID", message: "잘못된 요청입니다." } as const;
const boardOf = (v: Record<string, unknown>): Board | null => (v.board === undefined ? "MEMBER" : v.board === "MEMBER" || v.board === "TEAM" || v.board === "WINDOW_GAUGE" ? v.board : null);
const fresh = () => ({ visible: false, window: null, starts: [] });
const stateOf = (b: MockBroadcast, board: Board) =>
  board === "TEAM" ? (b.teamPrize ??= fresh()) : board === "WINDOW_GAUGE" ? (b.windowGauge ??= fresh()) : (b.prizeBoard ??= fresh());
/** Whether a board counts a 구간 now: the 순위표 on their 구간 basis, the 통합 게이지 always. */
const countsWindow = (board: Board) =>
  board === "WINDOW_GAUGE" || (board === "TEAM" ? teamPrizeSettingsOf : prizeSettingsOf)(STUDIO_CHANNEL).basis === "WINDOW";
const crewIds = () => (mockCrew.crews[STUDIO_CHANNEL] ?? []).map((m) => m.id);

/** Replaces the settings (제목 · 집계 기준 · 등수별 상품 · 벌칙 · 제외 · 상단 고정 · 표시). Saving the same value again is a no-op. */
export async function savePrizeBoard(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parsePrizeBoard(input, MOCK_FORBIDDEN_WORDS, crewIds());
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.prizeBoards ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** Replaces the 팀 순위표 settings (제목 · 집계 기준 · 팀 구성 · 등수별 상품 · 벌칙 · 팀원 표시 · 표시). Saving the same value again is a no-op. */
export async function saveTeamPrize(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseTeamPrize(input, MOCK_FORBIDDEN_WORDS, crewIds());
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.teamPrizes ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** OBS에 표시 / 숨기기. Setting the same value again is a no-op. */
export async function setPrizeBoardVisible(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const board = boardOf(v);
  if (!board) return badRequest;
  if (typeof v.on !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
  stateOf(live, board).visible = v.on;
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
  const board = boardOf(v);
  if (!board || typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return badRequest;
  const state = stateOf(live, board);
  if (state.starts.includes(v.requestId)) return { status: "SAVED" };
  if (!countsWindow(board)) return { status: "INVALID", message: "집계 기준이 구간 점수일 때 시작할 수 있어요." };
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
  const board = boardOf(v);
  if (!board) return badRequest;
  const span = (board === "TEAM" ? live.teamPrize : board === "WINDOW_GAUGE" ? live.windowGauge : live.prizeBoard)?.window;
  if (!span) return { status: "INVALID", message: "구간을 먼저 시작해 주세요." };
  span.stoppedAt ??= new Date().toISOString();
  return { status: "SAVED" };
}

/**
 * 시작점 수정 (2026-10-28, StreamDonate "시작점 수정 — 시작점을 과거로 옮기면 그 이후 후원까지 소급"): moves the start of a
 * running 구간 to `at` (from the broadcast's start to now) — every donation since then counts. Moving it to where it is
 * is a no-op.
 */
export async function movePrizeWindowStart(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const board = boardOf(v);
  if (!board) return badRequest;
  const span = (board === "TEAM" ? live.teamPrize : board === "WINDOW_GAUGE" ? live.windowGauge : live.prizeBoard)?.window;
  if (!span || span.stoppedAt) return { status: "INVALID", message: "집계 중인 구간의 시작점만 고칠 수 있어요." };
  const at = startPointOf(live, v.at);
  if (!at) return { status: "INVALID", message: "시작점은 방송 시작부터 지금 사이로 골라 주세요." };
  span.startedAt = at;
  return { status: "SAVED" };
}
