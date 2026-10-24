import {
  CUMULATIVE_ROWS,
  DEFAULT_CUMULATIVE,
  PRIZE_PLACEMENTS,
  PRIZE_TITLE_MAX,
  type CumulativeLive,
  type CumulativeRow,
  type CumulativeSettings,
  type ScoreRow
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 누적 기여도 (server-only) — code-first, StreamDonate "누적 기여도(프리셋 모든 회차 누적 금액 · 기여도 오버레이)" 참고
 * (프리셋 = 프로젝트). Each member's final scores of the project's ended 회차 plus the live scoreboard. Display points only.
 */

export const cumulativeSettingsOf = (channelId: string): CumulativeSettings => mockCrew.cumulatives?.[channelId] ?? DEFAULT_CUMULATIVE;

/** A member no longer in the crew keeps the name of their last 회차, in a neutral color. */
const REMOVED_COLOR = "#9ca3af";

export function parseCumulative(input: unknown, forbidden: string[]): CumulativeSettings | { message: string } {
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (title.length > PRIZE_TITLE_MAX) return { message: `제목은 ${PRIZE_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (forbidden.some((w) => title.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  const rows = CUMULATIVE_ROWS.find((n) => n === v.rows);
  if (!rows) return { message: "보여 줄 멤버 수를 골라 주세요." };
  const placement = PRIZE_PLACEMENTS.find((p) => p.key === v.placement)?.key;
  if (!placement) return { message: "배치를 골라 주세요." };
  if (typeof v.showBreakdown !== "boolean" || typeof v.showRounds !== "boolean") return { message: "표시 설정을 확인해 주세요." };
  return { title, rows, showBreakdown: v.showBreakdown, showRounds: v.showRounds, placement };
}

/** The ended 회차 of `b`'s project before it, oldest first (none without a project). */
export const earlierRounds = (b: MockBroadcast) =>
  b.project ? (mockCrew.broadcasts ?? []).filter((x) => x !== b && x.channelId === b.channelId && x.project === b.project && x.endedAt && x.final).sort((x, y) => x.startedAt.localeCompare(y.startedAt)) : [];

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
  for (const r of rounds) for (const f of r.final ?? []) entry(f.memberId, f.name).past += f.score;
  for (const r of scoreboard) entry(r.memberId, r.name).current += r.score;
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
    total: rows.reduce((s, r) => s + r.total, 0)
  };
}
