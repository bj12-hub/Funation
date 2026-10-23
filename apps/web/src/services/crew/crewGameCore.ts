import { randomInt } from "node:crypto";
import { excelOf, feedOf, scoreEntry, scoreFn } from "./crewCore";
import type { GameKey, GameRunView, GameSource } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 점수 게임 engine (server-only) — code-first, StreamDonate 참고 (P2). Every game runs the same way: a trigger (a 시그니처
 * 후원 to a member, or the operator) → a draw on the server → points from the result (배수 on the 기준 후원 · 가산 · none)
 * → a run record queued on OBS. A run's points count on the boards once its result shows (crewCore.gameRunCounts).
 * Points are display scores only: no FN, wallet, earnings or settlement moves.
 */

export type StoredRun = NonNullable<MockBroadcast["gameRuns"]>[number];

/** The drawn index for positive integer weights (server randomness; the browser only animates to it). */
export function drawIndex(weights: number[]): number {
  let roll = randomInt(weights.reduce((s, w) => s + w, 0));
  return weights.findIndex((w) => (roll -= w) < 0);
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
 * Records a run, queued on OBS: it starts `leadSec` after it is drawn or once the game's previous run is over (each takes
 * `reelSec` + `resultSec`). The reel starts at `showAt`, and the result — with its points — shows at `revealAt`.
 */
export function recordRun(b: MockBroadcast, run: Omit<StoredRun, "showAt" | "revealAt">, timing: { leadSec: number; reelSec: number; resultSec: number }): StoredRun {
  const runs = (b.gameRuns ??= []);
  const prev = runs.filter((r) => r.game === run.game).at(-1);
  const at = Date.parse(run.at);
  const show = Math.max(at + timing.leadSec * 1000, prev ? Date.parse(prev.showAt) + (timing.reelSec + timing.resultSec) * 1000 : 0);
  const stored = { ...run, showAt: new Date(show).toISOString(), revealAt: new Date(show + timing.reelSec * 1000).toISOString() };
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
    memberName: m?.name ?? "삭제된 멤버",
    memberColor: m?.color ?? null,
    trigger: r.trigger.kind === "SIGNATURE" ? { kind: "SIGNATURE", signatureName: r.trigger.signatureName } : { kind: "MANUAL" },
    basePoints: r.basePoints,
    itemId: r.itemId,
    label: r.label,
    kind: r.kind,
    value: r.value,
    points: r.points
  };
}
