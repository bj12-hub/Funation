"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { recordCredit } from "@/services/wallet/mockCreditStore";
import type { AttendanceReward, AttendanceSummary, CheckInResult, ClaimResult } from "./attendanceTypes";

/**
 * Daily attendance and cumulative rewards. Route `/attendance` (signed-in members).
 *
 * The server decides the date, the streak and every reward. A member can check in once per server
 * day (a repeated call returns ALREADY_CHECKED_IN) and claim each reward once, so both actions are
 * naturally idempotent. FN credits must be recorded as wallet transactions by the backend.
 *
 * TBD: reward policy (amounts, whether counts reset monthly), time zone, non-FN items
 * (sticker, profile border), abuse prevention. The mock follows the Figma copy.
 */

export async function getAttendance(): Promise<AttendanceSummary | null> {
  if (!USE_MOCK) throw new Error("Attendance API is not connected yet.");
  if (!(await getSession())) return null;
  await mockDelay(300);
  return summarize(state());
}

export async function checkIn(): Promise<CheckInResult> {
  if (!USE_MOCK) throw new Error("Attendance API is not connected yet.");
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const s = state();
  const today = new Date().getDate();
  if (s.checked.includes(today)) return { status: "ALREADY_CHECKED_IN" };
  s.checked.push(today); // recorded before the delay so a concurrent call sees it
  await mockDelay(500);
  mockAccount.fnBalance += DAILY_REWARD;
  recordCredit(DAILY_REWARD, "출석체크");
  const claimable = summarize(s).rewards.find((r) => r.status === "CLAIMABLE" && r.days === s.checked.length) ?? null;
  return { status: "CHECKED_IN", reward: DAILY_REWARD, balance: mockAccount.fnBalance, claimable };
}

export async function claimAttendanceReward(days: unknown): Promise<ClaimResult> {
  if (!USE_MOCK) throw new Error("Attendance API is not connected yet.");
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const s = state();
  const reward = summarize(s).rewards.find((r) => r.days === days);
  if (!reward || reward.status !== "CLAIMABLE") return { status: "NOT_CLAIMABLE" };
  s.claimed.push(reward.days); // before the delay: a second click finds it claimed
  await mockDelay(400);
  mockAccount.fnBalance += reward.fnAmount;
  recordCredit(reward.fnAmount, `출석 ${reward.days}일 보상`);
  return { status: "CLAIMED", fnAmount: reward.fnAmount, balance: mockAccount.fnBalance };
}

// ── Mock data ────────────────────────────────────────────────────────────────

const DAILY_REWARD = 50; // Figma 583:105 "50 FN을 받아 가세요!"

/** Figma 583:300 reward cards. */
const REWARDS: Omit<AttendanceReward, "status">[] = [
  { days: 3, fnAmount: 100, emoji: "🪙", description: "누구나 쉽게 달성 가능!" },
  { days: 7, fnAmount: 300, emoji: "🪙", description: "매주 일요일 자동 충전" },
  { days: 15, fnAmount: 500, emoji: "🏆", description: "프로필용 스페셜 스티커" },
  { days: 30, fnAmount: 1_000, emoji: "👑", description: "완벽 출석 크리에이터 전용 테두리" }
];

type AttendanceState = { year: number; month: number; checked: number[]; claimed: number[] };

const globalForAttendance = globalThis as typeof globalThis & { __funationMockAttendance?: AttendanceState };

/** Seeded like Figma 583:4: every earlier day this month checked, 3·7-day rewards claimed. */
function state(): AttendanceState {
  const now = new Date();
  const current = globalForAttendance.__funationMockAttendance;
  if (current && current.year === now.getFullYear() && current.month === now.getMonth() + 1) return current;
  return (globalForAttendance.__funationMockAttendance = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    checked: Array.from({ length: now.getDate() - 1 }, (_, i) => i + 1),
    claimed: [3, 7]
  });
}

function summarize(s: AttendanceState): AttendanceSummary {
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
    checkedInToday: checked.has(today),
    streak,
    total,
    dailyReward: DAILY_REWARD,
    rewards: REWARDS.map((r) => ({
      ...r,
      status: s.claimed.includes(r.days) ? "CLAIMED" : total >= r.days ? "CLAIMABLE" : "LOCKED"
    }))
  };
}
