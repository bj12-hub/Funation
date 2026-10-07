/**
 * Attendance (출석체크) types. Client-safe; the actions live in ./attendance.ts.
 * Figma: 583:4 (before check-in) · 585:452 (checked in) · 585:66 (완료 popup) · 585:830 (보상 popup)
 */

export type RewardStatus = "CLAIMED" | "CLAIMABLE" | "LOCKED";

export type AttendanceReward = {
  /** Cumulative check-ins this month required for the reward. */
  days: number;
  fnAmount: number;
  emoji: string;
  description: string;
  /** Paid automatically the moment it is reached, never claimed on the screen (2026-10-08 결정: 15·30일). */
  auto: boolean;
  /** An automatic reward is CLAIMED once paid and LOCKED until then; it is never CLAIMABLE. */
  status: RewardStatus;
};

export type AttendanceSummary = {
  /** Server date (the backend decides the time zone; TBD). */
  year: number;
  month: number;
  today: number;
  daysInMonth: number;
  /** 0 = Sunday. */
  firstWeekday: number;
  checkedDays: number[];
  checkedInToday: boolean;
  /** Consecutive days up to today (or yesterday when today is not checked yet). */
  streak: number;
  /** Check-ins this month. */
  total: number;
  /** FN granted for a daily check-in. */
  dailyReward: number;
  rewards: AttendanceReward[];
};

export type CheckInResult =
  /** `autoPaid`: automatic rewards this check-in reached and paid (already in `balance`). */
  | { status: "CHECKED_IN"; reward: number; balance: number; claimable: AttendanceReward | null; autoPaid: AttendanceReward[] }
  | { status: "ALREADY_CHECKED_IN" | "UNAUTHORIZED" };

export type ClaimResult = { status: "CLAIMED"; fnAmount: number; balance: number } | { status: "NOT_CLAIMABLE" | "UNAUTHORIZED" };
