import { baseAmount, excelOf, feedOf } from "./crewCore";
import {
  CUMULATIVE_ROWS,
  DEFAULT_CUMULATIVE,
  PRIZE_PLACEMENTS,
  PRIZE_TITLE_MAX,
  WINDOW_GAUGE_BASES,
  type CumulativeLive,
  type CumulativeRow,
  type CumulativeSettings,
  type ScoreRow
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 누적 기여도 (server-only) — code-first, StreamDonate "누적 기여도(프리셋 모든 회차 누적 금액 · 기여도 오버레이)" 참고
 * (프리셋 = 프로젝트). Each member's final scores of the project's ended 회차 plus the live scoreboard — or, on 후원금, what
 * they received in each 회차 (2026-10-25). Display numbers only.
 */

/** Settings saved before 집계 기준 (2026-10-25) read as 기여도. */
export const cumulativeSettingsOf = (channelId: string): CumulativeSettings => ({ ...DEFAULT_CUMULATIVE, ...mockCrew.cumulatives?.[channelId] });

/** A member no longer in the crew keeps the name of their last 회차, in a neutral color. */
const REMOVED_COLOR = "#9ca3af";

export function parseCumulative(input: unknown, forbidden: string[]): CumulativeSettings | { message: string } {
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (title.length > PRIZE_TITLE_MAX) return { message: `제목은 ${PRIZE_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (forbidden.some((w) => title.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  // A screen from before 집계 기준 sends none: 기여도, as before.
  const basis = v.basis === undefined ? "POINTS" : WINDOW_GAUGE_BASES.find((b) => b.key === v.basis)?.key;
  if (!basis) return { message: "집계 기준을 골라 주세요." };
  const rows = CUMULATIVE_ROWS.find((n) => n === v.rows);
  if (!rows) return { message: "보여 줄 멤버 수를 골라 주세요." };
  const placement = PRIZE_PLACEMENTS.find((p) => p.key === v.placement)?.key;
  if (!placement) return { message: "배치를 골라 주세요." };
  if (typeof v.showBreakdown !== "boolean" || typeof v.showRounds !== "boolean") return { message: "표시 설정을 확인해 주세요." };
  return { title, basis, rows, showBreakdown: v.showBreakdown, showRounds: v.showRounds, placement };
}

/** The ended 회차 of `b`'s project before it, oldest first (none without a project). */
export const earlierRounds = (b: MockBroadcast) =>
  b.project ? (mockCrew.broadcasts ?? []).filter((x) => x !== b && x.channelId === b.channelId && x.project === b.project && x.endedAt && x.final).sort((x, y) => x.startedAt.localeCompare(y.startedAt)) : [];

/**
 * 후원금 per member in one broadcast: their 멤버 지정 후원 and the 후원 리스트 entries assigned to them, in the channel's
 * 자동엑셀 unit (today's 환산값; a unit without one adds nothing), before 배수 — the 후원금 of 시간 내 통합 게이지, by member.
 */
function amountsOf(b: MockBroadcast): Map<string, number> {
  const s = excelOf(b.channelId);
  const end = b.endedAt ?? new Date(Date.now() + 1000).toISOString();
  const out = new Map<string, number>();
  const add = (id: string, v: number | null) => out.set(id, (out.get(id) ?? 0) + (v ?? 0));
  for (const a of mockCrew.attributions) if (a.channelId === b.channelId && a.at >= b.startedAt && a.at <= end) add(a.memberId, baseAmount(a.fnAmount, "FN", s));
  for (const f of feedOf(b)) if (f.status === "ASSIGNED" && f.memberId) add(f.memberId, baseAmount(f.amount, f.unit, s));
  return out;
}

/**
 * The board of a live broadcast. `scoreboard`: its main scoreboard rows (the current 회차). Members are everyone with a
 * row now or a final score in an earlier 회차; ranked by total, ties by name.
 */
export function cumulativeLive(b: MockBroadcast, scoreboard: ScoreRow[]): CumulativeLive {
  const settings = cumulativeSettingsOf(b.channelId);
  const crew = new Map((mockCrew.crews[b.channelId] ?? []).map((m) => [m.id, m]));
  const rounds = earlierRounds(b);
  const acc = new Map<string, { name: string; past: number; current: number }>();
  const entry = (id: string, name: string) => acc.get(id) ?? acc.set(id, { name: crew.get(id)?.name ?? name, past: 0, current: 0 }).get(id)!;
  if (settings.basis === "AMOUNT") {
    // A member no longer in the crew keeps the name of a 회차 they were on the board of.
    const names = new Map(rounds.flatMap((r) => (r.final ?? []).map((f) => [f.memberId, f.name] as const)));
    const named = (id: string) => entry(id, names.get(id) ?? "삭제된 멤버");
    for (const r of rounds) for (const [id, v] of amountsOf(r)) named(id).past += v;
    for (const r of scoreboard) entry(r.memberId, r.name);
    for (const [id, v] of amountsOf(b)) named(id).current += v;
    for (const a of acc.values()) {
      a.past = Math.round(a.past);
      a.current = Math.round(a.current);
    }
  } else {
    for (const r of rounds) for (const f of r.final ?? []) entry(f.memberId, f.name).past += f.score;
    for (const r of scoreboard) entry(r.memberId, r.name).current += r.score;
  }
  const rows: CumulativeRow[] = [...acc]
    .map(([memberId, a]) => ({ memberId, name: a.name, color: crew.get(memberId)?.color ?? REMOVED_COLOR, rank: 0, past: a.past, current: a.current, total: a.past + a.current }))
    .sort((x, y) => y.total - x.total || x.name.localeCompare(y.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return {
    settings: structuredClone(settings),
    visible: !!b.cumulative?.visible,
    project: b.project ?? null,
    rounds: rounds.length + 1,
    rows,
    total: rows.reduce((s, r) => s + r.total, 0),
    unit: settings.basis === "POINTS" ? "점" : excelOf(b.channelId).unit === "KRW" ? "원" : "FN"
  };
}
