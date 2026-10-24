"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { isActiveMember, liveBroadcastOf } from "./crewCore";
import { diceLive, diceSettingsOf, parseDiceSettings, runDice } from "./crewDiceCore";
import { gameRunView, memberSources, usedSources, type RunStart, type StoredRun } from "./crewGameCore";
import { clearGridDrawBoard, gridDrawLive, gridDrawSettingsOf, openGridDrawCell, parseGridDrawSettings, startGridDrawBoard } from "./crewGridDrawCore";
import { alphabetLive, alphabetSettingsOf, parseAlphabetSettings, resetAlphabetBoard, runAlphabet } from "./crewAlphabetCore";
import { goStopLive, goStopSettingsOf, parseGoStopSettings, resetGoStopPool, runGoStop } from "./crewGoStopCore";
import { clearSigDosanBoard, parseSigDosanSettings, sigDosanLive, sigDosanSettingsOf, startSigDosanBoard, stepSigDosanLane } from "./crewSigDosanCore";
import {
  clearSigHunterBoard,
  nextSigHunterRound,
  parseSigHunterSettings,
  setSigHunterSlot,
  sigHunterLive,
  sigHunterSettingsOf,
  startSigHunterBoard
} from "./crewSigHunterCore";
import { addJupjupItem, jupjupLive, jupjupSettingsOf, parseJupjupSettings, removeJupjupItems } from "./crewJupjupCore";
import { medleyLive, medleySettingsOf, parseMedleySettings, playMedleyRun } from "./crewMedleyCore";
import { clearSigBingoBoard, parseSigBingoSettings, setSigBingoCell, sigBingoLive, sigBingoSettingsOf, startSigBingoBoard } from "./crewSigBingoCore";
import { parseRandomSigSettings, randomSigLive, randomSigSettingsOf } from "./crewRandomSigCore";
import { clearRelayPending, parseRelaySettings, relayLive, relaySettingsOf } from "./crewRelayCore";
import { sigCountSignatures } from "./crewSigCountCore";
import { parseSpinSettings, runSpin, spinLive, spinSettingsOf } from "./crewSpinCore";
import { parseTwoWheelSettings, runTwoWheel, twoWheelLive, twoWheelSettingsOf } from "./crewTwoWheelCore";
import { GAMES, type BroadcastResult, type GameKey, type GamePlayResult, type GameSource, type GamesView } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 점수 게임 Server Actions — code-first (no Figma frame; StreamDonate 참고, P2), route `/creator/crew/games`: 스핀머신 · 주사위
 * 게임 · 투휠 게임 · 랜덤시그 · 기여도 릴레이 · 줍줍 · 시그니처 메들리 · 시그 빙고 · 복불복 뽑기판 · 시그니처 헌터 · 시그니처 두산 · 알파벳 모으기 · 고스톱. Settings are kept per channel; runs belong to the live broadcast. Results are display points only.
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

/**
 * How each game plays one run by hand for a member (the caller checks the game can play). 랜덤시그 · 기여도 릴레이 · 줍줍 play only
 * from donations; 메들리 rolls by hand without a member (playMedley).
 */
const PLAY: Record<Exclude<GameKey, "RANDOM_SIG" | "RELAY" | "JUPJUP" | "MEDLEY" | "SIG_BINGO" | "GRID_DRAW" | "SIG_HUNTER" | "SIG_DOSAN">, (b: MockBroadcast, start: RunStart) => StoredRun> = { SPIN: runSpin, DICE: runDice, TWO_WHEEL: runTwoWheel, ALPHABET: runAlphabet, GOSTOP: runGoStop };

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
  return { SPIN: forGame("SPIN"), DICE: forGame("DICE"), TWO_WHEEL: forGame("TWO_WHEEL"), RANDOM_SIG: {}, RELAY: {}, JUPJUP: {}, MEDLEY: {}, SIG_BINGO: {}, GRID_DRAW: {}, SIG_HUNTER: {}, SIG_DOSAN: {}, ALPHABET: forGame("ALPHABET"), GOSTOP: forGame("GOSTOP") };
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
          medley: medleyLive(live),
          sigBingo: sigBingoLive(live),
          gridDraw: gridDrawLive(live, true),
          sigHunter: sigHunterLive(live, true),
          sigDosan: sigDosanLive(live),
          alphabet: alphabetLive(live),
          gostop: goStopLive(live),
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
    medleySettings: structuredClone(medleySettingsOf(STUDIO_CHANNEL)),
    sigBingoSettings: structuredClone(sigBingoSettingsOf(STUDIO_CHANNEL)),
    gridDrawSettings: structuredClone(gridDrawSettingsOf(STUDIO_CHANNEL)),
    sigHunterSettings: structuredClone(sigHunterSettingsOf(STUDIO_CHANNEL)),
    sigDosanSettings: structuredClone(sigDosanSettingsOf(STUDIO_CHANNEL)),
    alphabetSettings: structuredClone(alphabetSettingsOf(STUDIO_CHANNEL)),
    gostopSettings: structuredClone(goStopSettingsOf(STUDIO_CHANNEL)),
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
  const medley = medleySettingsOf(STUDIO_CHANNEL);
  const shared = parsed.auto && medley.auto ? parsed.tiers.find((t) => t.trigger === medley.trigger) : undefined;
  if (shared) return { status: "INVALID", message: `발동 금액 ${shared.trigger.toLocaleString("ko-KR")} FN은 시그니처 메들리가 쓰고 있어요.` };
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

