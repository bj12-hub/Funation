import { randomInt } from "node:crypto";
import { gameRunsView, parseGameCommon, recordRun, signatureTrigger, type RunStart, type StoredRun } from "./crewGameCore";
import {
  DEFAULT_JACKPOT,
  JACKPOT_PERCENT_MAX,
  JACKPOT_SHOW_SEC_MAX,
  JACKPOT_TARGET_MAX,
  JACKPOT_TARGET_MIN,
  JACKPOT_TURN_MAX,
  JACKPOT_WINS_KEPT,
  jackpotRange,
  type JackpotLive,
  type JackpotSettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 시그니처 잭팟 (server-only) — code-first, StreamDonate 시그니처 잭팟 복주머니 모드 as a 점수 풀 (policy-decisions 2 (C),
 * 2026-11-01: no money moves). A 시그니처 후원 to a member (자동) adds 적립 비율 of its points to the 풀 and counts as the 풀's
 * next 순번; the one at the 당첨 순번 (drawn from 목표 개수 ± ⌊목표/6⌋) gives that member the 풀, and a new 풀 starts.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** The channel's 시그니처 잭팟 settings (defaults until saved). */
export const jackpotSettingsOf = (channelId: string): JackpotSettings => ({ ...DEFAULT_JACKPOT, ...mockCrew.jackpots?.[channelId] });

export function parseJackpotSettings(input: unknown, forbidden: string[], signatureIds: string[]): JackpotSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  if (!isInt(v.percent, 1, JACKPOT_PERCENT_MAX)) return { message: `적립 비율은 1 ~ ${JACKPOT_PERCENT_MAX}%예요.` };
  if (!isInt(v.target, JACKPOT_TARGET_MIN, JACKPOT_TARGET_MAX)) return { message: `목표 개수는 ${JACKPOT_TARGET_MIN} ~ ${JACKPOT_TARGET_MAX.toLocaleString("ko-KR")}번째예요.` };
  if (!isInt(v.showSec, 1, JACKPOT_SHOW_SEC_MAX)) return { message: `당첨 문구 표시 시간은 1 ~ ${JACKPOT_SHOW_SEC_MAX}초예요.` };
  return { ...common, percent: v.percent, target: v.target, showSec: v.showSec };
}

/** A 당첨 순번 for `target` (server randomness), never at or below `count` (the 순번 already reached). */
export function drawJackpotTurn(target: number, count = 0) {
  const [lo, hi] = jackpotRange(target);
  return Math.max(count + 1, randomInt(lo, hi + 1));
}

/** The broadcast's 풀 (a new one for the first 시그니처 후원). */
function poolOf(b: MockBroadcast, now: number) {
  return (b.jackpot ??= { pool: 0, count: 0, turn: drawJackpotTurn(jackpotSettingsOf(b.channelId).target), startedAt: new Date(now).toISOString() });
}

/** How full the 복주머니 looks: the share of the way to the 당첨 순번, in tenths (OBS never gets the 순번 itself). */
export const jackpotFill = (count: number, turn: number) => Math.min(1, Math.floor((count / turn) * 10) / 10);

/** One 시그니처 후원 into the 풀: its share added and counted; at the 당첨 순번 the member takes the 풀 and a new one starts. */
export function runJackpot(b: MockBroadcast, start: RunStart, now = Date.now()): StoredRun {
  const s = jackpotSettingsOf(b.channelId);
  const st = poolOf(b, now);
  const added = Math.round((start.basePoints * s.percent) / 100);
  st.pool += added;
  st.count += 1;
  if (st.count >= st.turn) {
    const won = { pool: st.pool, count: st.count, fill: 1, won: true };
    b.jackpot = { pool: 0, count: 0, turn: drawJackpotTurn(s.target), startedAt: new Date(now).toISOString() };
    return recordRun(b, { ...start, game: "JACKPOT", itemId: null, label: "잭팟 당첨!", kind: "ADD", value: won.pool, points: won.pool, jackpot: won }, now);
  }
  return recordRun(
    b,
    { ...start, game: "JACKPOT", itemId: null, label: `${st.count}번째 · 풀 +${added.toLocaleString("ko-KR")}`, kind: "TEXT", value: 0, points: 0, jackpot: { pool: st.pool, count: st.count, fill: jackpotFill(st.count, st.turn), won: false } },
    now
  );
}

/** 자동 (crewGameTriggers): once per 시그니처 후원 to a member, while 자동 is on. */
export function jackpotForSignature(channelId: string, input: Parameters<typeof signatureTrigger>[3]) {
  const t = signatureTrigger(channelId, "JACKPOT", jackpotSettingsOf(channelId), input);
  if (t) runJackpot(t.live, t.start);
}

/** 풀 새로 시작 (리셋): the 풀 starts over from 0 with a new 당첨 순번 — no one takes it. */
export function resetJackpotPool(b: MockBroadcast, now = Date.now()) {
  b.jackpot = { pool: 0, count: 0, turn: drawJackpotTurn(jackpotSettingsOf(b.channelId).target), startedAt: new Date(now).toISOString() };
}

/** 목표 개수 changed (적용 + 랜덤 재설정): the 풀 keeps its points and count and gets a new 당첨 순번 past the count. */
export function redrawJackpotTurn(b: MockBroadcast) {
  if (b.jackpot) b.jackpot.turn = drawJackpotTurn(jackpotSettingsOf(b.channelId).target, b.jackpot.count);
}

/** 당첨 순번 수기 (수동 설정): a 순번 past the count so far, up to JACKPOT_TURN_MAX. Returns an error message, or null. */
export function setJackpotTurn(b: MockBroadcast, turn: unknown, now = Date.now()): string | null {
  const st = poolOf(b, now);
  if (!isInt(turn, st.count + 1, JACKPOT_TURN_MAX)) return `당첨 순번은 ${(st.count + 1).toLocaleString("ko-KR")} ~ ${JACKPOT_TURN_MAX.toLocaleString("ko-KR")}번째예요(이번 풀은 지금 ${st.count.toLocaleString("ko-KR")}번째).`;
  st.turn = turn;
  return null;
}

/**
 * `studio`: the 당첨 순번 is for the studio only — OBS gets how full the 복주머니 looks (`fill`). `wins`: the 당첨 기록,
 * newest first (JACKPOT_WINS_KEPT).
 */
export function jackpotLive(b: MockBroadcast, studio: boolean): JackpotLive {
  const s = jackpotSettingsOf(b.channelId);
  const crew = mockCrew.crews[b.channelId] ?? [];
  const st = b.jackpot;
  return {
    settings: structuredClone(s),
    runs: gameRunsView(b, "JACKPOT"),
    pool: st?.pool ?? 0,
    count: st?.count ?? 0,
    fill: st ? jackpotFill(st.count, st.turn) : 0,
    turn: studio ? (st?.turn ?? null) : null,
    startedAt: st?.startedAt ?? null,
    wins: (b.gameRuns ?? [])
      .filter((r) => r.game === "JACKPOT" && r.jackpot?.won)
      .reverse()
      .slice(0, JACKPOT_WINS_KEPT)
      .map((r) => {
        const m = crew.find((x) => x.id === r.memberId);
        return { memberId: r.memberId, name: m?.name ?? "삭제된 멤버", color: m?.color ?? null, points: r.points, count: r.jackpot!.count, at: r.at, revealAt: r.revealAt };
      })
  };
}
