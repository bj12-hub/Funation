import { randomInt, randomUUID } from "node:crypto";
import { mockSignatures } from "@/services/donations/signatureCore";
import { SIGNATURE_LIMITS } from "@/services/donations/signatureTypes";
import { excelOf, extraPoints, feedOf, isActiveMember, liveBroadcastOf, parseMultiplier, scoreEntry, scoreFn } from "./crewCore";
import {
  AMOUNT_TIERS_MAX,
  AMOUNT_TIER_MULTIPLIER_MAX,
  GAMES,
  GAME_LEAD_SEC,
  GAME_RUNS_SHOWN,
  GAME_TIMING,
  GAME_TITLE_MAX,
  type AmountTier,
  type GameCommon,
  type GameEffect,
  type GameKey,
  type GameRunView,
  type GameSource
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 점수 게임 engine (server-only) — code-first, StreamDonate 참고 (P2). Every game runs the same way: a trigger (a 시그니처
 * 후원 to a member, or the operator) → a draw on the server → points from the result (배수 on the 기준 후원 · 가산 · none)
 * → a run record queued on the game's OBS view. A run's points count on the boards once its result shows
 * (crewCore.gameRunCounts). Points are display scores only: no FN, wallet, earnings or settlement moves.
 */

export type StoredRun = NonNullable<MockBroadcast["gameRuns"]>[number];
/** What starts a run: its id, member, trigger and 기준 후원 (the game adds what it drew). */
export type RunStart = Pick<StoredRun, "id" | "memberId" | "trigger" | "sourceId" | "basePoints">;

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

/** The drawn index for integer weights ≥ 0 with a positive total (server randomness; the browser only animates to it). */
export function drawIndex(weights: number[]): number {
  let roll = randomInt(weights.reduce((s, w) => s + w, 0));
  return weights.findIndex((w) => (roll -= w) < 0);
}

/** Points a result adds for a 기준 후원 worth `base` points (배수: (배수 − 1) × base, rounded once). */
export const effectPoints = (kind: GameEffect, value: number, base: number) => (kind === "MULTIPLY" ? extraPoints(base, value) : kind === "ADD" ? value : 0);

/**
 * Validates what every game has (title · 자동 · 제외 시그니처 · 대기 화면). `signatureIds`: the signatures that exist (제외
 * must be among them). The title is checked against the 금지어 (it is shown on stream).
 */
export function parseGameCommon(input: unknown, forbidden: string[], signatureIds: string[]): GameCommon | { message: string } {
  const v = rec(input);
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (title.length > GAME_TITLE_MAX) return { message: `제목은 ${GAME_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (title && forbidden.some((w) => title.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (!Array.isArray(v.excluded) || v.excluded.some((id) => typeof id !== "string" || !signatureIds.includes(id))) return { message: "제외할 시그니처를 확인해 주세요." };
  if (typeof v.auto !== "boolean" || typeof v.showIdle !== "boolean") return { message: "설정을 확인해 주세요." };
  return { title, auto: v.auto, excluded: [...new Set(v.excluded as string[])], showIdle: v.showIdle };
}

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/**
 * Validates 금액 구간 (기여도 릴레이 · 줍줍 배수 모드): `min` FN or more up to `max` (null = 이상), × a 배수 above 1. Order is
 * kept (the first matching 구간 wins). `knownIds`: the saved ids (kept); any other id gets one with `prefix`.
 */
export function parseAmountTiers(raw: unknown, knownIds: string[], prefix: string): AmountTier[] | { message: string } {
  const { priceMax } = SIGNATURE_LIMITS;
  if (!Array.isArray(raw) || raw.length > AMOUNT_TIERS_MAX) return { message: `금액 구간은 ${AMOUNT_TIERS_MAX}개까지 만들 수 있어요.` };
  const tiers: AmountTier[] = [];
  for (const item of raw) {
    const t = rec(item);
    if (!isInt(t.min, 0, priceMax) || (t.max !== null && !isInt(t.max, t.min, priceMax))) return { message: "금액 구간을 확인해 주세요. 최대는 최소 이상이고, 비우면 '이상'이에요." };
    const multiplier = parseMultiplier(t.multiplier, AMOUNT_TIER_MULTIPLIER_MAX);
    if (multiplier === null || multiplier <= 1) return { message: `배수는 1보다 크고 ${AMOUNT_TIER_MULTIPLIER_MAX}배 이하, 소수 둘째 자리까지예요.` };
    const keep = typeof t.id === "string" && knownIds.includes(t.id) && !tiers.some((x) => x.id === t.id);
    tiers.push({ id: keep ? (t.id as string) : `${prefix}-${randomUUID().slice(0, 8)}`, min: t.min, max: t.max as number | null, multiplier });
  }
  return tiers;
}

/** Donations already used as the 기준 후원 of a run of `game`: each donation starts at most one run per game. */
export const usedSources = (b: MockBroadcast, game: GameKey) => new Set((b.gameRuns ?? []).flatMap((r) => (r.game === game && r.sourceId ? [r.sourceId] : [])));

/**
 * What `memberId` received in the broadcast, newest first: donations sent to them and 후원 리스트 entries assigned to
 * them, with their points under the current 자동엑셀 settings. Labels are the names as sent (studio only).
 */
export function memberSources(b: MockBroadcast, memberId: string): GameSource[] {
  const s = excelOf(b.channelId);
  const end = b.endedAt ?? new Date(Date.now() + 1000).toISOString();
  const donations = mockCrew.attributions
    .filter((a) => a.channelId === b.channelId && a.memberId === memberId && a.at >= b.startedAt && a.at <= end)
    .map((a) => ({ id: a.donationId, at: a.at, label: a.donor ?? a.shownDonor, points: scoreFn(a.fnAmount, s) }));
  const listed = feedOf(b)
    .filter((f) => f.status === "ASSIGNED" && f.memberId === memberId)
    .map((f) => ({ id: f.id, at: f.at, label: f.donor, points: scoreEntry(f, s).points }));
  return [...donations, ...listed].sort((x, y) => y.at.localeCompare(x.at));
}

/**
 * 자동: a completed donation credited to a member starts a run of `game` when it alerted as a signature (a 시그니처 후원,
 * or a 일반 후원 matched by 금액 일치 · 금액범위), a crew broadcast is live, the game's 자동 is on and the signature is not
 * excluded. Returns the broadcast and how the run starts (the donation is the 기준 후원), or null.
 */
export function signatureTrigger(
  channelId: string,
  game: GameKey,
  settings: GameCommon,
  input: { donationId: string; memberId: string | null; signatureId: string | undefined; fnAmount: number }
): { live: MockBroadcast; start: RunStart } | null {
  const live = liveBroadcastOf(channelId);
  if (!live || !input.memberId || !input.signatureId || !settings.auto || settings.excluded.includes(input.signatureId)) return null;
  if (!isActiveMember(channelId, input.memberId) || usedSources(live, game).has(input.donationId)) return null;
  const signatureName = mockSignatures.items.find((x) => x.id === input.signatureId)?.name ?? "시그니처";
  return {
    live,
    start: {
      id: `${GAMES.find((g) => g.key === game)!.param}-${input.donationId}`,
      memberId: input.memberId,
      trigger: { kind: "SIGNATURE", signatureId: input.signatureId, signatureName },
      sourceId: input.donationId,
      basePoints: scoreFn(input.fnAmount, excelOf(channelId))
    }
  };
}

/**
 * Records a run, queued on its game's OBS view: it starts GAME_LEAD_SEC after it is drawn or once the game's previous run
 * is over (play + result). It plays from `showAt`, and the result — with its points — shows at `revealAt`.
 */
export function recordRun(b: MockBroadcast, run: Omit<StoredRun, "at" | "showAt" | "revealAt">, now = Date.now()): StoredRun {
  const runs = (b.gameRuns ??= []);
  const { playSec, resultSec } = GAME_TIMING[run.game];
  const prev = runs.filter((r) => r.game === run.game).at(-1);
  const show = Math.max(now + GAME_LEAD_SEC * 1000, prev ? Date.parse(prev.showAt) + (playSec + resultSec) * 1000 : 0);
  const stored = { ...run, at: new Date(now).toISOString(), showAt: new Date(show).toISOString(), revealAt: new Date(show + playSec * 1000).toISOString() };
  runs.push(stored);
  return stored;
}

/** A run with the member's name and color (a removed member keeps a placeholder). */
export function gameRunView(b: MockBroadcast, r: StoredRun): GameRunView {
  const m = (mockCrew.crews[b.channelId] ?? []).find((x) => x.id === r.memberId);
  return {
    id: r.id,
    game: r.game,
    at: r.at,
    showAt: r.showAt,
    revealAt: r.revealAt,
    memberId: r.memberId,
    memberName: r.memberId ? (m?.name ?? "삭제된 멤버") : "",
    memberColor: m?.color ?? null,
    // The signature id stays on the server.
    trigger: r.trigger.kind === "SIGNATURE" ? { kind: "SIGNATURE", signatureName: r.trigger.signatureName } : r.trigger,
    basePoints: r.basePoints,
    label: r.label,
    kind: r.kind,
    value: r.value,
    points: r.points,
    itemId: r.itemId,
    dice: r.dice ?? null,
    wheel: r.wheel ?? null,
    range: r.range ?? null,
    from: r.from ? { memberName: (mockCrew.crews[b.channelId] ?? []).find((x) => x.id === r.from!.memberId)?.name ?? "삭제된 멤버", amount: r.from.amount } : null
  };
}

/** The latest runs of a game, newest first. */
export const gameRunsView = (b: MockBroadcast, game: GameKey) =>
  (b.gameRuns ?? [])
    .filter((r) => r.game === game)
    .slice(-GAME_RUNS_SHOWN)
    .reverse()
    .map((r) => gameRunView(b, r));
