import { CREDITS_SECTIONS, DEFAULT_CREDITS, EMPTY_TEXT_SLOT, TEXT_SLOTS, TIMER_DONATION_UNIT_FN, TIMER_MAX_SEC, type BingoState, type TimerState, type ToolStates } from "./broadcastToolTypes";

/**
 * 방송 도구 state (server-only, not a "use server" module): the tool actions (./broadcastTools.ts) write it, the overlays
 * read it, and the Donation Core reaches the timer's 후원 연동 through `addTimerForDonation`.
 */

/** A sample 3 × 3 board (generic missions) so the card and overlay have something to show. */
function sampleBingo(): BingoState {
  const cells = ["노래 한 곡", "댄스 챌린지", "성대모사", "사연 읽기", "물 한 잔", "애교 한 번", "삼행시", "퀴즈 한 문제", "게임 한 판"];
  return { title: "오늘의 미션 빙고", size: 3, cells, marked: cells.map(() => false), goal: 1, shown: false };
}

const emptySlots = () => Array.from({ length: TEXT_SLOTS }, () => ({ ...EMPTY_TEXT_SLOT }));

// V2: credits gained rollingSince.
const g = globalThis as typeof globalThis & { __ssumnationMockToolsV2?: ToolStates };
export const tools = (g.__ssumnationMockToolsV2 ??= {
  subtitle: { text: "", size: "M" },
  marquee: { lines: ["오늘도 방송에 와 주셔서 감사합니다!"], speed: "NORMAL" },
  timer: { mode: "COUNTDOWN", durationSec: 600, startedAt: null, elapsedBeforeSec: 0, donationSec: 0 },
  credits: { ...structuredClone(DEFAULT_CREDITS), rollingSince: null },
  bingo: sampleBingo(),
  text: { slots: emptySlots() }
});
// 빙고 was added on 2026-10-06; dev stores from before start with the sample board.
tools.bingo ??= sampleBingo();
// Credits saved before the sections (2026-10-23) keep their title, thanks and roll; 크루 순위 포함 becomes 멤버별.
if (!("sections" in tools.credits)) {
  const old = tools.credits as { title: string; thanks: string[]; includeCrew?: boolean; rollingSince: string | null };
  tools.credits = { ...structuredClone(DEFAULT_CREDITS), title: old.title, thanks: old.thanks, rollingSince: old.rollingSince };
  tools.credits.sections.members.on = old.includeCrew !== false;
}
// HOT 시그 · HIGH 시그 (2026-10-25): sections saved before them start at their defaults.
for (const meta of CREDITS_SECTIONS) tools.credits.sections[meta.key] ??= structuredClone(DEFAULT_CREDITS.sections[meta.key]);
// MVP 기준 (2026-10-28): 기여도, as before.
tools.credits.mvpBasis ??= "POINTS";
// 타이머 후원 연동 and 텍스트 슬롯 (2026-10-23): off / empty for stores from before.
tools.timer.donationSec ??= 0;
tools.text ??= { slots: emptySlots() };

/** Seconds of the timer as shown now (countdown: left; stopwatch: elapsed), and those already run. */
export function timerShown(t: TimerState, now = Date.now()) {
  const running = t.startedAt ? Math.floor((now - new Date(t.startedAt).getTime()) / 1000) : 0;
  const elapsed = t.elapsedBeforeSec + running;
  // Countdown shows 0 once it ran out, so time added after the end counts from 0.
  return { running, shown: t.mode === "COUNTDOWN" ? Math.max(0, t.durationSec - elapsed) : elapsed };
}

/** Moves the shown time by `deltaSec`, clamped to 0 … TIMER_MAX_SEC, running or paused. */
export function shiftTimer(t: TimerState, deltaSec: number, now = Date.now()) {
  const { running, shown } = timerShown(t, now);
  const target = Math.min(TIMER_MAX_SEC, Math.max(0, shown + deltaSec));
  const targetElapsed = t.mode === "COUNTDOWN" ? t.durationSec - target : target;
  t.elapsedBeforeSec = targetElapsed - running;
}

/**
 * 타이머 후원 연동 (2026-10-23): called by the Donation Core for a completed 썸네이션 후원 to the studio channel. A countdown
 * with 후원 연동 on gets `donationSec` for every whole 1,000 FN (a 2,500 FN donation adds two steps); a stopwatch, an
 * off link or less than 1,000 FN change nothing. Returns the seconds added.
 */
export function addTimerForDonation(fnAmount: number, now = Date.now()) {
  const t = tools.timer;
  if (t.mode !== "COUNTDOWN" || t.donationSec <= 0) return 0;
  const add = Math.floor(fnAmount / TIMER_DONATION_UNIT_FN) * t.donationSec;
  if (add > 0) shiftTimer(t, add, now);
  return add;
}
