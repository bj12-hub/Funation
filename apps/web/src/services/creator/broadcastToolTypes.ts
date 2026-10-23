import type { OverlayAppearance, OverlayThemeChoice, ResolvedTheme } from "./overlayThemeTypes";

/**
 * 방송 도구 (자막 · 전광판 · 타이머 · 엔딩 크레딧 · 빙고) — code-first, no Figma frame
 * (docs/figma/code-first-screens.md). Reference: docs/research/funnation-reference.md §3 위젯.
 * Each tool has an OBS overlay at `/overlay/tool/[tool]/[integrationKey]`. Styles, fonts and
 * donation-driven effects (이모지 · 레이어 효과) are TBD.
 */

export const TOOL_KEYS = ["subtitle", "marquee", "timer", "credits", "bingo", "text"] as const;
export type ToolKey = (typeof TOOL_KEYS)[number];
export const isToolKey = (v: unknown): v is ToolKey => TOOL_KEYS.includes(v as ToolKey);

export const TOOL_CARDS: { key: ToolKey; emoji: string; title: string; description: string }[] = [
  { key: "subtitle", emoji: "💬", title: "자막", description: "리모컨에서 입력한 문구를 방송 화면에 실시간으로 띄워요." },
  { key: "marquee", emoji: "📢", title: "전광판", description: "공지 문구를 화면 가로로 흘려 보여 줘요." },
  { key: "timer", emoji: "⏱️", title: "타이머", description: "카운트다운 또는 스톱워치를 화면에 표시해요." },
  { key: "credits", emoji: "🎬", title: "엔딩 크레딧", description: "방송 마무리에 총 후원 · MVP · 후원자 순위 · 멤버별 순위와 감사 인사를 영화 크레딧이나 스타워즈 크롤로 흘려 보여 줘요." },
  { key: "bingo", emoji: "🎯", title: "빙고", description: "칸마다 미션을 적은 빙고판을 띄우고, 해낸 칸을 눌러 표시해요. 완성한 줄 수를 함께 보여 줘요." },
  { key: "text", emoji: "📝", title: "텍스트 슬롯", description: "문구를 슬롯 20개에 저장해 두고 슬롯마다 다른 OBS 주소로 띄워요. 줄바꿈 · 크기 · 색 · 세로 스크롤을 슬롯마다 정해요." }
];

export const SUBTITLE_MAX = 80;
export const MARQUEE_LINE_MAX = 60;
export const MARQUEE_LINES_MAX = 5;
export const CREDITS_LINE_MAX = 40;
export const CREDITS_LINES_MAX = 10;
export const TIMER_MAX_SEC = 24 * 3600;

export type SubtitleState = { text: string; size: "S" | "M" | "L" };
export type MarqueeState = { lines: string[]; speed: "SLOW" | "NORMAL" | "FAST" };
/**
 * Countdown runs from `durationSec`; the stopwatch counts up. `startedAt` null = stopped/paused. `donationSec`: 후원 연동
 * (2026-10-23, StreamDonate 타이머 참고) — every completed 썸네이션 후원 adds this many seconds per 1,000 FN to a countdown
 * (0 = off; kept when the timer is set up again).
 */
export type TimerState = { mode: "COUNTDOWN" | "STOPWATCH"; durationSec: number; startedAt: string | null; elapsedBeforeSec: number; donationSec: number };
export const TIMER_DONATION_SEC_MAX = 600;
/** 후원 연동 counts whole thousands: 2,500 FN adds 2 × `donationSec`. */
export const TIMER_DONATION_UNIT_FN = 1_000;
/**
 * 엔딩 크레딧 (2026-10-23 섹션 확장, StreamDonate 엔딩 크레딧 참고 — docs/research/streamdonate-reference.md P1-3):
 * FILM rolls the page up like a film's credits, CRAWL is the 스타워즈 크롤 (yellow text sliding away into the screen).
 */
export type CreditsStyle = "FILM" | "CRAWL";
export const CREDITS_STYLES: { key: CreditsStyle; label: string }[] = [
  { key: "FILM", label: "영화 크레딧" },
  { key: "CRAWL", label: "스타워즈 크롤" }
];
/** TODAY: today (Korea time) until now. CREW: the crew broadcast on now, or the last one that ended (its start ~ end). */
export type CreditsPeriod = "TODAY" | "CREW";
export const CREDITS_PERIODS: { key: CreditsPeriod; label: string }[] = [
  { key: "TODAY", label: "오늘" },
  { key: "CREW", label: "크루 방송" }
];
export const CREDITS_DURATION_MIN = 15;
export const CREDITS_DURATION_MAX = 180;
export const CREDITS_SECTION_TITLE_MAX = 20;
export const CREDITS_LIST_MAX = 30;

