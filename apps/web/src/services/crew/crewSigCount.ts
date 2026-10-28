"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { liveBroadcastOf, startPointOf } from "./crewCore";
import { parseSigCount, sigCountSignatures } from "./crewSigCountCore";
import type { BroadcastResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 시그 카운트 Server Actions — code-first (no Figma frame; StreamDonate 시그 카운트 참고), part of `/creator/crew/broadcast`.
 * Settings are kept per channel; showing it on OBS (`?sigcount`) and 다시 세기 belong to the live broadcast.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew signature count API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;
const stateOf = (b: MockBroadcast) => (b.sigCount ??= { visible: false, since: null, resets: [] });

/** Replaces the settings (제목 · 셀 시그니처 · 줄 · 정렬 · 합계). Saving the same value again is a no-op. */
export async function saveSigCount(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseSigCount(input, MOCK_FORBIDDEN_WORDS, sigCountSignatures().map((s) => s.id));
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.sigCounts ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** OBS에 표시 / 숨기기. Setting the same value again is a no-op. */
export async function setSigCountVisible(input: unknown): Promise<BroadcastResult> {
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
 * 다시 세기: counts from now on (what came before stays in the donation history). `requestId` (one per intended reset)
 * makes a retried or double-clicked reset a no-op instead of a second one.
 */
export async function resetSigCount(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const state = stateOf(live);
  if (state.resets.includes(v.requestId)) return { status: "SAVED" };
  state.resets.push(v.requestId);
  state.since = new Date().toISOString();
  return { status: "SAVED" };
}

/** 시작 시점 수정 (2026-10-28, StreamDonate 시그 카운트): counts from `at` (the broadcast's start to now). */
export async function moveSigCountStart(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const at = startPointOf(live, v.at);
  if (!at) return { status: "INVALID", message: "시작점은 방송 시작부터 지금 사이로 골라 주세요." };
  stateOf(live).since = at;
  return { status: "SAVED" };
}
