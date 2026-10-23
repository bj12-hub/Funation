"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { isActiveMember, liveBroadcastOf } from "./crewCore";
import { diceLive, diceSettingsOf, parseDiceSettings, runDice } from "./crewDiceCore";
import { gameRunView, memberSources, usedSources, type RunStart, type StoredRun } from "./crewGameCore";
import { addJupjupItem, jupjupLive, jupjupSettingsOf, parseJupjupSettings, removeJupjupItems } from "./crewJupjupCore";
import { parseRandomSigSettings, randomSigLive, randomSigSettingsOf } from "./crewRandomSigCore";
import { clearRelayPending, parseRelaySettings, relayLive, relaySettingsOf } from "./crewRelayCore";
import { sigCountSignatures } from "./crewSigCountCore";
import { parseSpinSettings, runSpin, spinLive, spinSettingsOf } from "./crewSpinCore";
import { parseTwoWheelSettings, runTwoWheel, twoWheelLive, twoWheelSettingsOf } from "./crewTwoWheelCore";
import { GAMES, type BroadcastResult, type GameKey, type GamePlayResult, type GameSource, type GamesView } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 점수 게임 Server Actions — code-first (no Figma frame; StreamDonate 참고, P2), route `/creator/crew/games`: 스핀머신 · 주사위
 * 게임 · 투휠 게임 · 랜덤시그 · 기여도 릴레이 · 줍줍. Settings are kept per channel; runs belong to the live broadcast. Results are display points only.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew games API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);
const signatureIds = () => sigCountSignatures().map((s) => s.id);
/** 기준 후원 choices per member and game in the studio (the newest ones that game has not used). */
const SOURCES_SHOWN = 10;

/** How each game plays one run by hand (the caller checks the game can play). 랜덤시그 · 기여도 릴레이 · 줍줍 play only from donations. */
const PLAY: Record<Exclude<GameKey, "RANDOM_SIG" | "RELAY" | "JUPJUP">, (b: MockBroadcast, start: RunStart) => StoredRun> = { SPIN: runSpin, DICE: runDice, TWO_WHEEL: runTwoWheel };

function sourcesOf(b: MockBroadcast): Record<GameKey, Record<string, GameSource[]>> {
  const active = (mockCrew.crews[STUDIO_CHANNEL] ?? []).filter((m) => m.active);
  const all = new Map(active.map((m) => [m.id, memberSources(b, m.id)]));
  const forGame = (game: GameKey) => {
    const used = usedSources(b, game);
    return Object.fromEntries(
      active.map((m) => [
        m.id,
        all
          .get(m.id)!
          .filter((x) => !used.has(x.id))
          .slice(0, SOURCES_SHOWN)
      ])
    );
  };
  return { SPIN: forGame("SPIN"), DICE: forGame("DICE"), TWO_WHEEL: forGame("TWO_WHEEL"), RANDOM_SIG: {}, RELAY: {}, JUPJUP: {} };
}

export async function getGamesView(): Promise<GamesView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(200);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  return {
    members: structuredClone(mockCrew.crews[STUDIO_CHANNEL] ?? []),
    live: live
      ? {
          id: live.id,
          title: live.title,
          spin: spinLive(live),
          dice: diceLive(live),
          twoWheel: twoWheelLive(live),
          randomSig: randomSigLive(live),
          relay: relayLive(live),
          jupjup: jupjupLive(live),
          sources: sourcesOf(live),
          serverNow: new Date().toISOString()
        }
      : null,
    spinSettings: structuredClone(spinSettingsOf(STUDIO_CHANNEL)),
    diceSettings: structuredClone(diceSettingsOf(STUDIO_CHANNEL)),
    twoWheelSettings: structuredClone(twoWheelSettingsOf(STUDIO_CHANNEL)),
    randomSigSettings: structuredClone(randomSigSettingsOf(STUDIO_CHANNEL)),
    relaySettings: structuredClone(relaySettingsOf(STUDIO_CHANNEL)),
    jupjupSettings: structuredClone(jupjupSettingsOf(STUDIO_CHANNEL)),
    signatures: sigCountSignatures(),
    overlayPath: `/overlay/crew/${mockCreator.integrationKey}`
  };
}

/** Replaces the 스핀머신 settings (칸 · 자동 · 제외 시그니처 · 대기 화면). Saving the same value again is a no-op. */
export async function saveSpinMachine(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const known = spinSettingsOf(STUDIO_CHANNEL).items.map((i) => i.id);
  const parsed = parseSpinSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds(), known);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.spinMachines ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** Replaces the 주사위 게임 settings (룰 · 자동 · 제외 시그니처 · 대기 화면). */
