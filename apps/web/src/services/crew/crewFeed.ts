"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { addFeedEntry, liveBroadcastOf, matchMember } from "./crewCore";
import {
  EXCEL_MULTIPLIER_MAX,
  EXCEL_RATE_MAX,
  EXCEL_RULES_MAX,
  EXCEL_RULE_MIN_MAX,
  EXCEL_UNITS,
  KEYWORDS_PER_MEMBER,
  KEYWORD_MAX,
  MAX_ADJUST_POINTS,
  SIM_AMOUNT_MAX,
  SIM_TEXT_MAX,
  isExcelUnit,
  type BroadcastResult,
  type Contribution,
  type ExcelSettings,
  type MultiplierRule
} from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * 후원 리스트 Server Actions — code-first (no Figma frame), part of `/creator/crew/broadcast`.
 * Reference: funnation 엑셀콘 v3 (docs/research/funnation-reference.md §3).
 *
 * Donations during a live broadcast land in the 후원 리스트 and are scored for a member by keyword
 * (AUTO) or after the operator confirms (CONFIRM). 한방 collects a window of donations and gives the
 * pot to one member. Scores are display points — no FN moves here.
 *
 * 자동엑셀: Somnation FN and platform donations (후원 연동) share one list. With 원화 기준 every unit is
 * converted with the value the creator entered (1 unit = N원; platform rates are TBD, so there is no
 * default), then the 배수 규칙 applies — or the operator types a 기여도 (points or ×배수) for one
 * entry. Changes apply at once (no save step). TBD: 직급 배수, 배틀 배수, prize mapping, 투네이션 · 계좌.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew feed API is not connected yet.");
};
const bad = (s: string) => MOCK_FORBIDDEN_WORDS.some((w) => s.toLowerCase().includes(w));
const members = () => mockCrew.crews[STUDIO_CHANNEL] ?? [];
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;

/** Keywords are kept per member across broadcasts; a keyword may belong to one member only. */
export async function setMemberKeywords(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (!members().some((m) => m.id === v.memberId)) return { status: "INVALID", message: "멤버를 찾을 수 없어요." };
  if (!Array.isArray(v.keywords)) return { status: "INVALID", message: "키워드를 확인해 주세요." };
  const words = [...new Set(v.keywords.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean))];
  if (words.length > KEYWORDS_PER_MEMBER || words.some((k) => k.length > KEYWORD_MAX)) {
    return { status: "INVALID", message: `키워드는 멤버당 ${KEYWORDS_PER_MEMBER}개, 각 ${KEYWORD_MAX}자까지예요.` };
  }
  if (words.some(bad)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const keywords = (mockCrew.keywords ??= {});
  const taken = Object.entries(keywords)
    .filter(([id]) => id !== v.memberId)
    .flatMap(([, ks]) => ks.map((k) => k.toLowerCase()));
  const clash = words.find((k) => taken.includes(k.toLowerCase()));
  if (clash) return { status: "INVALID", message: `'${clash}'는 다른 멤버가 쓰는 키워드예요.` };
  keywords[v.memberId as string] = words;
  return { status: "SAVED" };
}

export async function setAssignMode(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (v.mode !== "AUTO" && v.mode !== "CONFIRM") return { status: "INVALID", message: "반영 방식을 확인해 주세요." };
  live.assignMode = v.mode;
  return { status: "SAVED" };
}

/** 시뮬 후원: a practice entry for the 후원 리스트 in any unit (points only, nothing is paid). Deduped by `requestId`. */
export async function simulateDonation(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const seen = (live.simRequests ??= []);
  if (seen.includes(v.requestId)) return { status: "SAVED" };
  const unit = v.unit ?? "FN";
  if (!isExcelUnit(unit)) return { status: "INVALID", message: "단위를 골라 주세요." };
  const amount = v.amount;
  // USD may carry cents; every other unit is counted in whole numbers.
  if (!isNum(amount) || amount <= 0 || amount > SIM_AMOUNT_MAX || !(unit === "USD" ? twoDecimals(amount) : Number.isInteger(amount))) return { status: "INVALID", message: "금액을 확인해 주세요." };
  const donor = (typeof v.donor === "string" ? v.donor.trim() : "") || "시뮬 후원자";
  const message = typeof v.message === "string" ? v.message.trim() : "";
  if (donor.length > SIM_TEXT_MAX || message.length > SIM_TEXT_MAX) return { status: "INVALID", message: `후원자명과 메시지는 ${SIM_TEXT_MAX}자까지예요.` };
  if (bad(donor) || bad(message)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  seen.push(v.requestId);
  const platform = EXCEL_UNITS.find((u) => u.key === unit)!.platform;
  addFeedEntry(live, { donor, message, amount, unit, platform, source: "SIM" });
  await mockDelay(100);
  return { status: "SAVED" };
}

/** Assign (or un-assign with `memberId: null`) an entry; confirms PENDING entries. Idempotent. */
export async function assignFeedEntry(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const entry = (live.feed ?? []).find((f) => f.id === v.entryId);
  if (!entry) return { status: "INVALID", message: "후원 기록을 찾을 수 없어요." };
  if (entry.status === "POT") return { status: "INVALID", message: "한방에 모이는 중인 후원이에요. 한방을 먼저 끝내 주세요." };
  if (v.memberId === null) {
    Object.assign(entry, { status: "UNMATCHED", memberId: null });
    return { status: "SAVED" };
  }
  if (!members().some((m) => m.id === v.memberId && m.active)) return { status: "INVALID", message: "활동 중인 멤버를 골라 주세요." };
  Object.assign(entry, { status: "ASSIGNED", memberId: v.memberId });
  return { status: "SAVED" };
}

/** 취소 건: excluded from scores (restore with assign). */
export async function cancelFeedEntry(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const entry = (live.feed ?? []).find((f) => f.id === v.entryId);
  if (!entry) return { status: "INVALID", message: "후원 기록을 찾을 수 없어요." };
  if (entry.status === "POT") return { status: "INVALID", message: "한방에 모이는 중인 후원이에요." };
  Object.assign(entry, { status: "CANCELLED", memberId: null, oneshot: false });
  return { status: "SAVED" };
}

export async function startOneshot(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== rec(input).broadcastId) return notLive;
  live.oneshot ??= { startedAt: new Date().toISOString() };
  return { status: "SAVED" };
}