/** Replaces the 메들리 settings (켜기 · 발동 금액 · 등록 시그니처 · 대기 화면). */
export async function saveMedley(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const random = randomSigSettingsOf(STUDIO_CHANNEL);
  const takenBy = (amount: number) => (random.auto && random.tiers.some((t) => t.trigger === amount) ? "랜덤시그 발동 구간" : null);
  const parsed = parseMedleySettings(input, MOCK_FORBIDDEN_WORDS, signatureIds(), takenBy);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.medleys ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** 수동 메들리: rolls a registered signature on OBS (no alert, no points). `requestId` is the run id (a retry is the same run). */
export async function playMedley(input: unknown): Promise<GamePlayResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const run = playMedleyRun(live, v.requestId);
  return typeof run === "string" ? { status: "INVALID", message: run } : { status: "PLAYED", run: gameRunView(live, run) };
}

/** Replaces the 시그 빙고 settings (판 크기 · 모드 · 칸 표시 · 금액 범위 · 빙고 보너스 · 후원으로 칸 열기 · 제외 시그 · 대기 화면). */
export async function saveSigBingo(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseSigBingoSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds());
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.sigBingos ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** 빙고 시작: a new board from the saved settings (replacing the one there). `requestId`: a retried start is not a new board. */
export async function startSigBingo(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const message = startSigBingoBoard(live, v.requestId);
  return message ? { status: "INVALID", message } : { status: "SAVED" };
}

/** 수동 칸 열기 · 닫기 (`open`; 땅따먹기 opens for `memberId`). */
export async function setSigBingo(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const message = setSigBingoCell(live, { index: v.index, open: v.open, memberId: v.memberId });
  return message ? { status: "INVALID", message } : { status: "SAVED" };
}

/** 판 비우기: removes the board. Clearing nothing is a no-op. */
export async function clearSigBingo(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== rec(input).broadcastId) return notLive;
  clearSigBingoBoard(live);
  return { status: "SAVED" };
}

/** Replaces the 복불복 뽑기판 settings (이름 · 칸 개수 · 당첨 목록 · 자동 오픈 · 최소 금액 · 자동 리셋 · 제외 시그 · 대기 화면). */
export async function saveGridDraw(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const known = gridDrawSettingsOf(STUDIO_CHANNEL).prizes.map((p) => p.id);
  const parsed = parseGridDrawSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds(), known);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.gridDraws ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** 뽑기판 시작: a new board from the saved settings (replacing the one there). `requestId`: a retried start is not a new board. */
export async function startGridDraw(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  startGridDrawBoard(live, v.requestId);
  return { status: "SAVED" };
}

/** 수동 열기: a chosen cell (`index` of board `round`) or a random one (`index` null), for `memberId` or none. `requestId`: a retry opens nothing more. */
export async function openGridDraw(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const message = openGridDrawCell(live, { index: v.index, round: v.round, memberId: v.memberId, requestId: v.requestId });
  return message ? { status: "INVALID", message } : { status: "SAVED" };
}

/** 판 비우기: removes the board. Clearing nothing is a no-op. */
export async function clearGridDraw(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== rec(input).broadcastId) return notLive;
  clearGridDrawBoard(live);
  return { status: "SAVED" };
}

/** Replaces the 시그니처 헌터 settings (이름 · 라운드 · 시그니처 후원으로 SOLD OUT · 제외 시그 · 대기 화면). */
export async function saveSigHunter(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const known = sigHunterSettingsOf(STUDIO_CHANNEL).rounds.map((r) => r.id);
  const parsed = parseSigHunterSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds(), known);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.sigHunters ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** 헌트 시작: 1라운드 from the saved settings (replacing the hunt there). `requestId`: a retried start is not a new hunt. */
export async function startSigHunter(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const message = startSigHunterBoard(live, v.requestId);
  return message ? { status: "INVALID", message } : { status: "SAVED" };
}

