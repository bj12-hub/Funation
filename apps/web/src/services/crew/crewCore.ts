import type { AmountUnit } from "@/types/donationUnit";
import type { Platform } from "@/types/platform";
import { BATTLE_MULTIPLIER_MAX, BATTLE_PENALTY_MAX, FAN_NOTE_LIMITS, GRADES_MAX, PLATFORM_FAN_NOTE_RULES, GRADE_MULTIPLIER_MAX, GRADE_NAME_MAX, PLATFORM_BATTLE_RULES, PLATFORM_STEAL_RULES, SUB_BOARD_MAX, excelUnitOf, isExcelUnit, type BattleRules, type CrewGrade, type FanNoteRules, type FanNotesView, type RoomFanNotes, type StealRecord, type ExcelSettings, type ExcelUnit, type FeedEntry, type FeedEntryView, type FeedSource, type MemberRankRow } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

// ── 후원 리스트 (server-only) ──────────────────────────────────────────────────

/** 배틀 배수 · 벌칙 for new battles and 강탈 기준 of a channel (platform defaults until the creator changes them). */
export const battleRulesOf = (channelId: string): BattleRules => mockCrew.battleRules?.[channelId] ?? PLATFORM_BATTLE_RULES;
export const stealRulesOf = (channelId: string) => mockCrew.stealRules?.[channelId] ?? PLATFORM_STEAL_RULES;

/** Validates a 배수 (more than 0, up to BATTLE_MULTIPLIER_MAX, two decimals) and a 벌칙 (optional text). */
/**
 * A 배수 to two decimals, more than 0 and up to `max`, or null. The rounded value is what gets stored, so it is the
 * one checked: 0.00000001 would otherwise pass "more than 0" and be saved as 0.
 */
export function parseMultiplier(m: unknown, max: number): number | null {
  if (typeof m !== "number" || !Number.isFinite(m)) return null;
  const r = Math.round(m * 100) / 100;
  return r > 0 && r <= max && Math.abs(r - m) < 1e-9 ? r : null;
}

/**
 * 배수 (자동엑셀 규칙 · 기여도 · 배틀 · 직급) are stored to two decimals; every board multiplies in whole hundredths so
 * they agree: 50 × 1.15 is 57.49999… in floating point (57) but 58 in hundredths.
 */
const hundredths = (m: number) => Math.round(m * 100);
/** `points` × `m`, rounded once to whole points. */
export const timesMultiplier = (points: number, m: number) => Math.round((points * hundredths(m)) / 100);
/** What a ×`m` adds on top of `points`: (m − 1) × points, rounded once (1.15 − 1 is 0.1499… in floating point). */
export const extraPoints = (points: number, m: number) => Math.round((points * (hundredths(m) - 100)) / 100);

