"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { liveBroadcastOf } from "./crewCore";
import { parseGauge, parsePledges } from "./crewGaugeCore";
import { parseWindowGauge } from "./crewWindowGaugeCore";
import type { BroadcastResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * BJ 공약 · 출근 BJ 게이지 Server Actions — code-first (no Figma frame; StreamDonate 참고), part of `/creator/crew/broadcast`.
 * 공약 and 게이지 settings are kept per channel; OBS에 표시 (`?bjgauge`) belongs to the live broadcast.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew gauge API is not connected yet.");
};

/** Replaces every member's 공약 · 목표 (`pledges`: { memberId: { text, goal } }). Saving the same value again is a no-op. */
export async function savePledges(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const parsed = parsePledges(v.pledges, MOCK_FORBIDDEN_WORDS, (mockCrew.crews[STUDIO_CHANNEL] ?? []).map((m) => m.id));
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.pledges ??= {})[STUDIO_CHANNEL] = parsed.pledges;
  return { status: "SAVED" };
}

/** Replaces the 게이지 settings (제목 · 출근 BJ만 · 공약 표시 · 숫자 · 배치). */
export async function saveGauge(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseGauge(input, MOCK_FORBIDDEN_WORDS);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.gauges ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/**
 * Replaces the 시간 내 통합 게이지 settings (제목 · 후원금 / 기여도 · 목표 · 자동 증량 · 숫자 · 배치). Its OBS에 표시 and 구간
 * (시작 ~ 정지) are the 순위표 actions with `board: "WINDOW_GAUGE"` (crewPrizeBoard.ts).
 */
export async function saveWindowGauge(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseWindowGauge(input, MOCK_FORBIDDEN_WORDS);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.windowGauges ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** OBS에 표시 / 숨기기. Setting the same value again is a no-op. */
export async function setGaugeVisible(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return { status: "INVALID", message: "진행 중인 방송이 아니에요." };
  if (typeof v.on !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
  (live.gauge ??= { visible: false }).visible = v.on;
  return { status: "SAVED" };
}