/** Sections in the order they roll; `max` = how many rows a list shows. Titles left blank use the default. */
export const CREDITS_SECTIONS = [
  { key: "total", label: "총 후원", title: "총 후원", list: false },
  { key: "mvp", label: "MVP", title: "MVP", list: false },
  { key: "top3", label: "후원자 TOP 3", title: "후원자 TOP 3", list: false },
  { key: "donors", label: "후원 순위", title: "후원 순위", list: true },
  { key: "members", label: "멤버별", title: "멤버별 순위", list: true }
] as const;
export type CreditsSectionKey = (typeof CREDITS_SECTIONS)[number]["key"];
export type CreditsSection = { on: boolean; title: string; max: number };

/** `rollingSince` null = not rolling (overlay hidden); a new value restarts the roll. `thanks` roll last. */
export type CreditsState = {
  title: string;
  thanks: string[];
  style: CreditsStyle;
  durationSec: number;
  period: CreditsPeriod;
  sections: Record<CreditsSectionKey, CreditsSection>;
  rollingSince: string | null;
};

export const DEFAULT_CREDITS: Omit<CreditsState, "rollingSince"> = {
  title: "오늘의 방송을 함께해 주신 분들",
  thanks: ["시청해 주신 모든 분들 감사합니다"],
  style: "FILM",
  durationSec: 40,
  period: "TODAY",
  sections: {
    total: { on: true, title: "", max: 1 },
    mvp: { on: true, title: "", max: 1 },
    top3: { on: true, title: "", max: 3 },
    donors: { on: true, title: "", max: 10 },
    members: { on: true, title: "", max: 10 }
  }
};

/**
 * What the credits show, computed on the server for the period. Donor names follow the 후원랭킹 rules (익명 and names
 * the 대체 메시지 rules replaced are left out); `total` counts every completed Ssumnation donation (FN). `members`: the
 * crew — FN sent for each member today, or the crew scoreboard's points (`unit` 점) on the CREW period. `mvp` = the
 * first member with more than 0. `periodLabel` names the period ("오늘" · the broadcast's title); `empty` = no crew
 * broadcast to read on the CREW period.
 */
export type CreditsData = {
  periodLabel: string;
  empty: boolean;
  total: number;
  donors: { rank: number; name: string; fnAmount: number }[];
  members: { rank: number; name: string; score: number }[];
  memberUnit: "FN" | "점";
  mvp: { name: string; score: number } | null;
};

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

/**
 * 텍스트 슬롯 (2026-10-23, StreamDonate 텍스트 오버레이 참고): TEXT_SLOTS saved texts, each with its own look, each on its own
 * OBS address (`?slot=N`). An empty text shows nothing. `scroll`: the text runs up the source and starts again.
 */
export const TEXT_SLOTS = 20;
export const TEXT_SLOT_NAME_MAX = 20;
export const TEXT_SLOT_TEXT_MAX = 300;
export const TEXT_SIZES = [16, 20, 24, 28, 32, 40, 48, 56, 64, 72, 96, 120] as const;
export const TEXT_SCROLL_SEC = { min: 5, max: 120 } as const;
export const TEXT_ALIGNS = [
  { key: "LEFT", label: "왼쪽" },
  { key: "CENTER", label: "가운데" },
  { key: "RIGHT", label: "오른쪽" }
] as const;
export type TextSlot = {
  name: string;
  text: string;
  size: number;
  color: string;
  bold: boolean;
  outline: boolean;
  /** CARD: on the 방송 도구 테마 card (its colors win over `color`); NONE: straight on the stream. */
  background: "NONE" | "CARD";
  align: (typeof TEXT_ALIGNS)[number]["key"];
  scroll: boolean;
  scrollSec: number;
};
export const EMPTY_TEXT_SLOT: TextSlot = { name: "", text: "", size: 32, color: "#FFFFFF", bold: true, outline: true, background: "NONE", align: "LEFT", scroll: false, scrollSec: 20 };

export type ToolStates = { subtitle: SubtitleState; marquee: MarqueeState; timer: TimerState; credits: CreditsState; bingo: BingoState; text: { slots: TextSlot[] } };

/**
 * 방송 도구 테마 (2026-10-08 오버레이 테마): one choice for every tool overlay (전체 테마 따르기 by default); `appearance`
 * is the channel's 전체 테마 so the screen can name what 따르기 means.
 */
export type ToolsView = { states: ToolStates; overlayBase: string; credits: CreditsData; theme: OverlayThemeChoice; appearance: OverlayAppearance };

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
  | { tool: "credits"; state: CreditsState; data: CreditsData }
  | { tool: "bingo"; state: BingoState }
  /** `slot`: 1 … TEXT_SLOTS (the address's `?slot=`, 1 when left out). */
  | { tool: "text"; slot: number; state: TextSlot }
) & { reloadSeq: number; on: boolean; theme: ResolvedTheme };
