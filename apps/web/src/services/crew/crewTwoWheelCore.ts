import { drawIndex, effectPoints, gameRunsView, parseGameCommon, recordRun, signatureTrigger, type RunStart, type StoredRun } from "./crewGameCore";
import {
  DEFAULT_TWO_WHEEL,
  TWO_WHEEL_PLUS_MAX,
  TWO_WHEEL_TIMES_MAX,
  TWO_WHEEL_UNIT_MAX,
  TWO_WHEEL_WEIGHT_MAX,
  type TwoWheelLive,
  type TwoWheelSettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 투휠 게임 (server-only) — code-first, StreamDonate 투휠 참고 (P2, a game on crewGameCore). An operator reel (+ / ×) and a
 * number reel, both drawn on the server with the creator's odds: +n adds n × the +1 unit, ×n multiplies the 기준 후원.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const weights = (v: unknown, length: number): v is number[] => Array.isArray(v) && v.length === length && v.every((w) => isInt(w, 0, TWO_WHEEL_WEIGHT_MAX));
const total = (ws: number[]) => ws.reduce((s, w) => s + w, 0);

/** The channel's 투휠 게임 settings (defaults until saved). */
export const twoWheelSettingsOf = (channelId: string): TwoWheelSettings => mockCrew.twoWheels?.[channelId] ?? DEFAULT_TWO_WHEEL;

/** Validates the settings: weights 0 ~ 100, and every operator that can come up has a number that can. */
export function parseTwoWheelSettings(input: unknown, forbidden: string[], signatureIds: string[]): TwoWheelSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  const range = `확률 가중치는 0 ~ ${TWO_WHEEL_WEIGHT_MAX} 사이 정수예요.`;
  if (!isInt(v.plusWeight, 0, TWO_WHEEL_WEIGHT_MAX) || !isInt(v.timesWeight, 0, TWO_WHEEL_WEIGHT_MAX)) return { message: range };
  if (v.plusWeight + v.timesWeight === 0) return { message: "+ 와 × 중 하나는 나올 수 있어야 해요." };
  if (!weights(v.plusWeights, TWO_WHEEL_PLUS_MAX) || !weights(v.timesWeights, TWO_WHEEL_TIMES_MAX)) return { message: range };
  if (v.plusWeight > 0 && total(v.plusWeights) === 0) return { message: "+ 가 나올 수 있으면 + 숫자도 하나는 나올 수 있어야 해요." };
  if (v.timesWeight > 0 && total(v.timesWeights) === 0) return { message: "× 가 나올 수 있으면 × 숫자도 하나는 나올 수 있어야 해요." };
  if (!isInt(v.plusUnit, 1, TWO_WHEEL_UNIT_MAX)) return { message: `+1 점수는 1 ~ ${TWO_WHEEL_UNIT_MAX.toLocaleString("ko-KR")}점이에요.` };
  return { ...common, plusWeight: v.plusWeight, timesWeight: v.timesWeight, plusWeights: [...v.plusWeights], timesWeights: [...v.timesWeights], plusUnit: v.plusUnit };
}

/** Spins both reels and queues the run on OBS `?twowheel`. */
export function runTwoWheel(b: MockBroadcast, start: RunStart, now = Date.now()): StoredRun {
  const s = twoWheelSettingsOf(b.channelId);
  const op = drawIndex([s.plusWeight, s.timesWeight]) === 0 ? "ADD" : "MULTIPLY";
  const n = drawIndex(op === "ADD" ? s.plusWeights : s.timesWeights) + 1;
  const value = op === "ADD" ? n * s.plusUnit : n;
  return recordRun(
    b,
    { ...start, game: "TWO_WHEEL", itemId: null, wheel: { op, n }, label: `${op === "ADD" ? "+" : "×"}${n}`, kind: op, value, points: effectPoints(op, value, start.basePoints) },
    now
  );
}

/** 자동 (crewGameTriggers): once per 시그니처 후원 to a member while 자동 is on. */
export function twoWheelForSignature(channelId: string, input: Parameters<typeof signatureTrigger>[3]) {
  const t = signatureTrigger(channelId, "TWO_WHEEL", twoWheelSettingsOf(channelId), input);
  if (t) runTwoWheel(t.live, t.start);
}

export const twoWheelLive = (b: MockBroadcast): TwoWheelLive => ({ settings: structuredClone(twoWheelSettingsOf(b.channelId)), runs: gameRunsView(b, "TWO_WHEEL") });
