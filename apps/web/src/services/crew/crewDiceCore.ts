import { drawIndex, effectPoints, gameRunsView, parseGameCommon, recordRun, signatureTrigger, type RunStart, type StoredRun } from "./crewGameCore";
import { DEFAULT_DICE, DICE_RULES, diceMultiplier, type DiceLive, type DiceSettings } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 주사위 게임 (server-only) — code-first, StreamDonate 주사위 게임 참고 (P2, a game on crewGameCore). Two dice per run,
 * rolled on the server; the chosen rule (룰 1 · 룰 2) turns them into a 배수 on the 기준 후원's points.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

/** The channel's 주사위 게임 settings (defaults until saved). */
export const diceSettingsOf = (channelId: string): DiceSettings => mockCrew.diceGames?.[channelId] ?? DEFAULT_DICE;

export function parseDiceSettings(input: unknown, forbidden: string[], signatureIds: string[]): DiceSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const rule = DICE_RULES.find((r) => r.key === rec(input).rule)?.key;
  if (!rule) return { message: "룰을 골라 주세요." };
  return { ...common, rule };
}

/** One die, 1 ~ 6. */
const rollDie = () => drawIndex([1, 1, 1, 1, 1, 1]) + 1;

/** Rolls two dice and queues the run on OBS `?dice`. */
export function runDice(b: MockBroadcast, start: RunStart, now = Date.now()): StoredRun {
  const dice: [number, number] = [rollDie(), rollDie()];
  const m = diceMultiplier(diceSettingsOf(b.channelId).rule, ...dice);
  const label = `${dice[0]} + ${dice[1]}${dice[0] === dice[1] ? " 더블" : ""}`;
  return recordRun(b, { ...start, game: "DICE", itemId: null, dice, label, kind: "MULTIPLY", value: m, points: effectPoints("MULTIPLY", m, start.basePoints) }, now);
}

/** 자동 (crewGameTriggers): once per 시그니처 후원 to a member while 자동 is on. */
export function diceForSignature(channelId: string, input: Parameters<typeof signatureTrigger>[3]) {
  const t = signatureTrigger(channelId, "DICE", diceSettingsOf(channelId), input);
  if (t) runDice(t.live, t.start);
}

export const diceLive = (b: MockBroadcast): DiceLive => ({ settings: structuredClone(diceSettingsOf(b.channelId)), runs: gameRunsView(b, "DICE") });
