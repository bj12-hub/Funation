import { battleGroups, windowScores } from "./crewCore";
import {
  BATTLE_TEAM_NAME_MAX,
  DEFAULT_PRIZE_BOARD,
  DEFAULT_TEAM_PRIZE_BOARD,
  MULTI_TEAM_COLORS,
  MULTI_TEAM_KEYS,
  MULTI_TEAMS_MAX,
  MULTI_TEAMS_MIN,
  PRIZE_BASES,
  PRIZE_AUDIENCES,
  PRIZE_COLUMNS,
  PRIZE_LIMIT_MAX,
  PRIZE_PLACEMENTS,
  PRIZE_RANKS_MAX,
  PRIZE_TEXT_MAX,
  PRIZE_TITLE_MAX,
  TEAM_MEMBERS_PER_LINE_MAX,
  TEAM_PRIZE_MEMBER_VIEWS,
  TEAM_PRIZE_RANKS_MAX,
  TEAM_PRIZE_SOURCES,
  type PrizeBoardLive,
  type PrizeBoardSettings,
  type PrizeRow,
  type RankPrize,
  type ScoreRow,
  type TeamPrizeLive,
  type TeamPrizeMissing,
  type TeamPrizeRow,
  type TeamPrizeSettings
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 상품 순위표 · 팀 순위표 (server-only) — code-first, StreamDonate 랭킹(상품) · 시간 내 랭킹 · 팀 랭킹(상품) 참고. One board
 * of each per channel: each rank (a member, or a team) gets the creator's 상품 · 벌칙 line, scored on the main scoreboard
 * or on a 시작 ~ 정지 구간. Prizes are text on stream only: nothing is paid or moved (TBD: 상품 지급).
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The channel's 상품 순위표 settings (defaults until saved; saved before 제목 색 (2026-10-28) in the theme's color). */
export const prizeSettingsOf = (channelId: string): PrizeBoardSettings => ({ ...DEFAULT_PRIZE_BOARD, ...mockCrew.prizeBoards?.[channelId] });

/** The channel's 팀 순위표 settings (defaults until saved). */
export const teamPrizeSettingsOf = (channelId: string): TeamPrizeSettings => ({ ...DEFAULT_TEAM_PRIZE_BOARD, ...mockCrew.teamPrizes?.[channelId] });

/**
 * 등수별 상품 · 벌칙: up to `max` lines; a line without text drops its colors (글자색 · 테두리색), and blank lines at the end
 * are not kept.
 */
function parsePrizeLines(input: unknown, max: number): RankPrize[] | { message: string } {
  if (!Array.isArray(input) || input.length > max) return { message: `상품 · 벌칙은 ${max}등까지 적을 수 있어요.` };
  const prizes: RankPrize[] = [];
  for (const raw of input) {
    const p = rec(raw);
    const line = text(p.text);
    if (line.length > PRIZE_TEXT_MAX) return { message: `상품 · 벌칙은 등수마다 ${PRIZE_TEXT_MAX}자 이내로 입력해 주세요.` };
    if (p.color !== null && p.color !== undefined && !(typeof p.color === "string" && HEX_COLOR.test(p.color))) return { message: "글자색을 확인해 주세요." };
    if (p.outline !== null && p.outline !== undefined && !(typeof p.outline === "string" && HEX_COLOR.test(p.outline))) return { message: "테두리색을 확인해 주세요." };
    prizes.push({ text: line, color: line && typeof p.color === "string" ? p.color.toLowerCase() : null, outline: line && typeof p.outline === "string" ? p.outline.toLowerCase() : null });
  }
  while (prizes.length && !prizes[prizes.length - 1].text) prizes.pop();
  return prizes;
}

