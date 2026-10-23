"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { overlayKeyOpen } from "@/services/account/creatorAccess";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { liveBroadcastOf, scoreboardRows } from "@/services/crew/crewCore";
import { STUDIO_CHANNEL, mockCrew } from "@/services/crew/mockCrewStore";
import {
  BINGO_CELL_MAX,
  BINGO_SIZES,
  BINGO_TITLE_MAX,
  CREDITS_DURATION_MAX,
  CREDITS_DURATION_MIN,
  CREDITS_LINES_MAX,
  CREDITS_LINE_MAX,
  CREDITS_LIST_MAX,
  CREDITS_PERIODS,
  CREDITS_SECTIONS,
  CREDITS_SECTION_TITLE_MAX,
  CREDITS_STYLES,
  DEFAULT_CREDITS,
  MARQUEE_LINES_MAX,
  MARQUEE_LINE_MAX,
  SUBTITLE_MAX,
  TEXT_ALIGNS,
  TEXT_SCROLL_SEC,
  TEXT_SIZES,
  TEXT_SLOTS,
  TEXT_SLOT_NAME_MAX,
  TEXT_SLOT_TEXT_MAX,
  TIMER_ADJUST_STEPS,
  TIMER_DONATION_SEC_MAX,
  TIMER_MAX_SEC,
  bingoLinesMax,
  isToolKey,
  type BingoSize,
  type CreditsData,
  type CreditsState,
  type OverlayTool,
  type TimerAction,
  type ToolResult,
  type ToolsView
} from "./broadcastToolTypes";
import { mockAlerts, overlaySignal } from "./alertCore";
import { donorRanking, rankingSince, totalBetween } from "./widgetOverlayCore";
import { overlayTheme, readAppearance } from "./overlayThemeStore";
import { isOverlayThemeChoice, type OverlayThemeChoice } from "./overlayThemeTypes";
import { mockCreator } from "./mockCreatorStore";
import { shiftTimer, tools } from "./broadcastToolsCore";

/**
 * 방송 도구 Server Actions — code-first (no Figma frame). Studio route `/creator/widgets/tools`,
 * overlays `/overlay/tool/[tool]/[key]` (integration key = secret, like the crew scoreboard).
 * TBD: overlay tokens separate from the integration key, style presets, audit of changes.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Broadcast tools API is not connected yet.");
};

/** 방송 도구 테마 (2026-10-08): one 오버레이 테마 choice for all tool overlays. */
const gt = globalThis as typeof globalThis & { __ssumnationMockToolThemeV1?: { theme: OverlayThemeChoice } };
const toolLook = () => (gt.__ssumnationMockToolThemeV1 ??= { theme: "INHERIT" });

const bad = (s: string) => MOCK_FORBIDDEN_WORDS.some((w) => s.toLowerCase().includes(w));

/**
 * The credits' numbers for its period (see CreditsData). Lists are cut to what the sections show: donors to TOP 3 + 후원
 * 순위, members to 멤버별 (MVP is the first member either way).
 */
function creditsData(s: CreditsState, now = new Date()): CreditsData {
  const items = mockAlerts.items;
  const crew = mockCrew.crews[STUDIO_CHANNEL] ?? [];
  let from: number;
  let to = now.getTime();
  let periodLabel = "오늘";
  let members: { name: string; score: number }[];
  if (s.period === "CREW") {
    const ofChannel = (mockCrew.broadcasts ?? []).filter((b) => b.channelId === STUDIO_CHANNEL);
    const b = liveBroadcastOf(STUDIO_CHANNEL) ?? [...ofChannel].filter((x) => x.endedAt).sort((x, y) => y.startedAt.localeCompare(x.startedAt))[0];
    if (!b) return { periodLabel: "크루 방송 없음", empty: true, total: 0, donors: [], members: [], memberUnit: "점", mvp: null };
    from = Date.parse(b.startedAt);
    if (b.endedAt) to = Date.parse(b.endedAt);
    periodLabel = b.project ? `${b.title} · ${b.project} ${b.round}회차` : b.title;
    // An ended broadcast keeps the ranking frozen at its end (members may be renamed or removed since).
    members = (b.final ?? scoreboardRows(b)).map((r) => ({ name: r.name, score: r.score }));
  } else {
    // Today in the service's time (Asia/Seoul), as the 후원랭킹 widget's 일간.
    from = rankingSince("일간", now);
    const sent = new Map<string, number>();
    for (const a of mockCrew.attributions) {
      const t = Date.parse(a.at);
      if (a.channelId === STUDIO_CHANNEL && t >= from && t <= to) sent.set(a.memberId, (sent.get(a.memberId) ?? 0) + a.fnAmount);
    }
    members = crew
      .filter((m) => m.active || sent.has(m.id))
      .map((m) => ({ name: m.name, score: sent.get(m.id) ?? 0 }))
      .sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
  }
  const { top3, donors, members: memberSection } = s.sections;
  const donorRows = donorRanking(items, from, to).slice(0, (top3.on ? 3 : 0) + (donors.on ? donors.max : 0));
  const first = members[0];
  return {
    periodLabel,
    empty: false,
    total: totalBetween(items, from, to),
    donors: donorRows,
    members: members.slice(0, memberSection.max).map((m, i) => ({ rank: i + 1, ...m })),
    memberUnit: s.period === "CREW" ? "점" : "FN",
    mvp: first && first.score > 0 ? { ...first } : null
  };
}

