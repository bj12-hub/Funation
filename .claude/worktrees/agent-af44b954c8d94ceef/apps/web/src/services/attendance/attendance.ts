"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { toDateString } from "@/lib/period";
import { getSession } from "@/lib/session";
import { currentPersonKey, mockAccount } from "@/services/account/mockStore";
import { accountSince } from "@/services/account/withdrawalCore";
import { recordCredit } from "@/services/wallet/mockCreditStore";
import type { AttendanceReward, AttendanceSummary, CheckInResult, ClaimResult } from "./attendanceTypes";

/**
 * Daily attendance and cumulative rewards. Route `/attendance` (signed-in members).
 *
 * The server decides the date, the streak and every reward. A member can check in once per server
 * day (a repeated call returns ALREADY_CHECKED_IN) and claim each reward once, so both actions are
 * naturally idempotent. FN credits must be recorded as wallet transactions by the backend.
 *
 * 2026-10-08 결정:
 * - The 15- and 30-day rewards are paid automatically the moment they are reached (no claim step that can be
 *   missed at a month change), once per month each, with a wallet REWARD record; the 3- and 7-day rewards are
 *   still claimed on the screen.
 * - One check-in per day per person: today's check-in is keyed by the phone verified at sign-up, so a withdrawal
 *   and a same-day 재가입 with the same phone finds today already done. Otherwise a 재가입 account starts with no
 *   progress and none of the withdrawn account's rewards.
 *
 * TBD: reward amounts, time zone, non-FN items (sticker, profile border), other abuse prevention. The mock
 * follows the Figma copy.
 */

export async function getAttendance(): Promise<AttendanceSummary | null> {
  if (!USE_MOCK) throw new Error("Attendance API is not connected yet.");
  if (!(await getSession())) return null;
  await mockDelay(300);
  return summarize(state(), checkedInTodayByPerson());
}

export async function checkIn(): Promise<CheckInResult> {
  if (!USE_MOCK) throw new Error("Attendance API is not connected yet.");
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const s = state();
  const now = new Date();
  const today = now.getDate();
  if (s.checked.includes(today) || checkedInTodayByPerson(now)) return { status: "ALREADY_CHECKED_IN" };
  // Recorded before the delay so a concurrent call sees it.
  s.checked.push(today);
  attendanceStore().lastCheckInByPerson.set(currentPersonKey(), toDateString(now));
  const autoPaid = REWARDS.filter((r) => r.auto && r.days <= s.checked.length && !s.claimed.includes(r.days));
  s.claimed.push(...autoPaid.map((r) => r.days));
  await mockDelay(500);
  mockAccount.fnBalance += DAILY_REWARD;
  recordCredit(DAILY_REWARD, "출석체크");
  for (const r of autoPaid) {
    mockAccount.fnBalance += r.fnAmount;
    recordCredit(r.fnAmount, `출석 ${r.days}일 보상`);
  }
  const summary = summarize(s, true);
  const claimable = summary.rewards.find((r) => r.status === "CLAIMABLE" && r.days === s.checked.length) ?? null;
  return {
    status: "CHECKED_IN",
    reward: DAILY_REWARD,
    balance: mockAccount.fnBalance,
    claimable,
    autoPaid: summary.rewards.filter((r) => autoPaid.some((a) => a.days === r.days))
  };
}

export async function claimAttendanceReward(days: unknown): Promise<ClaimResult> {
  if (!USE_MOCK) throw new Error("Attendance API is not connected yet.");
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const s = state();
  // Automatic rewards are never CLAIMABLE, so they cannot be claimed (or paid) a second time here.
  const reward = summarize(s, checkedInTodayByPerson()).rewards.find((r) => r.days === days);
  if (!reward || reward.status !== "CLAIMABLE") return { status: "NOT_CLAIMABLE" };
  s.claimed.push(reward.days); // before the delay: a second click finds it claimed
  await mockDelay(400);
  mockAccount.fnBalance += reward.fnAmount;
  recordCredit(reward.fnAmount, `출석 ${reward.days}일 보상`);
  return { status: "CLAIMED", fnAmount: reward.fnAmount, balance: mockAccount.fnBalance };
}

