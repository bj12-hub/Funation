/**
 * 방송 도구 (자막 · 전광판 · 타이머 · 엔딩 크레딧) — code-first, no Figma frame
 * (docs/figma/code-first-screens.md). Reference: docs/research/funnation-reference.md §3 위젯.
 * Each tool has an OBS overlay at `/overlay/tool/[tool]/[integrationKey]`. Styles, fonts and
 * donation-driven effects (이모지 · 레이어 효과) are TBD.
 */

export const TOOL_KEYS = ["subtitle", "marquee", "timer", "credits"] as const;
export type ToolKey = (typeof TOOL_KEYS)[number];
export const isToolKey = (v: unknown): v is ToolKey => TOOL_KEYS.includes(v as ToolKey);

export const TOOL_CARDS: { key: ToolKey; emoji: string; title: string; description: string }[] = [
  { key: "subtitle", emoji: "💬", title: "자막", description: "리모컨에서 입력한 문구를 방송 화면에 실시간으로 띄워요." },
  { key: "marquee", emoji: "📢", title: "전광판", description: "공지 문구를 화면 가로로 흘려 보여 줘요." },
  { key: "timer", emoji: "⏱️", title: "타이머", description: "카운트다운 또는 스톱워치를 화면에 표시해요." },
  { key: "credits", emoji: "🎬", title: "엔딩 크레딧", description: "방송 마무리에 크루 순위와 감사 인사를 흘려 보여 줘요." }
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

export type ToolStates = { subtitle: SubtitleState; marquee: MarqueeState; timer: TimerState; credits: CreditsState };

export type ToolsView = { states: ToolStates; overlayBase: string; crew: { name: string; score: number }[] };

export type TimerAction = "START" | "PAUSE" | "RESET";
/** 퀵 조정 (seconds added to the shown time; negative subtracts). */
export const TIMER_ADJUST_STEPS = [-60, -30, 30, 60] as const;

export type ToolResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** `on` = 리모컨 기능 제어 ON/OFF. */
export type OverlayTool = (
  | { tool: "subtitle"; state: SubtitleState }
  | { tool: "marquee"; state: MarqueeState }
  | { tool: "timer"; state: TimerState; serverNow: string }
  | { tool: "credits"; state: CreditsState; crew: { name: string; score: number }[] }
) & { reloadSeq: number; on: boolean };