export async function getToolsView(): Promise<ToolsView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(150);
  return { states: structuredClone(tools), overlayBase: `/overlay/tool`, credits: creditsData(tools.credits), theme: toolLook().theme, appearance: readAppearance() };
}

/** 방송 도구 테마: applies to every tool overlay on its next read. */
export async function saveToolTheme(theme: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!isOverlayThemeChoice(theme)) return { status: "INVALID", message: "테마를 골라 주세요." };
  toolLook().theme = theme;
  return { status: "SAVED" };
}

/** The overlay key is only shown to the signed-in creator. */
export async function getOverlayKey(): Promise<string | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return mockCreator.integrationKey;
}

export async function saveSubtitle(input: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { text?: unknown; size?: unknown };
  const text = typeof v.text === "string" ? v.text.trim() : "";
  if (text.length > SUBTITLE_MAX) return { status: "INVALID", message: `자막은 ${SUBTITLE_MAX}자 이내로 입력해 주세요.` };
  if (bad(text)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (v.size !== "S" && v.size !== "M" && v.size !== "L") return { status: "INVALID", message: "크기를 확인해 주세요." };
  tools.subtitle = { text, size: v.size };
  return { status: "SAVED" };
}

export async function saveMarquee(input: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { lines?: unknown; speed?: unknown };
  const lines = Array.isArray(v.lines) ? v.lines.map((l) => (typeof l === "string" ? l.trim() : "")).filter(Boolean) : null;
  if (!lines || lines.length > MARQUEE_LINES_MAX || lines.some((l) => l.length > MARQUEE_LINE_MAX)) {
    return { status: "INVALID", message: `문구는 ${MARQUEE_LINES_MAX}줄, 줄마다 ${MARQUEE_LINE_MAX}자까지 입력할 수 있어요.` };
  }
  if (lines.some(bad)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (v.speed !== "SLOW" && v.speed !== "NORMAL" && v.speed !== "FAST") return { status: "INVALID", message: "속도를 확인해 주세요." };
  await mockDelay(150);
  tools.marquee = { lines, speed: v.speed };
  return { status: "SAVED" };
}

export async function configureTimer(input: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { mode?: unknown; durationSec?: unknown };
  if (v.mode !== "COUNTDOWN" && v.mode !== "STOPWATCH") return { status: "INVALID", message: "모드를 확인해 주세요." };
  const d = v.durationSec;
  if (typeof d !== "number" || !Number.isInteger(d) || d < 1 || d > TIMER_MAX_SEC) return { status: "INVALID", message: "시간은 1초 ~ 24시간으로 설정해 주세요." };
  tools.timer = { mode: v.mode, durationSec: d, startedAt: null, elapsedBeforeSec: 0, donationSec: tools.timer.donationSec };
  return { status: "SAVED" };
}

/** START resumes from the paused point; PAUSE freezes elapsed time; RESET clears it. Idempotent. */
export async function controlTimer(action: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const t = tools.timer;
  const now = Date.now();
  switch (action as TimerAction) {
    case "START":
      if (!t.startedAt) t.startedAt = new Date(now).toISOString();
      break;
    case "PAUSE":
      if (t.startedAt) {
        t.elapsedBeforeSec += Math.floor((now - new Date(t.startedAt).getTime()) / 1000);
        t.startedAt = null;
      }
      break;
    case "RESET":
      t.startedAt = null;
      t.elapsedBeforeSec = 0;
      break;
    default:
      return { status: "INVALID", message: "알 수 없는 동작이에요." };
  }
  return { status: "SAVED" };
}

/**
 * 퀵 조정: moves the shown time by `deltaSec` (countdown: more time left; stopwatch: more elapsed),
 * clamped to 0 … TIMER_MAX_SEC. Works while running or paused.
 */
export async function adjustTimer(deltaSec: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!TIMER_ADJUST_STEPS.includes(deltaSec as (typeof TIMER_ADJUST_STEPS)[number])) return { status: "INVALID", message: "조정 값을 확인해 주세요." };
  // Countdown shows 0 once it ran out, so +30 after the end gives 30 seconds.
  shiftTimer(tools.timer, deltaSec as number);
  return { status: "SAVED" };
}

/** 타이머 후원 연동 (2026-10-23): seconds added per 1,000 FN of each completed 썸네이션 후원 (0 = off). Keeps the timer running. */
export async function setTimerDonationLink(seconds: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 0 || seconds > TIMER_DONATION_SEC_MAX) {
    return { status: "INVALID", message: `1,000 FN마다 더할 시간은 0~${TIMER_DONATION_SEC_MAX}초예요.` };
  }
  tools.timer.donationSec = seconds;
  return { status: "SAVED" };
}