// ── Mock data ────────────────────────────────────────────────────────────────

const DAILY_REWARD = 50; // Figma 583:105 "50 FN을 받아 가세요!"

/** Figma 583:300 reward cards; `auto`: paid the moment it is reached (2026-10-08 결정). */
const REWARDS: Omit<AttendanceReward, "status">[] = [
  { days: 3, fnAmount: 100, emoji: "🪙", description: "누구나 쉽게 달성 가능!", auto: false },
  { days: 7, fnAmount: 300, emoji: "🪙", description: "매주 일요일 자동 충전", auto: false },
  { days: 15, fnAmount: 500, emoji: "🏆", description: "프로필용 스페셜 스티커", auto: true },
  { days: 30, fnAmount: 1_000, emoji: "👑", description: "완벽 출석 크리에이터 전용 테두리", auto: true }
];

/** `account`: the account's start marker (`accountSince()`), so a 재가입 account never reads the withdrawn one's month. */
type AttendanceState = { account: string | null; year: number; month: number; checked: number[]; claimed: number[] };
/** `lastCheckInByPerson`: verified phone → "YYYY-MM-DD" of that person's last check-in, across accounts. */
type AttendanceStore = { month: AttendanceState | null; lastCheckInByPerson: Map<string, string> };

const globalForAttendance = globalThis as typeof globalThis & { __funationMockAttendanceV2?: AttendanceStore };
const attendanceStore = () => (globalForAttendance.__funationMockAttendanceV2 ??= { month: null, lastCheckInByPerson: new Map() });

const checkedInTodayByPerson = (now = new Date()) => attendanceStore().lastCheckInByPerson.get(currentPersonKey()) === toDateString(now);

/**
 * This month of the current account. The sample account is seeded like Figma 583:4 (every earlier day this month
 * checked, the 3·7-day rewards claimed and any automatic reward already reached paid); a 재가입 account starts empty.
 */
function state(): AttendanceState {
  const now = new Date();
  const account = accountSince();
  const store = attendanceStore();
  const current = store.month;
  if (current && current.account === account && current.year === now.getFullYear() && current.month === now.getMonth() + 1) return current;
  const seeded = account === null;
  const checked = seeded ? Array.from({ length: now.getDate() - 1 }, (_, i) => i + 1) : [];
  const claimed = seeded ? [3, 7, ...REWARDS.filter((r) => r.auto && r.days <= checked.length).map((r) => r.days)] : [];
  return (store.month = { account, year: now.getFullYear(), month: now.getMonth() + 1, checked, claimed });
}

function summarize(s: AttendanceState, checkedInToday: boolean): AttendanceSummary {
  const now = new Date();
  const today = now.getDate();
  const checked = new Set(s.checked);
  let streak = 0;
  for (let day = checked.has(today) ? today : today - 1; day >= 1 && checked.has(day); day--) streak++;
  const total = checked.size;
  return {
    year: s.year,
    month: s.month,
    today,
    daysInMonth: new Date(s.year, s.month, 0).getDate(),
    firstWeekday: new Date(s.year, s.month - 1, 1).getDay(),
    checkedDays: [...checked].sort((a, b) => a - b),
    // Also true when this person already checked in today on a withdrawn account (once a day per person).
    checkedInToday: checked.has(today) || checkedInToday,
    streak,
    total,
    dailyReward: DAILY_REWARD,
    rewards: REWARDS.map((r) => ({
      ...r,
      status: s.claimed.includes(r.days) ? "CLAIMED" : !r.auto && total >= r.days ? "CLAIMABLE" : "LOCKED"
    }))
  };
}
