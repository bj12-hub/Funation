import { windowScores } from "./crewCore";
import {
  DEFAULT_PRIZE_BOARD,
  PRIZE_BASES,
  PRIZE_COLUMNS,
  PRIZE_PLACEMENTS,
  PRIZE_RANKS_MAX,
  PRIZE_TEXT_MAX,
  PRIZE_TITLE_MAX,
  type PrizeBoardLive,
  type PrizeBoardSettings,
  type PrizeRow,
  type RankPrize,
  type ScoreRow
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 상품 순위표 (server-only) — code-first, StreamDonate 랭킹(상품) · 시간 내 랭킹 참고. One board per channel: each rank gets
 * the creator's 상품 · 벌칙 line, scored on the main scoreboard or on a 시작 ~ 정지 구간. Prizes are text on stream
 * only: nothing is paid or moved (TBD: 상품 지급).
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The channel's 상품 순위표 settings (defaults until saved). */
export const prizeSettingsOf = (channelId: string): PrizeBoardSettings => mockCrew.prizeBoards?.[channelId] ?? DEFAULT_PRIZE_BOARD;

/**
 * Validates the settings. `memberIds`: the channel's crew (excluded and pinned members must be in it). A line without
 * text drops its color, and blank lines at the end are not kept.
 */
export function parsePrizeBoard(input: unknown, forbidden: string[], memberIds: string[]): PrizeBoardSettings | { message: string } {
  const v = rec(input);
  const title = text(v.title);
  if (title.length > PRIZE_TITLE_MAX) return { message: `제목은 ${PRIZE_TITLE_MAX}자 이내로 입력해 주세요.` };
  const basis = PRIZE_BASES.find((b) => b.key === v.basis)?.key;
  if (!basis) return { message: "집계 기준을 골라 주세요." };

  if (!Array.isArray(v.prizes) || v.prizes.length > PRIZE_RANKS_MAX) return { message: `상품 · 벌칙은 ${PRIZE_RANKS_MAX}등까지 적을 수 있어요.` };
  const prizes: RankPrize[] = [];
  for (const raw of v.prizes) {
    const p = rec(raw);
    const line = text(p.text);
    if (line.length > PRIZE_TEXT_MAX) return { message: `상품 · 벌칙은 등수마다 ${PRIZE_TEXT_MAX}자 이내로 입력해 주세요.` };
    if (p.color !== null && p.color !== undefined && !(typeof p.color === "string" && HEX_COLOR.test(p.color))) return { message: "글자색을 확인해 주세요." };
    prizes.push({ text: line, color: line && typeof p.color === "string" ? p.color.toLowerCase() : null });
  }
  while (prizes.length && !prizes[prizes.length - 1].text) prizes.pop();

  if (!Array.isArray(v.excluded) || v.excluded.some((id) => typeof id !== "string" || !memberIds.includes(id))) return { message: "순위에서 뺄 멤버를 확인해 주세요." };
  const excluded = [...new Set(v.excluded as string[])];

  let pinned: PrizeBoardSettings["pinned"] = null;
  if (v.pinned !== null && v.pinned !== undefined) {
    const p = rec(v.pinned);
    if (typeof p.memberId !== "string" || !memberIds.includes(p.memberId) || excluded.includes(p.memberId)) return { message: "상단 고정 멤버를 확인해 주세요." };
    const line = text(p.text);
    if (line.length > PRIZE_TEXT_MAX) return { message: `고정 문구는 ${PRIZE_TEXT_MAX}자 이내로 입력해 주세요.` };
    pinned = { memberId: p.memberId, text: line };
  }

  const columns = PRIZE_COLUMNS.find((c) => c === v.columns);
  if (!columns) return { message: "열 개수를 골라 주세요." };
  const placement = PRIZE_PLACEMENTS.find((p) => p.key === v.placement)?.key;
  if (!placement) return { message: "배치를 골라 주세요." };
  if (typeof v.showScore !== "boolean" || typeof v.showTotal !== "boolean") return { message: "표시 설정을 확인해 주세요." };

  // Everything here is shown on stream.
  const words = [title, pinned?.text ?? "", ...prizes.map((p) => p.text)].map((s) => s.toLowerCase());
  if (words.some((s) => forbidden.some((w) => s.includes(w)))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };

  return { title, basis, prizes, excluded, pinned, columns, showScore: v.showScore, showTotal: v.showTotal, placement };
}

type Scored = { memberId: string; name: string; color: string; score: number };

/**
 * The board: excluded members left out, the pinned member first (no rank), the rest by score — ties by name, as on the
 * scoreboard — numbered from 1, each with prizes[rank − 1] (none for a blank line or a rank past the list).
 */
export function prizeRows(members: Scored[], s: PrizeBoardSettings): { rows: PrizeRow[]; total: number } {
  const listed = members.filter((m) => !s.excluded.includes(m.memberId));
  const pinned = s.pinned ? listed.find((m) => m.memberId === s.pinned!.memberId) : undefined;
  const ranked = listed.filter((m) => m !== pinned).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const row = (m: Scored, rank: number | null, prize: RankPrize | null): PrizeRow => ({ memberId: m.memberId, name: m.name, color: m.color, rank, prize, score: m.score });
  const rows = [
    ...(pinned ? [row(pinned, null, s.pinned!.text ? { text: s.pinned!.text, color: null } : null)] : []),
    ...ranked.map((m, i) => row(m, i + 1, s.prizes[i]?.text ? s.prizes[i] : null))
  ];
  return { rows, total: rows.reduce((sum, r) => sum + r.score, 0) };
}

/**
 * The board of a broadcast. `scoreboard`: its main scoreboard rows (who is listed, and their score on the BROADCAST
 * basis). On the WINDOW basis the same members get their 구간 score, 0 until 시작.
 */
export function prizeBoardLive(b: MockBroadcast, scoreboard: ScoreRow[]): PrizeBoardLive {
  const settings = prizeSettingsOf(b.channelId);
  const w = b.prizeBoard?.window ?? null;
  const windowed = settings.basis === "WINDOW" ? (w ? windowScores(b, w.startedAt, w.stoppedAt) : new Map<string, number>()) : null;
  const members = scoreboard.map((r) => ({ memberId: r.memberId, name: r.name, color: r.color, score: windowed ? (windowed.get(r.memberId) ?? 0) : r.score }));
  return { settings: structuredClone(settings), visible: !!b.prizeBoard?.visible, window: w && { startedAt: w.startedAt, stoppedAt: w.stoppedAt }, ...prizeRows(members, settings) };
}