export function parseBattleRules(v: Record<string, unknown>, forbidden: string[]): BattleRules | { message: string } {
  const m = parseMultiplier(v.multiplier, BATTLE_MULTIPLIER_MAX);
  if (m === null) return { message: `배수는 0보다 크고 ${BATTLE_MULTIPLIER_MAX}배 이하, 소수 둘째 자리까지예요.` };
  const penalty = typeof v.penalty === "string" ? v.penalty.trim() : "";
  if (penalty.length > BATTLE_PENALTY_MAX) return { message: `벌칙은 ${BATTLE_PENALTY_MAX}자 이내로 입력해 주세요.` };
  if (forbidden.some((w) => penalty.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  return { multiplier: m, penalty };
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
 * `broadcastId`: only that broadcast may collect it (a 퀘스트 settled after its broadcast ended is not listed).
 */
export function recordBroadcastDonation(channelId: string, input: { donor: string; message: string; fnAmount: number }, broadcastId?: string | null) {
  const live = liveBroadcastOf(channelId);
  if (!live || (broadcastId !== undefined && live.id !== broadcastId)) return;
  addFeedEntry(live, { donor: input.donor, message: input.message, amount: input.fnAmount, unit: "FN", platform: null, source: "DONATION" });
}

/**
 * Called by 후원 연동 for each new (deduped) platform donation, with the unit code its adapter mapped. Units the
 * 자동엑셀 does not know (a Super Chat in EUR …) stay out of the list (the alert is still shown).
 */
export function recordBroadcastExternal(channelId: string, input: { platform: Platform; donor: string; message: string; value: number; unit: AmountUnit }) {
  const live = liveBroadcastOf(channelId);
  const unit = excelUnitOf(input.unit);
  if (!live || !unit) return;
  addFeedEntry(live, { donor: input.donor, message: input.message, amount: input.value, unit, platform: input.platform, source: "DONATION" });
}

/** Called by SMS 계좌후원 for each recognised deposit: a live crew broadcast lists it in 원 (source BANK). */
export function recordBroadcastBank(channelId: string, input: { donor: string; value: number }) {
  const live = liveBroadcastOf(channelId);
  if (live) addFeedEntry(live, { donor: input.donor, message: "", amount: input.value, unit: "KRW", platform: null, source: "BANK" });
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

/** The channel's 자동엑셀 settings; 환산값 saved before the unit codes (keyed by label) are moved to the code first. */
export function excelOf(channelId: string): ExcelSettings {
  const s = mockCrew.excel?.[channelId];
  if (!s) return DEFAULT_EXCEL;
  migrateRates(s.rates);
  return s;
}

/**
 * Re-keys 환산값 saved by label (별풍선 → SOOP_BALLOON …) in place, so the saved value keeps applying. A value already
 * under the code wins; a key that is neither a code nor a known label is dropped (the settings screen sends every key
 * back, and the server would refuse it).
 */
export function migrateRates(rates: Record<string, number | undefined>) {
  for (const [key, value] of Object.entries(rates)) {
    if (isExcelUnit(key)) continue;
    const unit = excelUnitOf(key);
    if (unit && rates[unit] === undefined) rates[unit] = value;
    delete rates[key];
  }
}

/** The 후원 리스트 of a broadcast; entries listed before the unit codes (unit = label) are moved to the code first. */
export function feedOf(b: MockBroadcast): FeedEntry[] {
  const feed = b.feed ?? [];
  for (const f of feed) if (!isExcelUnit(f.unit)) f.unit = excelUnitOf(f.unit) ?? f.unit;
  return feed;
}

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
  const points = c?.kind === "POINTS" ? c.value : base === null ? 0 : timesMultiplier(base, multiplier);
  return { ...e, base, multiplier, points };
}

/**
 * Points each member received between `from` and `to` (targeted donations + assigned 후원 리스트
 * entries, 자동엑셀 points), without 기여도 강탈. `to` null = now.
 */
export function windowReceived(b: MockBroadcast, from: string, to: string | null): Map<string, number> {
  const end = to ?? new Date(Date.now() + 1000).toISOString();
  const inWindow = (at: string) => at >= from && at <= end;
  const s = excelOf(b.channelId);
  const scores = new Map<string, number>();
  const add = (id: string, p: number) => scores.set(id, (scores.get(id) ?? 0) + p);
  for (const a of mockCrew.attributions) if (a.channelId === b.channelId && inWindow(a.at)) add(a.memberId, scoreFn(a.fnAmount, s));
  for (const f of feedOf(b)) if (f.status === "ASSIGNED" && f.memberId && inWindow(f.at)) add(f.memberId, scoreEntry(f, s).points);
  return scores;
}

/** ± 기여도 강탈 points per member between `from` and `to` (`to` null = now). */
export function windowSteals(b: MockBroadcast, from: string, to: string | null): Map<string, number> {
  const end = to ?? new Date(Date.now() + 1000).toISOString();
  const scores = new Map<string, number>();
  const add = (id: string, p: number) => scores.set(id, (scores.get(id) ?? 0) + p);
  for (const x of b.steals ?? []) if (x.at >= from && x.at <= end) {
    add(x.thief, x.points);
    add(x.target, -x.points);
  }
  return scores;
}

/**
 * Points each member has from between `from` and `to`: what they received ± 기여도 강탈 (which moves points between
 * members inside the same window). Used by 서브 점수판 and 실시간 배틀. `to` null = now.
 */
export function windowScores(b: MockBroadcast, from: string, to: string | null): Map<string, number> {
  const scores = windowReceived(b, from, to);
  for (const [id, p] of windowSteals(b, from, to)) scores.set(id, (scores.get(id) ?? 0) + p);
  return scores;
}

export const gradesOf = (channelId: string): CrewGrade[] => mockCrew.grades?.[channelId] ?? [];

/**
 * Validates a 직급 list (names unique, 배수 like 배틀: more than 0, up to the max, two decimals). An id is kept only if it
 * is one of the channel's grades (`known`) and not used twice; anything else gets a new id.
 */
export function parseGrades(input: unknown, forbidden: string[], known: string[] = []): CrewGrade[] | { message: string } {
  if (!Array.isArray(input) || input.length > GRADES_MAX) return { message: `직급은 ${GRADES_MAX}개까지 만들 수 있어요.` };
  const out: CrewGrade[] = [];
  for (const raw of input) {
    const v = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const name = typeof v.name === "string" ? v.name.trim() : "";
    if (!name || name.length > GRADE_NAME_MAX) return { message: `직급 이름은 1~${GRADE_NAME_MAX}자로 입력해 주세요.` };
    if (forbidden.some((w) => name.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    if (out.some((g) => g.name === name)) return { message: "같은 이름의 직급이 있어요." };
    const m = parseMultiplier(v.multiplier, GRADE_MULTIPLIER_MAX);
    if (m === null) return { message: `직급 배수는 0보다 크고 ${GRADE_MULTIPLIER_MAX}배 이하, 소수 둘째 자리까지예요.` };
    const keep = typeof v.id === "string" && known.includes(v.id) && !out.some((g) => g.id === v.id);
    const id = keep ? (v.id as string) : `gr-${Date.now().toString(36)}-${out.length}`;
    out.push({ id, name, multiplier: m });
  }
  return out;
}

/** Each member's 직급 배수 (≠ 1) under the channel's current grades — copied onto a broadcast when it starts. */
export function gradeMultipliersOf(channelId: string): Record<string, number> {
  const grades = gradesOf(channelId);
  const out: Record<string, number> = {};
  for (const m of mockCrew.crews[channelId] ?? []) {
    const x = grades.find((g) => g.id === m.gradeId)?.multiplier ?? 1;
    if (x !== 1) out[m.id] = x;
  }
  return out;
}

/**
 * 직급 배수 on the scoreboard (2026-10-06 결정): what a member received in the broadcast — donations for them and
 * assigned 후원 리스트 entries, not 강탈 · 보정 · 배틀 — counts × their 직급 배수 as it was when the broadcast started.
 * Returns the extra points per member, (배수 − 1) × those points, rounded once in whole points.
 */
export function gradeBonus(b: MockBroadcast): Map<string, number> {
  const bonus = new Map<string, number>();
  const mult = new Map(Object.entries(b.gradeMultipliers ?? gradeMultipliersOf(b.channelId)));
  if (!mult.size) return bonus;
  const end = b.endedAt ?? new Date(Date.now() + 1000).toISOString();
  const s = excelOf(b.channelId);
  const received = new Map<string, number>();
  const add = (id: string, p: number) => mult.has(id) && received.set(id, (received.get(id) ?? 0) + p);
  for (const a of mockCrew.attributions) if (a.channelId === b.channelId && a.at >= b.startedAt && a.at <= end) add(a.memberId, scoreFn(a.fnAmount, s));
  for (const f of feedOf(b)) if (f.status === "ASSIGNED" && f.memberId) add(f.memberId, scoreEntry(f, s).points);
  for (const [id, points] of received) bonus.set(id, extraPoints(points, mult.get(id)!));
  return bonus;
}

/**
 * 배틀 배수 on the main scoreboard (2026-10-05 결정): what a battle member received while a ×n battle ran counts n
 * times. Returns the extra points per member, (배수 − 1) × what that member received in the battle window (the same
 * points the battle board multiplies). Battles at 1배 add nothing.
 * 강탈엔 배틀 배수 미적용 (2026-10-07 결정): 기여도 강탈 inside the window moves board points as they are, never × n.
 */
export function battleBonus(b: MockBroadcast, now = Date.now()): Map<string, number> {
  const bonus = new Map<string, number>();
  for (const x of b.battles ?? []) {
    const m = x.multiplier ?? 1;
    if (m === 1) continue;
    const endMs = Math.min(Date.parse(x.endsAt), x.stoppedAt ? Date.parse(x.stoppedAt) : Infinity);
    const received = windowReceived(b, x.startedAt, endMs > now ? null : new Date(endMs).toISOString());
    for (const id of [...x.a, ...x.b]) bonus.set(id, (bonus.get(id) ?? 0) + extraPoints(received.get(id) ?? 0, m));
  }
  return bonus;
}

/** A 기여도 강탈 record with member names (removed members keep a placeholder). */
export function stealRecordView(channelId: string, x: NonNullable<MockBroadcast["steals"]>[number]): StealRecord {
  const name = (id: string) => (mockCrew.crews[channelId] ?? []).find((m) => m.id === id)?.name ?? "삭제된 멤버";
  return { id: x.id, at: x.at, thiefId: x.thief, thiefName: name(x.thief), targetId: x.target, targetName: name(x.target), slotId: x.slotId, slotLabel: x.slotLabel, points: x.points };
}

/** Points for a member-targeted FN donation (same conversion and 배수 규칙 as the list). */
export function scoreFn(fnAmount: number, s: ExcelSettings) {
  const base = baseAmount(fnAmount, "FN", s);
  return base === null ? 0 : timesMultiplier(base, ruleMultiplier(base, s));
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
  recordAttribution(donationId, channelId, memberId, fnAmount, shown);
}

/**
 * Records the member a donation was sent for, now (scoreboards and rankings count it from this moment). A settled
 * 퀘스트 calls this directly: the member was checked when the quest was sent, and a member set inactive or removed
 * since still gets it (a removed one shows as 삭제된 멤버, like any older donation).
 */
export function recordAttribution(donationId: string, channelId: string, memberId: string, fnAmount: number, shown: { donor: string; donorId: string; message: string }) {
  if (mockCrew.attributions.some((a) => a.donationId === donationId)) return;
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

/**
 * This month's per-member totals for a channel (members without donations included, sorted by FN). The month is the
 * server's local one (Asia/Seoul): `at` is a UTC timestamp, so it is compared as a time, not by its "YYYY-MM" text
 * (00:00–08:59 KST on the 1st is still the previous month in UTC).
 */
export function memberRanking(channelId: string, now = new Date()): MemberRankRow[] {
  const members = mockCrew.crews[channelId] ?? [];
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const inMonth = (at: string) => {
    const t = Date.parse(at);
    return t >= from && t < to;
  };
  const rows = members.map((mem) => {
    const mine = mockCrew.attributions.filter((a) => a.channelId === channelId && a.memberId === mem.id && inMonth(a.at));
    return { memberId: mem.id, name: mem.name, role: mem.role, totalFn: mine.reduce((s, a) => s + a.fnAmount, 0), count: mine.length, sharePercent: 0 };
  });
  const total = rows.reduce((s, r) => s + r.totalFn, 0);
  for (const r of rows) r.sharePercent = total ? Math.round((r.totalFn / total) * 1000) / 10 : 0;
  return rows.sort((a, b) => b.totalFn - a.totalFn || a.name.localeCompare(b.name));
}

// ── 팬 메시지 · 요청사항 (2026-10-06) ──

/** The channel's 팬 메시지 도배 기준 (platform defaults until the creator changes them). */
export const fanNoteRulesOf = (channelId: string): FanNoteRules => ({ ...PLATFORM_FAN_NOTE_RULES, ...mockCrew.fanNoteRules?.[channelId] });

const memberNames = (channelId: string) => new Map((mockCrew.crews[channelId] ?? []).map((m) => [m.id, m.name]));

/** The operator's list: newest first (capped), member names from the channel's crew, counts over every note. */
export function fanNotesView(b: MockBroadcast): FanNotesView {
  const all = b.fanNotes ?? [];
  const names = memberNames(b.channelId);
  const counts = { NEW: 0, DONE: 0, HIDDEN: 0 };
  for (const n of all) counts[n.status]++;
  const notes = [...all]
    .reverse()
    .slice(0, FAN_NOTE_LIMITS.shown)
    .map(({ id, at, kind, memberId, author, text, status }) => ({ id, at, kind, memberId, memberName: memberId ? (names.get(memberId) ?? "삭제된 멤버") : null, author, text, status }));
  return { open: !b.fanNotesClosed, rules: fanNoteRulesOf(b.channelId), notes, counts };
}

/** The room card for one viewer (`userId` null = signed out): active members, cooldown and their own notes. */
export function roomFanNotes(b: MockBroadcast, userId: string | null, now = Date.now()): RoomFanNotes {
  const crew = mockCrew.crews[b.channelId] ?? [];
  const names = memberNames(b.channelId);
  const mine = userId ? (b.fanNotes ?? []).filter((n) => n.userId === userId) : [];
  const last = mine.at(-1);
  const { cooldownSec } = fanNoteRulesOf(b.channelId);
  const cooldownLeft = last ? Math.max(0, Math.ceil((Date.parse(last.at) + cooldownSec * 1000 - now) / 1000)) : 0;
  return {
    broadcastId: b.id,
    title: b.title,
    members: crew.filter((m) => m.active).map(({ id, name, color }) => ({ id, name, color })),
    cooldownLeft,
    cooldownSec,
    mine: [...mine]
      .reverse()
      .slice(0, FAN_NOTE_LIMITS.mine)
      .map((n) => ({ id: n.id, kind: n.kind, memberName: n.memberId ? (names.get(n.memberId) ?? "삭제된 멤버") : null, text: n.text, done: n.status === "DONE" }))
  };
}
