import { randomInt } from "node:crypto";
import {
  CREDITS_SECTIONS,
  DEFAULT_CREDITS,
  DEFAULT_WHEEL,
  EMPTY_TEXT_SLOT,
  TEXT_SLOTS,
  TIMER_DONATION_UNIT_FN,
  TIMER_MAX_SEC,
  WHEEL_COLORS,
  WHEEL_RESULT_SEC,
  WHEEL_SPINS_KEPT,
  WHEEL_STOP_SEC,
  type BingoState,
  type TimerState,
  type ToolStates,
  type WheelSpin,
  type WheelState
} from "./broadcastToolTypes";

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
  text: { slots: emptySlots() },
  wheel: { settings: structuredClone(DEFAULT_WHEEL), spins: [] }
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
// 원형 룰렛 (2026-10-30): empty for stores from before.
tools.wheel ??= { settings: structuredClone(DEFAULT_WHEEL), spins: [] };
// 텍스트 슬롯 스타일 (2026-10-28): slots saved before read with the look they had.
tools.text.slots = tools.text.slots.map((s) => ({ ...EMPTY_TEXT_SLOT, ...s }));

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

// ── 원형 룰렛 (2026-10-30) ──────────────────────────────────────────────────────────────────────────────

const iso = (ms: number) => new Date(ms).toISOString();
/** When a stopped spin is done on screen (slowed down, result shown): the next one starts then. */
const doneAt = (s: WheelSpin) => (s.stopAt ? Date.parse(s.stopAt) + (WHEEL_STOP_SEC + WHEEL_RESULT_SEC) * 1000 : Infinity);

/** A slice index by ×수량, drawn on the server. */
export function drawWheel(slices: { qty: number }[]) {
  let n = randomInt(slices.reduce((s, x) => s + x.qty, 0));
  for (const [i, x] of slices.entries()) if ((n -= x.qty) < 0) return i;
  return slices.length - 1;
}

/**
 * Times the queue: a waiting spin starts when the one before is done; a 자동 멈춤 spin starts slowing down as it starts.
 * Old spins past WHEEL_SPINS_KEPT are dropped once done.
 */
export function settleWheel(w: WheelState, now = Date.now()) {
  for (const [i, s] of w.spins.entries()) {
    const prev = w.spins[i - 1];
    if (!s.startAt && prev && Number.isFinite(doneAt(prev))) s.startAt = iso(doneAt(prev));
    if (s.startAt && s.stopMode === "AUTO" && !s.stopAt) s.stopAt = s.startAt;
  }
  while (w.spins.length > WHEEL_SPINS_KEPT && doneAt(w.spins[0]) <= now) w.spins.shift();
  return w;
}

/**
 * Queues a spin of the saved 칸 (`id`: a retry with the same id is the same spin). It starts now when nothing is on, else
 * after the ones before. Returns the spin, or why not.
 */
export function queueWheelSpin(w: WheelState, input: { id: string; trigger: WheelSpin["trigger"]; donor: string | null }, now = Date.now()): WheelSpin | string {
  settleWheel(w, now);
  const same = w.spins.find((s) => s.id === input.id);
  if (same) return same;
  const items = w.settings.items;
  if (!items.length) return "룰렛 칸을 먼저 저장해 주세요.";
  const slices = items.map((it, i) => ({ label: it.label, qty: it.qty, color: WHEEL_COLORS[i % WHEEL_COLORS.length] }));
  const last = w.spins.at(-1);
  const free = !last || doneAt(last) <= now;
  const mode = w.settings.stopMode;
  const spin: WheelSpin = {
    ...input,
    stopMode: mode,
    slices,
    result: mode === "AUTO" ? drawWheel(slices) : null,
    startAt: free ? iso(now) : null,
    stopAt: free && mode === "AUTO" ? iso(now) : null
  };
  w.spins.push(spin);
  return settleWheel(w, now).spins.find((s) => s.id === spin.id) ?? spin;
}

/** 멈춤 (수동 멈춤): the spinning one draws its result and slows down now. Returns why not, or null. */
export function stopWheelSpin(w: WheelState, now = Date.now()): string | null {
  settleWheel(w, now);
  const s = w.spins.find((x) => x.startAt && Date.parse(x.startAt) <= now && !x.stopAt);
  if (!s) return "돌아가고 있는 룰렛이 없어요.";
  s.result = drawWheel(s.slices);
  s.stopAt = iso(now);
  settleWheel(w, now);
  return null;
}

/** The spin on screen (the latest started) and how many wait. */
export function wheelNow(w: WheelState, now = Date.now()) {
  settleWheel(w, now);
  const started = w.spins.filter((s) => s.startAt && Date.parse(s.startAt) <= now);
  return { current: started.at(-1) ?? null, waiting: w.spins.length - started.length };
}

/**
 * 후원 시 자동 스핀 (2026-10-30): called by the Donation Core for a completed 썸네이션 후원 to the studio channel (a 퀘스트 후원
 * too — the spin is for fun, nothing is paid). Queues a spin when it is on and the 칸 are saved.
 */
export function spinWheelForDonation(donationId: string, donor: string, now = Date.now()) {
  if (!tools.wheel.settings.autoSpin || !tools.wheel.settings.items.length) return null;
  const s = queueWheelSpin(tools.wheel, { id: `wh-d-${donationId}`, trigger: "DONATION", donor }, now);
  return typeof s === "string" ? null : s;
}
