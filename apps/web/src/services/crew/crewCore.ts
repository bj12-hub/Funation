import type { Platform } from "@/types/platform";
import { BATTLE_MULTIPLIER_MAX, BATTLE_PENALTY_MAX, PLATFORM_BATTLE_RULES, PLATFORM_STEAL_RULES, SUB_BOARD_MAX, isExcelUnit, type BattleRules, type StealRecord, type ExcelSettings, type ExcelUnit, type FeedEntry, type FeedEntryView, type FeedSource, type MemberRankRow } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

// ── 후원 리스트 (server-only) ──────────────────────────────────────────────────

/** 배틀 배수 · 벌칙 for new battles and 강탈 기준 of a channel (platform defaults until the creator changes them). */
export const battleRulesOf = (channelId: string): BattleRules => mockCrew.battleRules?.[channelId] ?? PLATFORM_BATTLE_RULES;
export const stealRulesOf = (channelId: string) => mockCrew.stealRules?.[channelId] ?? PLATFORM_STEAL_RULES;

/** Validates a 배수 (more than 0, up to BATTLE_MULTIPLIER_MAX, two decimals) and a 벌칙 (optional text). */
export function parseBattleRules(v: Record<string, unknown>, forbidden: string[]): BattleRules | { message: string } {
  const m = v.multiplier;
  if (typeof m !== "number" || !Number.isFinite(m) || m <= 0 || m > BATTLE_MULTIPLIER_MAX || Math.abs(Math.round(m * 100) - m * 100) > 1e-6) {
    return { message: `배수는 0보다 크고 ${BATTLE_MULTIPLIER_MAX}배 이하, 소수 둘째 자리까지예요.` };
  }
  const penalty = typeof v.penalty === "string" ? v.penalty.trim() : "";
  if (penalty.length > BATTLE_PENALTY_MAX) return { message: `벌칙은 ${BATTLE_PENALTY_MAX}자 이내로 입력해 주세요.` };
  if (forbidden.some((w) => penalty.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  return { multiplier: Math.round(m * 100) / 100, penalty };
}

export const liveBroadcastOf = (channelId: string) => (mockCrew.broadcasts ?? []).find((b) => b.channelId === channelId && !b.endedAt) ?? null;

/** The single active member whose keyword appears in the message; ambiguous or none → null. */
export function matchMember(channelId: string, message: string): string | null {
  const text = message.toLowerCase();
  const keywords = mockCrew.keywords ?? {};
  const hits = (mockCrew.crews[channelId] ?? []).filter((m) => m.active && (keywords[m.id] ?? []).some((k) => text.includes(k.toLowerCase())));
  return hits.length === 1 ? hits[0].id : null;
}

type FeedInput = { donor: string; message: string; amount: number; unit: ExcelUnit; platform: Platform | null; source: FeedSource };

/** Adds a donation to the live broadcast's 후원 리스트, applying 한방 and the assign mode. */
export function addFeedEntry(b: MockBroadcast, input: FeedInput, now = Date.now()): FeedEntry {
  const feed = (b.feed ??= []);
  const suggested = matchMember(b.channelId, input.message);
  const base = { id: `fd-${now.toString(36)}-${feed.length}`, at: new Date(now).toISOString(), ...input, suggestedMemberId: suggested, oneshot: false, contribution: null };
  let entry: FeedEntry;
  if (b.oneshot) entry = { ...base, status: "POT", memberId: null, oneshot: true };
  else if (suggested && (b.assignMode ?? "AUTO") === "AUTO") entry = { ...base, status: "ASSIGNED", memberId: suggested };
  else entry = { ...base, status: suggested ? "PENDING" : "UNMATCHED", memberId: null };
  feed.push(entry);
  return entry;
}

/**
 * Called by the Donation Core for a completed donation without a member target. Only a live crew
 * broadcast on that channel collects it (member-targeted donations are already scored directly).
 */
export function recordBroadcastDonation(channelId: string, input: { donor: string; message: string; fnAmount: number }) {
  const live = liveBroadcastOf(channelId);
  if (live) addFeedEntry(live, { donor: input.donor, message: input.message, amount: input.fnAmount, unit: "FN", platform: null, source: "DONATION" });
}

/**
 * Called by 후원 연동 for each new (deduped) platform donation. Units the 자동엑셀 does not know stay
 * out of the list (the alert is still shown).
 */
export function recordBroadcastExternal(channelId: string, input: { platform: Platform; donor: string; message: string; value: number; currency: string }) {
  const live = liveBroadcastOf(channelId);
  if (!live || !isExcelUnit(input.currency)) return;
  addFeedEntry(live, { donor: input.donor, message: input.message, amount: input.value, unit: input.currency, platform: input.platform, source: "DONATION" });
}

/**
 * Opens a 서브 점수판 (closing the open one). Shared by 새 판 and 콘텐츠 시나리오. Returns an error
 * message, or null when opened (or already opened for this request id).
 */
export function openBoard(b: MockBroadcast, title: string, requestId: string, now = new Date().toISOString()): string | null {
  const boards = (b.subBoards ??= []);
  if (boards.some((x) => x.requestId === requestId)) return null;
  if (boards.length >= SUB_BOARD_MAX) return `서브 점수판은 방송당 ${SUB_BOARD_MAX}개까지예요.`;
  for (const x of boards) if (!x.closedAt) x.closedAt = now;
  boards.push({ no: boards.length + 1, title: title || `서브 ${boards.length + 1}판`, openedAt: now, closedAt: null, requestId });
  return null;
}

// ── 자동엑셀 (server-only scoring) ─────────────────────────────────────────────

export const DEFAULT_EXCEL: ExcelSettings = { unit: "FN", rates: {}, rules: [] };
export const excelOf = (channelId: string): ExcelSettings => mockCrew.excel?.[channelId] ?? DEFAULT_EXCEL;

/**
 * Amount in the score unit. FN 기준: only FN counts (1 FN = 1점, the original scoreboard). 원화 기준:
 * 원 as is, every other unit times the creator's value — null while that value is not set.
 */
export function baseAmount(amount: number, unit: ExcelUnit, s: ExcelSettings): number | null {
  if (s.unit === "FN") return unit === "FN" ? amount : null;
  if (unit === "KRW") return amount;
  const rate = s.rates[unit];
  return rate === undefined ? null : amount * rate;
}

/** The highest 배수 규칙 whose threshold the converted amount reaches (1 when none). */
export const ruleMultiplier = (base: number | null, s: ExcelSettings) =>
  base === null ? 1 : s.rules.filter((r) => base >= r.min).reduce((m, r) => (r.min >= m.min ? r : m), { min: -1, multiplier: 1 }).multiplier;

/** Score of one entry: 수기 기여도 (points or multiplier) wins over the 배수 규칙. */
export function scoreEntry(e: FeedEntry, s: ExcelSettings): FeedEntryView {
  const base = baseAmount(e.amount, e.unit, s);
  const c = e.contribution;
  const multiplier = c?.kind === "MULTIPLIER" ? c.value : ruleMultiplier(base, s);
  const points = c?.kind === "POINTS" ? c.value : base === null ? 0 : Math.round(base * multiplier);
  return { ...e, base, multiplier, points };
}

/**
 * Points each member received between `from` and `to` (targeted donations + assigned 후원 리스트
 * entries, 자동엑셀 points, ± 기여도 강탈). Used by 서브 점수판 and 실시간 배틀. `to` null = now.
 */
export function windowScores(b: MockBroadcast, from: string, to: string | null): Map<string, number> {
  const end = to ?? new Date(Date.now() + 1000).toISOString();
  const inWindow = (at: string) => at >= from && at <= end;
  const s = excelOf(b.channelId);
  const scores = new Map<string, number>();
  const add = (id: string, p: number) => scores.set(id, (scores.get(id) ?? 0) + p);
  for (const a of mockCrew.attributions) if (a.channelId === b.channelId && inWindow(a.at)) add(a.memberId, scoreFn(a.fnAmount, s));
  for (const f of b.feed ?? []) if (f.status === "ASSIGNED" && f.memberId && inWindow(f.at)) add(f.memberId, scoreEntry(f, s).points);
  // 기여도 강탈 moves points between members inside the same window.
  for (const x of b.steals ?? []) if (inWindow(x.at)) {
    add(x.thief, x.points);
    add(x.target, -x.points);
  }
  return scores;
}

/** A 기여도 강탈 record with member names (removed members keep a placeholder). */
export function stealRecordView(channelId: string, x: NonNullable<MockBroadcast["steals"]>[number]): StealRecord {
  const name = (id: string) => (mockCrew.crews[channelId] ?? []).find((m) => m.id === id)?.name ?? "삭제된 멤버";
  return { id: x.id, at: x.at, thiefId: x.thief, thiefName: name(x.thief), targetId: x.target, targetName: name(x.target), slotId: x.slotId, slotLabel: x.slotLabel, points: x.points };
}

/** Points for a member-targeted FN donation (same conversion and 배수 규칙 as the list). */
export function scoreFn(fnAmount: number, s: ExcelSettings) {
  const base = baseAmount(fnAmount, "FN", s);
  return base === null ? 0 : Math.round(base * ruleMultiplier(base, s));
}

/**
 * Server-only crew internals shared with the Donation Core. Not a "use server" module: attributing
 * a donation to a member must only happen inside a completed donation.
 */

/** Whether `memberId` is an active member of `channelId`'s crew. */
export const isActiveMember = (channelId: string, memberId: unknown) =>
  typeof memberId === "string" && (mockCrew.crews[channelId] ?? []).some((x) => x.id === memberId && x.active);

export function attributeMemberDonation(
  donationId: string,
  channelId: string,
  memberId: string | null,
  fnAmount: number,
  shown: { donor: string; donorId: string; message: string } = { donor: "익명", donorId: "", message: "" }
) {
  if (!memberId || !isActiveMember(channelId, memberId)) return;
  mockCrew.attributions.push({ donationId, channelId, memberId, fnAmount, at: new Date().toISOString(), ...shown });
}

/** 받은 후원 "크루 후원": donations sent for a member, newest first (removed members keep a placeholder). */
export function crewDonationRows(channelId: string) {
  const members = mockCrew.crews[channelId] ?? [];
  return mockCrew.attributions
    .filter((a) => a.channelId === channelId)
    .map((a) => ({
      id: a.donationId,
      at: a.at,
      donor: a.donor ?? "익명",
      donorId: a.donorId ?? "",
      fnAmount: a.fnAmount,
      message: a.message ?? "",
      member: members.find((m) => m.id === a.memberId)?.name ?? "삭제된 멤버"
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** This month's per-member totals for a channel (members without donations included, sorted by FN). */
export function memberRanking(channelId: string): MemberRankRow[] {
  const members = mockCrew.crews[channelId] ?? [];
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rows = members.map((mem) => {
    const mine = mockCrew.attributions.filter((a) => a.channelId === channelId && a.memberId === mem.id && a.at.startsWith(month));
    return { memberId: mem.id, name: mem.name, role: mem.role, totalFn: mine.reduce((s, a) => s + a.fnAmount, 0), count: mine.length, sharePercent: 0 };
  });
  const total = rows.reduce((s, r) => s + r.totalFn, 0);
  for (const r of rows) r.sharePercent = total ? Math.round((r.totalFn / total) * 1000) / 10 : 0;
  return rows.sort((a, b) => b.totalFn - a.totalFn || a.name.localeCompare(b.name));
}
