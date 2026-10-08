import type { OverlayAppearance, OverlayThemeChoice, ResolvedTheme } from "./overlayThemeTypes";

/**
 * 방송 도구 (자막 · 전광판 · 타이머 · 엔딩 크레딧 · 빙고) — code-first, no Figma frame
 * (docs/figma/code-first-screens.md). Reference: docs/research/funnation-reference.md §3 위젯.
 * Each tool has an OBS overlay at `/overlay/tool/[tool]/[integrationKey]`. Styles, fonts and
 * donation-driven effects (이모지 · 레이어 효과) are TBD.
 */

export const TOOL_KEYS = ["subtitle", "marquee", "timer", "credits", "bingo"] as const;
export type ToolKey = (typeof TOOL_KEYS)[number];
export const isToolKey = (v: unknown): v is ToolKey => TOOL_KEYS.includes(v as ToolKey);

export const TOOL_CARDS: { key: ToolKey; emoji: string; title: string; description: string }[] = [
  { key: "subtitle", emoji: "💬", title: "자막", description: "리모컨에서 입력한 문구를 방송 화면에 실시간으로 띄워요." },
  { key: "marquee", emoji: "📢", title: "전광판", description: "공지 문구를 화면 가로로 흘려 보여 줘요." },
  { key: "timer", emoji: "⏱️", title: "타이머", description: "카운트다운 또는 스톱워치를 화면에 표시해요." },
  { key: "credits", emoji: "🎬", title: "엔딩 크레딧", description: "방송 마무리에 크루 순위와 감사 인사를 흘려 보여 줘요." },
  { key: "bingo", emoji: "🎯", title: "빙고", description: "칸마다 미션을 적은 빙고판을 띄우고, 해낸 칸을 눌러 표시해요. 완성한 줄 수를 함께 보여 줘요." }
];

export const SUBTITLE_MAX = 80;
export const MARQUEE_LINE_MAX = 60;
export const MARQUEE_LINES_MAX = 5;
export const CREDITS_LINE_MAX = 40;
export const CREDITS_LINES_MAX = 10;
export const TIMER_MAX_SEC = 24 * 3600;

export type SubtitleState = { text: string; size: "S" | "M" | "L" };
export type MarqueeState = { lines: string[]; speed: "SLOW" | "NORMAL" | "FAST" };
/** Countdown runs from `durationSec`; the stopwatch counts up. `startedAt` null = stopped/paused. */
export type TimerState = { mode: "COUNTDOWN" | "STOPWATCH"; durationSec: number; startedAt: string | null; elapsedBeforeSec: number };
/** `rollingSince` null = not rolling (overlay hidden); a new value restarts the roll. */
export type CreditsState = { title: string; thanks: string[]; includeCrew: boolean; rollingSince: string | null };

/**
 * 빙고 (funnation 엑셀방송 빙고, 2026-10-06 결정): a size × size board of missions the creator marks by hand.
 * `cells` · `marked` are row by row (size² each); `goal` = lines needed for 빙고; `shown` = on the overlay.
 */
export type BingoSize = 3 | 4 | 5;
export type BingoState = { title: string; size: BingoSize; cells: string[]; marked: boolean[]; goal: number; shown: boolean };

export const BINGO_SIZES: BingoSize[] = [3, 4, 5];
export const BINGO_TITLE_MAX = 30;
export const BINGO_CELL_MAX = 20;
/** Rows + columns + both diagonals. */
export const bingoLinesMax = (size: number) => size * 2 + 2;

/** Complete lines (rows, columns, the two diagonals) on a board whose marks are row by row. */
export function bingoLines(size: number, marked: boolean[]): number {
  const at = (r: number, c: number) => marked[r * size + c] === true;
  const idx = Array.from({ length: size }, (_, i) => i);
  let n = 0;
  for (const r of idx) if (idx.every((c) => at(r, c))) n++;
  for (const c of idx) if (idx.every((r) => at(r, c))) n++;
  if (idx.every((i) => at(i, i))) n++;
  if (idx.every((i) => at(i, size - 1 - i))) n++;
  return n;
}

/** The board resized to `size`: kept cells stay in place by row and column, new ones are empty and unmarked. */
export function resizeBingo(from: Pick<BingoState, "size" | "cells" | "marked">, size: BingoSize): Pick<BingoState, "cells" | "marked"> {
  const cells: string[] = [];
  const marked: boolean[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inside = r < from.size && c < from.size;
      cells.push(inside ? (from.cells[r * from.size + c] ?? "") : "");
      marked.push(inside ? from.marked[r * from.size + c] === true : false);
    }
  }
  return { cells, marked };
}

export type ToolStates = { subtitle: SubtitleState; marquee: MarqueeState; timer: TimerState; credits: CreditsState; bingo: BingoState };

/**
 * 방송 도구 테마 (2026-10-08 오버레이 테마): one choice for every tool overlay (전체 테마 따르기 by default); `appearance`
 * is the channel's 전체 테마 so the screen can name what 따르기 means.
 */
export type ToolsView = { states: ToolStates; overlayBase: string; crew: { name: string; score: number }[]; theme: OverlayThemeChoice; appearance: OverlayAppearance };

export type TimerAction = "START" | "PAUSE" | "RESET";
/** 퀵 조정 (seconds added to the shown time; negative subtracts). */
export const TIMER_ADJUST_STEPS = [-60, -30, 30, 60] as const;

export type ToolResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** `on` = 리모컨 기능 제어 ON/OFF. */
/** `theme`: the tools' 오버레이 테마 resolved against the 전체 테마. */
export type OverlayTool = (
  | { tool: "subtitle"; state: SubtitleState }
  | { tool: "marquee"; state: MarqueeState }
  | { tool: "timer"; state: TimerState; serverNow: string }
  | { tool: "credits"; state: CreditsState; crew: { name: string; score: number }[] }
  | { tool: "bingo"; state: BingoState }
) & { reloadSeq: number; on: boolean; theme: ResolvedTheme };