/**
 * 텍스트 슬롯 저장 (2026-10-23): one slot's name (studio only), text (on stream, 금지어 checked) and look. Saving an empty text
 * takes it off the stream.
 */
export async function saveTextSlot(input: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const slot = v.slot;
  if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 1 || slot > TEXT_SLOTS) return { status: "INVALID", message: "슬롯을 골라 주세요." };
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (name.length > TEXT_SLOT_NAME_MAX) return { status: "INVALID", message: `슬롯 이름은 ${TEXT_SLOT_NAME_MAX}자 이내로 입력해 주세요.` };
  // Lines keep their own spaces; only the ends of the whole text are trimmed.
  const text = typeof v.text === "string" ? v.text.replace(/\r\n?/g, "\n").trim() : "";
  if (text.length > TEXT_SLOT_TEXT_MAX) return { status: "INVALID", message: `문구는 ${TEXT_SLOT_TEXT_MAX}자 이내로 입력해 주세요.` };
  if (bad(text)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (!TEXT_SIZES.includes(v.size as (typeof TEXT_SIZES)[number])) return { status: "INVALID", message: "글자 크기를 골라 주세요." };
  if (typeof v.color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(v.color)) return { status: "INVALID", message: "글자색을 확인해 주세요." };
  if (![v.bold, v.outline, v.scroll].every((x) => typeof x === "boolean")) return { status: "INVALID", message: "설정을 확인해 주세요." };
  if (v.background !== "NONE" && v.background !== "CARD") return { status: "INVALID", message: "배경을 골라 주세요." };
  const align = TEXT_ALIGNS.find((x) => x.key === v.align)?.key;
  if (!align) return { status: "INVALID", message: "정렬을 골라 주세요." };
  const sec = v.scrollSec;
  if (typeof sec !== "number" || !Number.isInteger(sec) || sec < TEXT_SCROLL_SEC.min || sec > TEXT_SCROLL_SEC.max) {
    return { status: "INVALID", message: `스크롤 시간은 ${TEXT_SCROLL_SEC.min}~${TEXT_SCROLL_SEC.max}초예요.` };
  }
  tools.text.slots[slot - 1] = {
    name,
    text,
    size: v.size as number,
    color: v.color.toUpperCase(),
    bold: v.bold as boolean,
    outline: v.outline as boolean,
    background: v.background,
    align,
    scroll: v.scroll as boolean,
    scrollSec: sec
  };
  return { status: "SAVED" };
}

/** 엔딩 크레딧 시작 / 중지. START while rolling restarts from the top. */
export async function controlCredits(action: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (action !== "START" && action !== "STOP") return { status: "INVALID", message: "알 수 없는 동작이에요." };
  tools.credits.rollingSince = action === "START" ? new Date().toISOString() : null;
  return { status: "SAVED" };
}

