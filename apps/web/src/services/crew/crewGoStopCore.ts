import { randomInt, randomUUID } from "node:crypto";
import { extraPoints, parseMultiplier } from "./crewCore";
import { gameRunsView, parseGameCommon, recordRun, signatureTrigger, type RunStart, type StoredRun } from "./crewGameCore";
import {
  DEFAULT_GOSTOP,
  GOSTOP_BANDS_MAX,
  GOSTOP_BAND_MIN_MAX,
  GOSTOP_MULTIPLIER_MAX,
  GOSTOP_POOL_PERCENT_MAX,
  GOSTOP_RATE_MAX,
  type GoStopBand,
  type GoStopLive,
  type GoStopSettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 고스톱 (server-only) — code-first, StreamDonate 고스톱 참고 (a game on crewGameCore). A 시그니처 후원 to a member (자동,
 * not from a 제외 BJ) or the operator's 수동 run on a 기준 후원 adds 적립률 of its points to the crew's 풀, then rolls STOP
 * (STOP 확률 per 1,000 of its points, up to the 최대). GO counts on; STOP gives that member the 풀 × 배수 and the 풀 starts
 * over. STOP runs make the 랭킹.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** The channel's 고스톱 settings (defaults until saved). */
export const goStopSettingsOf = (channelId: string): GoStopSettings => mockCrew.gostops?.[channelId] ?? DEFAULT_GOSTOP;

/**
 * Validates the settings. `memberIds`: the crew (제외 BJ must be among them); `knownBands`: the saved 색 구간 ids (kept). 색
 * 구간 are kept from the lowest 풀 up.
 */
export function parseGoStopSettings(input: unknown, forbidden: string[], signatureIds: string[], memberIds: string[], knownBands: string[]): GoStopSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  if (!isInt(v.poolPercent, 1, GOSTOP_POOL_PERCENT_MAX)) return { message: `적립률은 1 ~ ${GOSTOP_POOL_PERCENT_MAX}%예요.` };
  const stopRate = parseMultiplier(v.stopRate, GOSTOP_RATE_MAX);
  if (stopRate === null) return { message: `STOP 확률은 1,000점당 0.01 ~ ${GOSTOP_RATE_MAX}%, 소수 둘째 자리까지예요.` };
  if (!isInt(v.stopMax, 1, 100)) return { message: "최대 STOP 확률은 1 ~ 100%예요." };
  const multiplier = parseMultiplier(v.multiplier, GOSTOP_MULTIPLIER_MAX);
  if (multiplier === null || multiplier < 1) return { message: `STOP 배수는 1 ~ ${GOSTOP_MULTIPLIER_MAX}배, 소수 둘째 자리까지예요.` };
  if (!Array.isArray(v.bands) || v.bands.length > GOSTOP_BANDS_MAX) return { message: `색 구간은 ${GOSTOP_BANDS_MAX}개까지 만들 수 있어요.` };
  const bands: GoStopBand[] = [];
  for (const raw of v.bands) {
    const x = rec(raw);
    if (!isInt(x.min, 0, GOSTOP_BAND_MIN_MAX) || typeof x.color !== "string" || !/^#[0-9a-f]{6}$/i.test(x.color)) return { message: "색 구간의 최소 풀과 색을 확인해 주세요." };
    if (bands.some((b) => b.min === x.min)) return { message: "색 구간의 최소 풀이 겹쳐요." };
    const keep = typeof x.id === "string" && knownBands.includes(x.id) && !bands.some((b) => b.id === x.id);
    bands.push({ id: keep ? (x.id as string) : `gb-${randomUUID().slice(0, 8)}`, min: x.min, color: x.color.toLowerCase() });
  }
  if (!Array.isArray(v.excludedMembers) || v.excludedMembers.some((id) => typeof id !== "string" || !memberIds.includes(id))) return { message: "제외 BJ를 확인해 주세요." };
  return {
    ...common,
    poolPercent: v.poolPercent,
    stopRate,
    stopMax: v.stopMax,
    multiplier,
    bands: bands.sort((x, y) => x.min - y.min),
    excludedMembers: [...new Set(v.excludedMembers as string[])]
  };
}

/** The STOP 확률 of a donation worth `points`, per million: STOP 확률 % per 1,000 points, up to the 최대. */
export const goStopChance = (s: Pick<GoStopSettings, "stopRate" | "stopMax">, points: number) => Math.min(s.stopMax * 10_000, Math.round(points * s.stopRate * 10));

/** Adds the 기준 후원 to the 풀 and rolls GO or STOP for `start.memberId` (server randomness); queued on OBS `?gostop`. */
export function runGoStop(b: MockBroadcast, start: RunStart, now = Date.now()): StoredRun {
  const s = goStopSettingsOf(b.channelId);
  const st = (b.gostop ??= { pool: 0, go: 0 });
  st.pool += Math.round((start.basePoints * s.poolPercent) / 100);
  const chance = goStopChance(s, start.basePoints);
  if (chance > 0 && randomInt(1_000_000) < chance) {
    const points = st.pool + extraPoints(st.pool, s.multiplier);
    const run = recordRun(b, { ...start, game: "GOSTOP", itemId: null, label: "STOP!", kind: "ADD", value: points, points, gostop: { pool: st.pool, go: st.go, chance } }, now);
    b.gostop = { pool: 0, go: 0 };
    return run;
  }
  st.go += 1;
  return recordRun(b, { ...start, game: "GOSTOP", itemId: null, label: `${st.go} GO`, kind: "TEXT", value: 0, points: 0, gostop: { pool: st.pool, go: st.go, chance } }, now);
}

/** 자동 (crewGameTriggers): once per 시그니처 후원 to a member who is no 제외 BJ, while 자동 is on. */
export function goStopForSignature(channelId: string, input: Parameters<typeof signatureTrigger>[3]) {
  const s = goStopSettingsOf(channelId);
  if (input.memberId && s.excludedMembers.includes(input.memberId)) return;
  const t = signatureTrigger(channelId, "GOSTOP", s, input);
  if (t) runGoStop(t.live, t.start);
}

/** 풀 비우기: the 풀 and GO count start over (no one takes it). */
export function resetGoStopPool(b: MockBroadcast) {
  b.gostop = { pool: 0, go: 0 };
}

export function goStopLive(b: MockBroadcast): GoStopLive {
  const crew = mockCrew.crews[b.channelId] ?? [];
  return {
    settings: structuredClone(goStopSettingsOf(b.channelId)),
    runs: gameRunsView(b, "GOSTOP"),
    pool: b.gostop?.pool ?? 0,
    go: b.gostop?.go ?? 0,
    wins: (b.gameRuns ?? [])
      .filter((r) => r.game === "GOSTOP" && r.kind === "ADD" && r.gostop)
      .map((r) => {
        const m = crew.find((x) => x.id === r.memberId);
        return { memberId: r.memberId, name: m?.name ?? "삭제된 멤버", color: m?.color ?? null, points: r.points, pool: r.gostop!.pool, go: r.gostop!.go, at: r.at, revealAt: r.revealAt };
      })
  };
}