/** 제목 색 · 열 개수 · 배치 · 점수 · 하단 합계, the same on both boards. A screen from before 제목 색 sends none: 원래 색. */
function parseDisplay(v: Record<string, unknown>): Pick<PrizeBoardSettings, "titleColor" | "columns" | "placement" | "showScore" | "showTotal"> | { message: string } {
  if (v.titleColor !== null && v.titleColor !== undefined && !(typeof v.titleColor === "string" && HEX_COLOR.test(v.titleColor))) return { message: "제목 색을 확인해 주세요." };
  const titleColor = typeof v.titleColor === "string" ? v.titleColor.toLowerCase() : null;
  const columns = PRIZE_COLUMNS.find((c) => c === v.columns);
  if (!columns) return { message: "열 개수를 골라 주세요." };
  const placement = PRIZE_PLACEMENTS.find((p) => p.key === v.placement)?.key;
  if (!placement) return { message: "배치를 골라 주세요." };
  if (typeof v.showScore !== "boolean" || typeof v.showTotal !== "boolean") return { message: "표시 설정을 확인해 주세요." };
  return { titleColor, columns, placement, showScore: v.showScore, showTotal: v.showTotal };
}

/** Everything a board shows is on stream. */
const hasForbidden = (words: string[], forbidden: string[]) => words.some((s) => forbidden.some((w) => s.toLowerCase().includes(w)));

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

  const prizes = parsePrizeLines(v.prizes, PRIZE_RANKS_MAX);
  if ("message" in prizes) return prizes;

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

  // 표시 대상 (2026-10-28): a screen from before sends neither — 멤버 전체, 10명.
  const audience = v.audience === undefined ? "ALL" : PRIZE_AUDIENCES.find((a) => a.key === v.audience)?.key;
  const limit = v.limit === undefined ? 10 : v.limit;
  if (!audience || typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > PRIZE_LIMIT_MAX) return { message: `표시 대상과 상위 표시 인원(1~${PRIZE_LIMIT_MAX}명)을 확인해 주세요.` };

  const display = parseDisplay(v);
  if ("message" in display) return display;
  if (hasForbidden([title, pinned?.text ?? "", ...prizes.map((p) => p.text)], forbidden)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };

  return { title, basis, prizes, excluded, pinned, audience, limit, ...display };
}

/**
 * Validates the 팀 순위표 settings. `memberIds`: the channel's crew. The CUSTOM teams — each a unique name (blank = "A팀",
 * "B팀" …) and at least one member, a member in one team only, as in 다수 팀 배틀 — are checked and kept under every
 * source; CUSTOM itself needs 2 ~ 8 of them.
 */
export function parseTeamPrize(input: unknown, forbidden: string[], memberIds: string[]): TeamPrizeSettings | { message: string } {
  const v = rec(input);
  const title = text(v.title);
  if (title.length > PRIZE_TITLE_MAX) return { message: `제목은 ${PRIZE_TITLE_MAX}자 이내로 입력해 주세요.` };
  const basis = PRIZE_BASES.find((b) => b.key === v.basis)?.key;
  if (!basis) return { message: "집계 기준을 골라 주세요." };
  const source = TEAM_PRIZE_SOURCES.find((s) => s.key === v.source)?.key;
  if (!source) return { message: "팀 구성을 골라 주세요." };

  if (!Array.isArray(v.teams) || v.teams.length > MULTI_TEAMS_MAX) return { message: `팀은 ${MULTI_TEAMS_MAX}개까지 만들 수 있어요.` };
  const teams: TeamPrizeSettings["teams"] = [];
  const taken = new Set<string>();
  for (const [i, raw] of v.teams.entries()) {
    const t = rec(raw);
    const name = text(t.name) || `${MULTI_TEAM_KEYS[i]}팀`;
    if (name.length > BATTLE_TEAM_NAME_MAX) return { message: `팀 이름은 ${BATTLE_TEAM_NAME_MAX}자 이내로 입력해 주세요.` };
    if (teams.some((x) => x.name === name)) return { message: "같은 이름의 팀이 있어요." };
    if (!Array.isArray(t.memberIds) || !t.memberIds.length) return { message: `${name}에 멤버를 한 명 이상 배정해 주세요.` };
    for (const id of t.memberIds) {
      if (typeof id !== "string" || !memberIds.includes(id)) return { message: "팀 배정을 확인해 주세요." };
      if (taken.has(id)) return { message: "한 멤버는 한 팀에만 들어갈 수 있어요." };
      taken.add(id);
    }
    teams.push({ name, memberIds: [...(t.memberIds as string[])] });
  }
  if (source === "CUSTOM" && teams.length < MULTI_TEAMS_MIN) return { message: `직접 구성은 팀을 ${MULTI_TEAMS_MIN}개 이상 만들어 주세요.` };

  const prizes = parsePrizeLines(v.prizes, TEAM_PRIZE_RANKS_MAX);
  if ("message" in prizes) return prizes;
  const members = TEAM_PRIZE_MEMBER_VIEWS.find((m) => m.key === v.members)?.key;
  if (!members) return { message: "팀원 표시를 골라 주세요." };
  // 한 줄에 놓을 팀원 수 (2026-10-28): a screen from before sends none — one line.
  const membersPerLine = v.membersPerLine === undefined ? 0 : v.membersPerLine;
  if (typeof membersPerLine !== "number" || !Number.isInteger(membersPerLine) || membersPerLine < 0 || membersPerLine > TEAM_MEMBERS_PER_LINE_MAX) {
    return { message: `한 줄에 놓을 팀원 수는 0~${TEAM_MEMBERS_PER_LINE_MAX}명이에요.` };
  }
  const display = parseDisplay(v);
  if ("message" in display) return display;
  if (hasForbidden([title, ...teams.map((t) => t.name), ...prizes.map((p) => p.text)], forbidden)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };

  return { title, basis, source, teams, prizes, members, membersPerLine, ...display };
}

