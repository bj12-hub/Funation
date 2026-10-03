"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { memberRanking } from "@/services/crew/crewCore";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import {
  CREDITS_LINES_MAX,
  CREDITS_LINE_MAX,
  MARQUEE_LINES_MAX,
  MARQUEE_LINE_MAX,
  SUBTITLE_MAX,
  TIMER_ADJUST_STEPS,
  TIMER_MAX_SEC,
  isToolKey,
  type OverlayTool,
  type TimerAction,
  type ToolResult,
  type ToolStates,
  type ToolsView
} from "./broadcastToolTypes";
import { overlaySignal } from "./alertCore";
import { mockCreator } from "./mockCreatorStore";

/**
 * 방송 도구 Server Actions — code-first (no Figma frame). Studio route `/creator/widgets/tools`,
 * overlays `/overlay/tool/[tool]/[key]` (integration key = secret, like the crew scoreboard).
 * TBD: overlay tokens separate from the integration key, style presets, audit of changes.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Broadcast tools API is not connected yet.");
};

// V2: credits gained rollingSince.
const g = globalThis as typeof globalThis & { __funationMockToolsV2?: ToolStates };
const tools = (g.__funationMockToolsV2 ??= {
  subtitle: { text: "", size: "M" },
  marquee: { lines: ["오늘도 방송에 와 주셔서 감사합니다!"], speed: "NORMAL" },
  timer: { mode: "COUNTDOWN", durationSec: 600, startedAt: null, elapsedBeforeSec: 0 },
  credits: { title: "오늘의 방송을 함께해 주신 분들", thanks: ["시청해 주신 모든 분들 감사합니다"], includeCrew: true, rollingSince: null }
});

const bad = (s: string) => MOCK_FORBIDDEN_WORDS.some((w) => s.toLowerCase().includes(w));
const crewTop = () => memberRanking(STUDIO_CHANNEL).map((r) => ({ name: r.name, score: r.totalFn }));

export async function getToolsView(): Promise<ToolsView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(150);
  return { states: structuredClone(tools), overlayBase: `/overlay/tool`, crew: crewTop() };
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
  tools.timer = { mode: v.mode, durationSec: d, startedAt: null, elapsedBeforeSec: 0 };
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
  const t = tools.timer;
  const delta = deltaSec as number;
  const running = t.startedAt ? Math.floor((Date.now() - new Date(t.startedAt).getTime()) / 1000) : 0;
  const elapsed = t.elapsedBeforeSec + running;
  // Shown time: countdown = duration - elapsed, stopwatch = elapsed.
  const shown = t.mode === "COUNTDOWN" ? t.durationSec - elapsed : elapsed;
  const target = Math.min(TIMER_MAX_SEC, Math.max(0, shown + delta));
  const targetElapsed = t.mode === "COUNTDOWN" ? t.durationSec - target : target;
  t.elapsedBeforeSec = targetElapsed - running;
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

export async function saveCredits(input: unknown): Promise<ToolResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { title?: unknown; thanks?: unknown; includeCrew?: unknown };
  const title = typeof v.title === "string" ? v.title.trim() : "";
  const thanks = Array.isArray(v.thanks) ? v.thanks.map((l) => (typeof l === "string" ? l.trim() : "")).filter(Boolean) : null;
  if (!title || title.length > CREDITS_LINE_MAX) return { status: "INVALID", message: `제목을 1~${CREDITS_LINE_MAX}자로 입력해 주세요.` };
  if (!thanks || thanks.length > CREDITS_LINES_MAX || thanks.some((l) => l.length > CREDITS_LINE_MAX)) {
    return { status: "INVALID", message: `감사 문구는 ${CREDITS_LINES_MAX}줄, 줄마다 ${CREDITS_LINE_MAX}자까지예요.` };
  }
  if (bad(title) || thanks.some(bad)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (typeof v.includeCrew !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
  await mockDelay(150);
  tools.credits = { title, thanks, includeCrew: v.includeCrew, rollingSince: tools.credits.rollingSince };
  return { status: "SAVED" };
}

/** OBS overlay read — no login (OBS cannot sign in); the integration key is the secret. */
export async function getOverlayTool(tool: unknown, key: unknown): Promise<OverlayTool | "FORBIDDEN"> {
  assertMock();
  if (typeof key !== "string" || key !== mockCreator.integrationKey || !isToolKey(tool)) return "FORBIDDEN";
  // 리모컨 signals: 오버레이 새로고침 (reloadSeq) and 기능 제어 ON/OFF (on).
  const signal = overlaySignal(tool);
  switch (tool) {
    case "subtitle":
      return { tool, state: { ...tools.subtitle }, ...signal };
    case "marquee":
      return { tool, state: { ...tools.marquee, lines: [...tools.marquee.lines] }, ...signal };
    case "timer":
      return { tool, state: { ...tools.timer }, serverNow: new Date().toISOString(), ...signal };
    case "credits":
      return { tool, state: { ...tools.credits, thanks: [...tools.credits.thanks] }, crew: tools.credits.includeCrew ? crewTop() : [], ...signal };
  }
}