/** 수동 SOLD OUT · 되돌리기 (`sold`) of slot `index` in 라운드 `round`, for `memberId` or none. `requestId`: a retry sells nothing more. */
export async function setSigHunter(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const message = setSigHunterSlot(live, { index: v.index, round: v.round, sold: v.sold, memberId: v.memberId, requestId: v.requestId });
  return message ? { status: "INVALID", message } : { status: "SAVED" };
}

/** 다음 라운드 now, from 라운드 `round` (a retry once it has moved on is a no-op). */
export async function nextSigHunter(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const message = nextSigHunterRound(live, v.round);
  return message ? { status: "INVALID", message } : { status: "SAVED" };
}

/** 판 비우기: removes the hunt. Clearing nothing is a no-op. */
export async function clearSigHunter(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== rec(input).broadcastId) return notLive;
  clearSigHunterBoard(live);
  return { status: "SAVED" };
}

/** Replaces the 시그니처 두산 settings (이름 · 모드 · 두산 시그니처 · 완주 보너스 · 시그니처 후원으로 올리기 · 대기 화면). */
export async function saveSigDosan(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseSigDosanSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds());
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.sigDosans ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** 두산 시작: a new board from the saved settings (replacing the one there). `requestId`: a retried start is not a new board. */
export async function startSigDosan(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const message = startSigDosanBoard(live, v.requestId);
  return message ? { status: "INVALID", message } : { status: "SAVED" };
}

/** 수동 한 단 올리기 · 내리기 (`up`) of `lane`, for `memberId` or none. `requestId` · `count`: a retry moves it no further. */
export async function stepSigDosan(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const message = stepSigDosanLane(live, { lane: v.lane, up: v.up, memberId: v.memberId, count: v.count, requestId: v.requestId });
  return message ? { status: "INVALID", message } : { status: "SAVED" };
}

/** 판 비우기: removes the board. Clearing nothing is a no-op. */
export async function clearSigDosan(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== rec(input).broadcastId) return notLive;
  clearSigDosanBoard(live);
  return { status: "SAVED" };
}

/** Replaces the 알파벳 모으기 settings (이름 · 단어 · 꽝 비율 · 상품 · 단어판 테마 · 자동 · 제외 시그 · 대기 화면). */
export async function saveAlphabet(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const known = alphabetSettingsOf(STUDIO_CHANNEL).prizes.map((p) => p.id);
  const parsed = parseAlphabetSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds(), known);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.alphabets ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** 단어판 비우기: `memberId`'s board, or everyone's (null). Emptying an empty board is a no-op. */
export async function resetAlphabet(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (v.memberId !== null && typeof v.memberId !== "string") return { status: "INVALID", message: "멤버를 다시 골라 주세요." };
  resetAlphabetBoard(live, v.memberId);
  return { status: "SAVED" };
}

/** Replaces the 고스톱 settings (이름 · 적립률 · STOP 확률 · 최대 · 배수 · 색 구간 · 제외 BJ · 자동 · 제외 시그 · 대기 화면). */
export async function saveGoStop(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const memberIds = (mockCrew.crews[STUDIO_CHANNEL] ?? []).map((m) => m.id);
  const known = goStopSettingsOf(STUDIO_CHANNEL).bands.map((b) => b.id);
  const parsed = parseGoStopSettings(input, MOCK_FORBIDDEN_WORDS, signatureIds(), memberIds, known);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.gostops ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** 풀 비우기: the 풀 and GO count start over, no one taking it. */
export async function resetGoStop(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== rec(input).broadcastId) return notLive;
  resetGoStopPool(live);
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
  if (game === "MEDLEY") return { status: "INVALID", message: "메들리는 'OBS에서 한 번 돌리기'로 돌려요." };
  if (game === "SIG_BINGO") return { status: "INVALID", message: "시그 빙고는 시그니처 후원이나 칸 누르기로 열어요." };
  if (game === "GRID_DRAW") return { status: "INVALID", message: "뽑기판은 후원이나 칸 누르기로 열어요." };
  if (game === "SIG_HUNTER") return { status: "INVALID", message: "시그니처 헌터는 시그니처 후원이나 슬롯 누르기로 SOLD OUT 돼요." };
  if (game === "SIG_DOSAN") return { status: "INVALID", message: "시그니처 두산은 시그니처 후원이나 한 단 올리기로 올라가요." };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const previous = (live.gameRuns ?? []).find((r) => r.id === v.requestId);
  if (previous) return { status: "PLAYED", run: gameRunView(live, previous) };
  if (game === "SPIN" && !spinSettingsOf(STUDIO_CHANNEL).items.length) return { status: "INVALID", message: "먼저 스핀머신 칸을 만들어 주세요." };
  if (game === "ALPHABET" && !alphabetSettingsOf(STUDIO_CHANNEL).word) return { status: "INVALID", message: "먼저 알파벳 모으기 단어를 정해 주세요." };
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