export async function saveDiceGame(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseDiceSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds());
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.diceGames ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** Replaces the 투휠 게임 settings (+ / × 확률 · 숫자 확률 · +1 점수 · 자동 · 제외 시그니처 · 대기 화면). */
export async function saveTwoWheel(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseTwoWheelSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds());
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.twoWheels ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** Replaces the 랜덤시그 settings (켜기 · 발동 구간 · 기여도 방식 · 기본 배수 · 제외 시그 · 대기 화면). */
export async function saveRandomSig(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const known = randomSigSettingsOf(STUDIO_CHANNEL).tiers.map((t) => t.id);
  const parsed = parseRandomSigSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds(), known);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.randomSigs ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** Replaces the 기여도 릴레이 settings (켜기 · 트리거 BJ · 금액 구간 · 제외 시그 · 대기 화면). */
export async function saveRelay(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const active = (mockCrew.crews[STUDIO_CHANNEL] ?? []).filter((m) => m.active).map((m) => m.id);
  const known = relaySettingsOf(STUDIO_CHANNEL).tiers.map((t) => t.id);
  const parsed = parseRelaySettings(input, MOCK_FORBIDDEN_WORDS, signatureIds(), active, known);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.relays ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** 대기 비우기: drops the 배수 waiting for the next 시그니처 후원. Clearing nothing is a no-op. */
export async function clearRelay(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== rec(input).broadcastId) return notLive;
  clearRelayPending(live);
  return { status: "SAVED" };
}

/** Replaces the 줍줍 settings (켜기 · 지정 BJ · 모드 · 금액 구간 · 제외 시그 · 대기 화면). */
export async function saveJupjup(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const active = (mockCrew.crews[STUDIO_CHANNEL] ?? []).filter((m) => m.active).map((m) => m.id);
  const known = jupjupSettingsOf(STUDIO_CHANNEL).tiers.map((t) => t.id);
  const parsed = parseJupjupSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds(), active, known);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.jupjups ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** 수동 추가: a signature on the 줍줍 stack for a 지정 BJ. `requestId` is the item id (a retried add is not a second item). */
export async function addJupjup(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const message = addJupjupItem(live, { requestId: v.requestId, memberId: v.memberId, signatureId: v.signatureId });
  return message ? { status: "INVALID", message } : { status: "SAVED" };
}

/** Takes one item off the 줍줍 stack (`itemId`), or clears it (`itemId` null — 스택 비우기). */
export async function removeJupjup(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (v.itemId !== null && typeof v.itemId !== "string") return { status: "INVALID", message: "잘못된 요청입니다." };
  removeJupjupItems(live, v.itemId);
  return { status: "SAVED" };
}

/**
 * 수동: plays `game` once for an active member, optionally on one of their donations in the broadcast (기준 후원: a 배수
 * result multiplies its points; a donation plays each game at most once). `requestId` is the run id, so a retry returns
 * the same run instead of playing again.
 */
export async function playGame(input: unknown): Promise<GamePlayResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const game = GAMES.find((g) => g.key === v.game)?.key;
  if (!game) return { status: "INVALID", message: "게임을 골라 주세요." };
  if (game === "RANDOM_SIG") return { status: "INVALID", message: "랜덤시그는 발동 금액 후원이 들어올 때만 돌아가요." };
  if (game === "RELAY") return { status: "INVALID", message: "기여도 릴레이는 시그니처 후원으로만 이어져요." };
  if (game === "JUPJUP") return { status: "INVALID", message: "줍줍은 같은 금액의 시그니처 후원으로만 가져가요." };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const previous = (live.gameRuns ?? []).find((r) => r.id === v.requestId);
  if (previous) return { status: "PLAYED", run: gameRunView(live, previous) };
  if (game === "SPIN" && !spinSettingsOf(STUDIO_CHANNEL).items.length) return { status: "INVALID", message: "먼저 스핀머신 칸을 만들어 주세요." };
  if (!isActiveMember(STUDIO_CHANNEL, v.memberId)) return { status: "INVALID", message: "멤버를 골라 주세요." };
  const memberId = v.memberId as string;
  let source: GameSource | null = null;
  if (v.sourceId !== null && v.sourceId !== undefined) {
    source = memberSources(live, memberId).find((x) => x.id === v.sourceId) ?? null;
    if (!source) return { status: "INVALID", message: "기준 후원을 다시 골라 주세요." };
    if (usedSources(live, game).has(source.id)) return { status: "INVALID", message: "이 게임을 이미 돌린 후원이에요." };
  }
  // No await between the checks and the write, so a double submit cannot use one donation twice.
  const run = PLAY[game](live, { id: v.requestId, memberId, trigger: { kind: "MANUAL" }, sourceId: source?.id ?? null, basePoints: source?.points ?? 0 });
  return { status: "PLAYED", run: gameRunView(live, run) };
}
