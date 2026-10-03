"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { channelRows, isHidden, mockRoulette, stageOf, startSpin, statusOf } from "@/services/donations/rouletteCore";
import type { RouletteControlResult, RouletteRemoteView } from "@/services/donations/rouletteTypes";
import { readWidget, widgetStore } from "./widgetStore";

/**
 * 리모컨 룰렛 제어 (code-first, 펀페이 1009:355): ▶ 시작 (next waiting spin), Ⅱ 일시정지 (자동 시작을 멈춤),
 * ✓ 완료 (take a shown result off the screen). Results are drawn at payment and are never changed here.
 * TBD: audit of who started or finished a spin, refunds for spins that cannot run.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Roulette remote API is not connected yet.");
};

export async function getRouletteRemote(): Promise<RouletteRemoteView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  const st = readWidget("ROULETTE");
  const stage = stageOf(STUDIO_CHANNEL);
  return {
    enabled: st.enabled,
    autoStart: st.autoStart,
    autoReveal: st.autoReveal,
    paused: mockRoulette.paused[STUDIO_CHANNEL] === true,
    hidden: isHidden(STUDIO_CHANNEL),
    dailyLimit: st.dailyLimit,
    items: st.items.map(({ name, percent }) => ({ name, percent })),
    stage,
    ...channelRows(STUDIO_CHANNEL)
  };
}

/** Starts the oldest waiting spin when the wheel is free. */
export async function startNextSpin(): Promise<RouletteControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (stageOf(STUDIO_CHANNEL)) return { status: "INVALID", message: "돌아가는 룰렛이 끝난 뒤 시작할 수 있어요." };
  const next = mockRoulette.spins.find((s) => s.channelId === STUDIO_CHANNEL && !s.startedAt);
  if (!next) return { status: "INVALID", message: "대기 중인 참여가 없어요." };
  startSpin(next);
  return { status: "SAVED" };
}

/** 일시정지 stops 자동 시작 (a spin already turning finishes). */
export async function setRoulettePaused(input: unknown): Promise<RouletteControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const paused = (input as { paused?: unknown } | null)?.paused;
  if (typeof paused !== "boolean") return { status: "INVALID", message: "요청 정보를 확인해 주세요." };
  mockRoulette.paused[STUDIO_CHANNEL] = paused;
  return { status: "SAVED" };
}

/** ✓ 결과 공개 (결과 자동 노출 off): the stopped wheel shows its result now. Revealing twice is a no-op. */
export async function revealRouletteSpin(input: unknown): Promise<RouletteControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const id = (input as { spinId?: unknown } | null)?.spinId;
  const spin = mockRoulette.spins.find((s) => s.channelId === STUDIO_CHANNEL && s.id === id);
  if (!spin) return { status: "INVALID", message: "룰렛 참여를 찾을 수 없어요." };
  const status = statusOf(spin);
  if (status === "RESULT" || status === "DONE") return { status: "SAVED" };
  if (status !== "WAITING") return { status: "INVALID", message: "룰렛이 멈춘 뒤 결과를 공개할 수 있어요." };
  spin.revealedAt = new Date().toISOString();
  return { status: "SAVED" };
}

const SWITCHES = ["enabled", "autoStart", "autoReveal"] as const;

/** 리모컨 스위치 (펀페이 1009:355): 후원 받기 · 룰렛 자동시작 · 결과 자동노출, the same values as 위젯 › 룰렛. */
export async function setRouletteSwitch(input: unknown): Promise<RouletteControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { key?: unknown; on?: unknown };
  if (!SWITCHES.includes(v.key as (typeof SWITCHES)[number]) || typeof v.on !== "boolean") return { status: "INVALID", message: "요청 정보를 확인해 주세요." };
  widgetStore.ROULETTE = { ...readWidget("ROULETTE"), [v.key as (typeof SWITCHES)[number]]: v.on };
  return { status: "SAVED" };
}

/** 위젯 화면 숨기기: the roulette overlay shows nothing (spins and results still go on). */
export async function setRouletteHidden(input: unknown): Promise<RouletteControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const hidden = (input as { hidden?: unknown } | null)?.hidden;
  if (typeof hidden !== "boolean") return { status: "INVALID", message: "요청 정보를 확인해 주세요." };
  mockRoulette.hidden = { ...mockRoulette.hidden, [STUDIO_CHANNEL]: hidden };
  return { status: "SAVED" };
}

/** ✓ 완료: a shown result leaves the broadcast now. Finishing a finished spin again is a no-op. */
export async function finishRouletteSpin(input: unknown): Promise<RouletteControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const id = (input as { spinId?: unknown } | null)?.spinId;
  const spin = mockRoulette.spins.find((s) => s.channelId === STUDIO_CHANNEL && s.id === id);
  if (!spin) return { status: "INVALID", message: "룰렛 참여를 찾을 수 없어요." };
  const status = statusOf(spin);
  if (status === "DONE") return { status: "SAVED" };
  if (status !== "RESULT") return { status: "INVALID", message: "결과가 나온 뒤 완료할 수 있어요." };
  spin.doneAt = new Date().toISOString();
  return { status: "SAVED" };
}
