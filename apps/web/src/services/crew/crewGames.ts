"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { isActiveMember, liveBroadcastOf } from "./crewCore";
import { gameRunView, memberSources, usedSources } from "./crewGameCore";
import { sigCountSignatures } from "./crewSigCountCore";
import { parseSpinSettings, runSpin, spinLive, spinSettingsOf } from "./crewSpinCore";
import type { BroadcastResult, GameSource, GameSpinResult, GamesView } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 점수 게임 Server Actions — code-first (no Figma frame; StreamDonate 참고, P2), route `/creator/crew/games`. Settings are kept
 * per channel; spins belong to the live broadcast. Results are display points only (FN never moves).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew games API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);
/** 기준 후원 choices per member in the studio (the newest ones not yet used for a spin). */
const SOURCES_SHOWN = 10;

function sourcesOf(b: MockBroadcast): Record<string, GameSource[]> {
  const used = usedSources(b, "SPIN");
  return Object.fromEntries(
    (mockCrew.crews[STUDIO_CHANNEL] ?? [])
      .filter((m) => m.active)
      .map((m) => [
        m.id,
        memberSources(b, m.id)
          .filter((x) => !used.has(x.id))
          .slice(0, SOURCES_SHOWN)
      ])
  );
}

export async function getGamesView(): Promise<GamesView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(200);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  return {
    members: structuredClone(mockCrew.crews[STUDIO_CHANNEL] ?? []),
    live: live ? { id: live.id, title: live.title, spin: spinLive(live), sources: sourcesOf(live), serverNow: new Date().toISOString() } : null,
    spinSettings: structuredClone(spinSettingsOf(STUDIO_CHANNEL)),
    signatures: sigCountSignatures(),
    overlayPath: `/overlay/crew/${mockCreator.integrationKey}`
  };
}

/** Replaces the 스핀머신 settings (칸 · 자동 스핀 · 제외 시그니처 · 대기 화면). Saving the same value again is a no-op. */
export async function saveSpinMachine(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const known = spinSettingsOf(STUDIO_CHANNEL).items.map((i) => i.id);
  const parsed = parseSpinSettings(input, MOCK_FORBIDDEN_WORDS, sigCountSignatures().map((s) => s.id), known);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.spinMachines ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/**
 * 수동 스핀: spins for an active member, optionally on one of their donations in the broadcast (기준 후원: a 배수 result
 * multiplies its points; a donation spins at most once). `requestId` is the run id, so a retried spin returns the same
 * run instead of spinning again.
 */
export async function spinMachine(input: unknown): Promise<GameSpinResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const previous = (live.gameRuns ?? []).find((r) => r.id === v.requestId);
  if (previous) return { status: "SPUN", run: gameRunView(live, previous) };
  if (!spinSettingsOf(STUDIO_CHANNEL).items.length) return { status: "INVALID", message: "먼저 스핀머신 칸을 만들어 주세요." };
  if (!isActiveMember(STUDIO_CHANNEL, v.memberId)) return { status: "INVALID", message: "돌릴 멤버를 골라 주세요." };
  const memberId = v.memberId as string;
  let source: GameSource | null = null;
  if (v.sourceId !== null && v.sourceId !== undefined) {
    source = memberSources(live, memberId).find((x) => x.id === v.sourceId) ?? null;
    if (!source) return { status: "INVALID", message: "기준 후원을 다시 골라 주세요." };
    if (usedSources(live, "SPIN").has(source.id)) return { status: "INVALID", message: "이미 스핀을 돌린 후원이에요." };
  }
  // No await between the checks and the write, so a double submit cannot use one donation twice.
  const run = runSpin(live, { id: v.requestId, memberId, trigger: { kind: "MANUAL" }, sourceId: source?.id ?? null, basePoints: source?.points ?? 0 });
  return { status: "SPUN", run: gameRunView(live, run) };
}