/**
 * 엔딩 크레딧 저장: 제목 · 감사 문구, 연출 방식 · 스크롤 시간 · 집계 기간 and each section's on/off · title (blank = the
 * default) · rows. A roll in progress keeps going with the new settings.
 */
export async function saveCredits(input: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const title = typeof v.title === "string" ? v.title.trim() : "";
  const thanks = Array.isArray(v.thanks) ? v.thanks.map((l) => (typeof l === "string" ? l.trim() : "")).filter(Boolean) : null;
  if (!title || title.length > CREDITS_LINE_MAX) return { status: "INVALID", message: `제목을 1~${CREDITS_LINE_MAX}자로 입력해 주세요.` };
  if (!thanks || thanks.length > CREDITS_LINES_MAX || thanks.some((l) => l.length > CREDITS_LINE_MAX)) {
    return { status: "INVALID", message: `감사 문구는 ${CREDITS_LINES_MAX}줄, 줄마다 ${CREDITS_LINE_MAX}자까지예요.` };
  }
  const style = CREDITS_STYLES.find((x) => x.key === v.style)?.key;
  if (!style) return { status: "INVALID", message: "연출 방식을 골라 주세요." };
  const d = v.durationSec;
  if (typeof d !== "number" || !Number.isInteger(d) || d < CREDITS_DURATION_MIN || d > CREDITS_DURATION_MAX) {
    return { status: "INVALID", message: `스크롤 시간은 ${CREDITS_DURATION_MIN}~${CREDITS_DURATION_MAX}초예요.` };
  }
  const period = CREDITS_PERIODS.find((x) => x.key === v.period)?.key;
  if (!period) return { status: "INVALID", message: "집계 기간을 골라 주세요." };
  const raw = (typeof v.sections === "object" && v.sections !== null ? v.sections : {}) as Record<string, unknown>;
  const sections = {} as CreditsState["sections"];
  for (const meta of CREDITS_SECTIONS) {
    const x = (typeof raw[meta.key] === "object" && raw[meta.key] !== null ? raw[meta.key] : {}) as Record<string, unknown>;
    const name = typeof x.title === "string" ? x.title.trim() : "";
    if (typeof x.on !== "boolean") return { status: "INVALID", message: "섹션 설정을 확인해 주세요." };
    if (name.length > CREDITS_SECTION_TITLE_MAX) return { status: "INVALID", message: `섹션 제목은 ${CREDITS_SECTION_TITLE_MAX}자 이내로 입력해 주세요.` };
    const max = meta.list ? x.max : DEFAULT_CREDITS.sections[meta.key].max;
    if (typeof max !== "number" || !Number.isInteger(max) || max < 1 || max > CREDITS_LIST_MAX) return { status: "INVALID", message: `표시 인원은 1~${CREDITS_LIST_MAX}명이에요.` };
    sections[meta.key] = { on: x.on, title: name, max };
  }
  const shown = [title, ...thanks, ...Object.values(sections).map((x) => x.title)];
  if (shown.some(bad)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  await mockDelay(150);
  tools.credits = { title, thanks, style, durationSec: d, period, sections, rollingSince: tools.credits.rollingSince };
  return { status: "SAVED" };
}

/**
 * 빙고판 저장: title, size, cells (size², each up to BINGO_CELL_MAX; empty allowed while drafting) and goal
 * (1 … rows + columns + 2 diagonals). A mark belongs to its mission: after 칸 섞기, a new size or edited text, a cell
 * stays marked only if a marked cell had the same text (an edited or emptied cell starts unmarked).
 */
export async function saveBingo(input: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { title?: unknown; size?: unknown; cells?: unknown; goal?: unknown };
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (title.length > BINGO_TITLE_MAX) return { status: "INVALID", message: `제목은 ${BINGO_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (!BINGO_SIZES.includes(v.size as BingoSize)) return { status: "INVALID", message: "판 크기를 확인해 주세요." };
  const size = v.size as BingoSize;
  const cells = Array.isArray(v.cells) && v.cells.length === size * size && v.cells.every((c) => typeof c === "string") ? (v.cells as string[]).map((c) => c.trim()) : null;
  if (!cells || cells.some((c) => c.length > BINGO_CELL_MAX)) return { status: "INVALID", message: `칸 ${size * size}개를 칸마다 ${BINGO_CELL_MAX}자 이내로 입력해 주세요.` };
  if (cells.every((c) => !c)) return { status: "INVALID", message: "칸을 하나 이상 채워 주세요." };
  if (bad(title) || cells.some(bad)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const goal = v.goal;
  if (typeof goal !== "number" || !Number.isInteger(goal) || goal < 1 || goal > bingoLinesMax(size)) return { status: "INVALID", message: `목표 줄 수는 1 ~ ${bingoLinesMax(size)}줄이에요.` };
  await mockDelay(150);
  const prev = tools.bingo;
  // Marked missions by text, counted so two cells with the same text keep only as many marks as before.
  const done = new Map<string, number>();
  prev.cells.forEach((c, i) => prev.marked[i] && c && done.set(c, (done.get(c) ?? 0) + 1));
  const marked = cells.map((c) => {
    const left = c ? (done.get(c) ?? 0) : 0;
    if (left > 0) done.set(c, left - 1);
    return left > 0;
  });
  tools.bingo = { title, size, cells, marked, goal, shown: prev.shown };
  return { status: "SAVED" };
}

/**
 * Marks or unmarks one filled cell (an explicit value, so a retried click changes nothing). `size` and `cell` are the
 * board the screen showed: a click from an outdated screen (the board was edited elsewhere) is refused, not applied
 * to whatever mission sits at that index now.
 */
export async function markBingo(input: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { index?: unknown; marked?: unknown; size?: unknown; cell?: unknown };
  const b = tools.bingo;
  const i = v.index;
  if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || typeof v.marked !== "boolean") return { status: "INVALID", message: "칸을 확인해 주세요." };
  if (v.size !== b.size || i >= b.cells.length || v.cell !== b.cells[i]) return { status: "INVALID", message: "빙고판이 바뀌었어요. 화면을 새로고침한 뒤 다시 눌러 주세요." };
  if (!b.cells[i]) return { status: "INVALID", message: "빈 칸은 표시할 수 없어요." };
  b.marked[i] = v.marked;
  return { status: "SAVED" };
}

/** 빙고 표시 초기화 (RESET) and 화면에 보이기 / 숨기기 (SHOW · HIDE). */
export async function controlBingo(action: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const b = tools.bingo;
  if (action === "RESET") b.marked = b.cells.map(() => false);
  else if (action === "SHOW" || action === "HIDE") b.shown = action === "SHOW";
  else return { status: "INVALID", message: "알 수 없는 동작이에요." };
  return { status: "SAVED" };
}

/**
 * OBS overlay read — no login (OBS cannot sign in); the integration key is the secret. `slot`: the 텍스트 슬롯 address's
 * `?slot=` (1 when missing; an unknown slot looks like a missing page).
 */
export async function getOverlayTool(tool: unknown, key: unknown, slot?: unknown): Promise<OverlayTool | "FORBIDDEN"> {
  assertMock();
  if (!overlayKeyOpen(key) || !isToolKey(tool)) return "FORBIDDEN";
  // 리모컨 signals: 오버레이 새로고침 (reloadSeq) and 기능 제어 ON/OFF (on); the look is the 방송 도구 테마. 텍스트 슬롯 share
  // the 자막 switch (both put the creator's text on stream).
  const signal = { ...overlaySignal(tool === "text" ? "subtitle" : tool), theme: overlayTheme(toolLook().theme) };
  switch (tool) {
    case "subtitle":
      return { tool, state: { ...tools.subtitle }, ...signal };
    case "marquee":
      return { tool, state: { ...tools.marquee, lines: [...tools.marquee.lines] }, ...signal };
    case "timer":
      return { tool, state: { ...tools.timer }, serverNow: new Date().toISOString(), ...signal };
    case "credits":
      return { tool, state: structuredClone(tools.credits), data: creditsData(tools.credits), ...signal };
    case "bingo":
      return { tool, state: structuredClone(tools.bingo), ...signal };
    case "text": {
      const n = slot === undefined || slot === "" ? 1 : Number(slot);
      if (!Number.isInteger(n) || n < 1 || n > TEXT_SLOTS) return "FORBIDDEN";
      return { tool, slot: n, state: { ...tools.text.slots[n - 1] }, ...signal };
    }
  }
}