type Scored = { memberId: string; name: string; color: string; score: number };

/**
 * The board: excluded members left out, the pinned member first (no rank), the rest by score — ties by name, as on the
 * scoreboard — numbered from 1, each with prizes[rank − 1] (none for a blank line or a rank past the list). 점수 받은 멤버만:
 * only members above 0, the top `limit` (the pinned one shows anyway).
 */
export function prizeRows(members: Scored[], s: PrizeBoardSettings): { rows: PrizeRow[]; total: number } {
  const listed = members.filter((m) => !s.excluded.includes(m.memberId));
  const pinned = s.pinned ? listed.find((m) => m.memberId === s.pinned!.memberId) : undefined;
  const sorted = listed.filter((m) => m !== pinned).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const ranked = s.audience === "SCORED" ? sorted.filter((m) => m.score > 0).slice(0, s.limit) : sorted;
  const row = (m: Scored, rank: number | null, prize: RankPrize | null): PrizeRow => ({ memberId: m.memberId, name: m.name, color: m.color, rank, prize, score: m.score });
  const rows = [
    ...(pinned ? [row(pinned, null, s.pinned!.text ? { text: s.pinned!.text, color: null } : null)] : []),
    ...ranked.map((m, i) => row(m, i + 1, s.prizes[i]?.text ? s.prizes[i] : null))
  ];
  return { rows, total: rows.reduce((sum, r) => sum + r.score, 0) };
}

/** Window scores for a board's 구간 on the WINDOW basis (none until 시작), null on the BROADCAST basis. */
const windowedOf = (b: MockBroadcast, basis: PrizeBoardSettings["basis"], w: { startedAt: string; stoppedAt: string | null } | null) =>
  basis === "WINDOW" ? (w ? windowScores(b, w.startedAt, w.stoppedAt) : new Map<string, number>()) : null;

/**
 * The board of a broadcast. `scoreboard`: its main scoreboard rows (who is listed, and their score on the BROADCAST
 * basis). On the WINDOW basis the same members get their 구간 score, 0 until 시작.
 */
export function prizeBoardLive(b: MockBroadcast, scoreboard: ScoreRow[]): PrizeBoardLive {
  const settings = prizeSettingsOf(b.channelId);
  const w = b.prizeBoard?.window ?? null;
  const windowed = windowedOf(b, settings.basis, w);
  const members = scoreboard.map((r) => ({ memberId: r.memberId, name: r.name, color: r.color, score: windowed ? (windowed.get(r.memberId) ?? 0) : r.score }));
  return { settings: structuredClone(settings), visible: !!b.prizeBoard?.visible, window: w && { startedAt: w.startedAt, stoppedAt: w.stoppedAt }, ...prizeRows(members, settings) };
}