/**
 * STOP: gives the pot to `memberId` as 한방 entries, or with `memberId: null` returns the pot to
 * normal keyword matching. Stopping when no 한방 is open is a no-op (double click safe).
 */
export async function stopOneshot(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!live.oneshot) return { status: "SAVED" };
  if (v.memberId !== null && !members().some((m) => m.id === v.memberId && m.active)) return { status: "INVALID", message: "몰아줄 멤버를 골라 주세요." };
  const mode = live.assignMode ?? "AUTO";
  for (const f of live.feed ?? []) {
    if (f.status !== "POT") continue;
    if (v.memberId !== null) Object.assign(f, { status: "ASSIGNED", memberId: v.memberId, oneshot: true });
    else {
      const suggested = matchMember(STUDIO_CHANNEL, f.message);
      Object.assign(f, {
        oneshot: false,
        suggestedMemberId: suggested,
        memberId: suggested && mode === "AUTO" ? suggested : null,
        status: suggested ? (mode === "AUTO" ? "ASSIGNED" : "PENDING") : "UNMATCHED"
      });
    }
  }
  live.oneshot = null;
  return { status: "SAVED" };
}

// ── 자동엑셀 ────────────────────────────────────────────────────────────────────

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** Up to two decimals (e.g. 1 USD = 1,380.25원). */
const twoDecimals = (v: number) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;

/**
 * 점수 기준 · 환산값 · 배수 규칙 for the studio channel (kept across broadcasts). Each change is applied
 * as sent — the screen calls this on every edit, so there is no separate save step.
 */
export async function setExcelSettings(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (v.unit !== "FN" && v.unit !== "KRW") return { status: "INVALID", message: "점수 기준을 골라 주세요." };
  const rawRates = rec(v.rates);
  const rates: ExcelSettings["rates"] = {};
  for (const [unit, value] of Object.entries(rawRates)) {
    if (!isExcelUnit(unit) || unit === "KRW") return { status: "INVALID", message: "환산 단위를 확인해 주세요." };
    if (value === null) continue;
    if (!isNum(value) || value <= 0 || value > EXCEL_RATE_MAX || !twoDecimals(value)) return { status: "INVALID", message: `환산값은 0보다 크고 ${EXCEL_RATE_MAX.toLocaleString("ko-KR")}원 이하, 소수 둘째 자리까지예요.` };
    rates[unit] = value;
  }
  if (!Array.isArray(v.rules) || v.rules.length > EXCEL_RULES_MAX) return { status: "INVALID", message: `배수 규칙은 ${EXCEL_RULES_MAX}개까지예요.` };
  const rules: MultiplierRule[] = [];
  for (const r of v.rules) {
    const { min, multiplier } = rec(r);
    if (!isNum(min) || !Number.isInteger(min) || min < 1 || min > EXCEL_RULE_MIN_MAX) return { status: "INVALID", message: "배수 규칙의 기준 금액을 확인해 주세요." };
    if (!isNum(multiplier) || multiplier <= 0 || multiplier > EXCEL_MULTIPLIER_MAX || !twoDecimals(multiplier)) return { status: "INVALID", message: `배수는 0보다 크고 ${EXCEL_MULTIPLIER_MAX}배 이하예요.` };
    if (rules.some((x) => x.min === min)) return { status: "INVALID", message: "같은 기준 금액의 규칙이 있어요." };
    rules.push({ min, multiplier });
  }
  (mockCrew.excel ??= {})[STUDIO_CHANNEL] = { unit: v.unit, rates, rules: rules.sort((a, b) => a.min - b.min) };
  return { status: "SAVED" };
}

/** 기여도 수기 입력 for one entry: fixed points, a ×배수, or `null` to go back to the 배수 규칙. Idempotent. */
export async function setEntryContribution(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const entry = (live.feed ?? []).find((f) => f.id === v.entryId);
  if (!entry) return { status: "INVALID", message: "후원 기록을 찾을 수 없어요." };
  if (entry.status === "CANCELLED") return { status: "INVALID", message: "취소한 후원이에요. 먼저 다시 배정해 주세요." };
  let contribution: Contribution | null = null;
  if (v.contribution !== null) {
    const { kind, value } = rec(v.contribution);
    if (kind === "POINTS" && isNum(value) && Number.isSafeInteger(value) && Math.abs(value) <= MAX_ADJUST_POINTS) contribution = { kind, value };
    else if (kind === "MULTIPLIER" && isNum(value) && value >= 0 && value <= EXCEL_MULTIPLIER_MAX && twoDecimals(value)) contribution = { kind, value };
    else return { status: "INVALID", message: "기여도를 확인해 주세요." };
  }
  entry.contribution = contribution;
  return { status: "SAVED" };
}