type ScoredTeam = { key: string; name: string; color: string; members: Scored[] };

/**
 * Teams by score (the sum of their members'), a tie keeping the set-up order, numbered from 1 with prizes[rank − 1]; the
 * members under a team best first, ties by name.
 */
export function teamPrizeRows(teams: ScoredTeam[], s: Pick<TeamPrizeSettings, "prizes">): { rows: TeamPrizeRow[]; total: number } {
  const rows = teams
    .map((t) => ({ ...t, members: [...t.members].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)), score: t.members.reduce((sum, m) => sum + m.score, 0) }))
    .sort((a, b) => b.score - a.score)
    .map((t, i) => ({ ...t, rank: i + 1, prize: s.prizes[i]?.text ? s.prizes[i] : null }));
  return { rows, total: rows.reduce((sum, r) => sum + r.score, 0) };
}

const isRunning = (x: { endsAt: string; stoppedAt: string | null }) => !x.stoppedAt && Date.parse(x.endsAt) > Date.now();

/** The teams the source gives (member ids in set-up order), or why there are none. */
function teamsOf(b: MockBroadcast, s: TeamPrizeSettings): { teams: { key: string; name: string; memberIds: string[] }[]; missing: TeamPrizeMissing | null } {
  if (s.source === "BROADCAST_TEAMS") {
    if (!b.teamMode) return { teams: [], missing: "NOT_TEAM_MODE" };
    const side = (key: "A" | "B") => ({ key, name: `${key}팀`, memberIds: Object.keys(b.teams).filter((id) => b.teams[id] === key) });
    return { teams: [side("A"), side("B")], missing: null };
  }
  if (s.source === "BATTLE") {
    const multi = (b.battles ?? []).filter((x) => x.mode === "MULTI_TEAMS");
    const battle = multi.find(isRunning) ?? multi.at(-1);
    if (!battle) return { teams: [], missing: "NO_BATTLE" };
    return { teams: battleGroups(battle)[0].map((t) => ({ key: t.key, name: t.name?.trim() || `${t.key}팀`, memberIds: t.memberIds })), missing: null };
  }
  if (s.teams.length < MULTI_TEAMS_MIN) return { teams: [], missing: "NO_TEAMS" };
  return { teams: s.teams.map((t, i) => ({ key: MULTI_TEAM_KEYS[i], name: t.name, memberIds: t.memberIds })), missing: null };
}

/**
 * The 팀 순위표 of a broadcast. Teams come from the source; a member's score is the main scoreboard's (`scoreboard`) on
 * the BROADCAST basis, or their 구간 score on the WINDOW basis (0 until 시작) — the board's own 구간, also for a 다수 팀
 * 배틀's teams (not the battle's ×배수 score). Members no longer in the crew are left out.
 */
export function teamPrizeLive(b: MockBroadcast, scoreboard: ScoreRow[]): TeamPrizeLive {
  const settings = teamPrizeSettingsOf(b.channelId);
  const w = b.teamPrize?.window ?? null;
  const windowed = windowedOf(b, settings.basis, w);
  const board = new Map(scoreboard.map((r) => [r.memberId, r.score]));
  const crew = new Map((mockCrew.crews[b.channelId] ?? []).map((m) => [m.id, m]));
  const { teams, missing } = teamsOf(b, settings);
  const scored = teams.map((t, i) => ({
    key: t.key,
    name: t.name,
    color: MULTI_TEAM_COLORS[i],
    members: t.memberIds.flatMap((id) => {
      const m = crew.get(id);
      return m ? [{ memberId: id, name: m.name, color: m.color, score: windowed ? (windowed.get(id) ?? 0) : (board.get(id) ?? 0) }] : [];
    })
  }));
  return {
    settings: structuredClone(settings),
    visible: !!b.teamPrize?.visible,
    window: w && { startedAt: w.startedAt, stoppedAt: w.stoppedAt },
    ...teamPrizeRows(scored, settings),
    missing
  };
}
