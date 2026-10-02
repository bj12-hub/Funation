"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { liveBroadcastOf, openBoard } from "./crewCore";
import { SCENARIO_MEMO_MAX, SCENARIO_MINUTES_MAX, SCENARIO_PARTS_MAX, SCENARIO_TITLE_MAX, type BroadcastResult, type ScenarioPart } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * 콘텐츠 시나리오 도우미 Server Actions — code-first (no Figma frame), part of `/creator/crew/broadcast`.
 * The creator plans up to 5 parts (1부 ~ 5부: 이름 · 예정 시간 · 메모) before going live; during the
 * broadcast the operator moves part to part, and a part can open its own 서브 점수판 when it starts.
 * Moving to a part carries a request id so a double click never skips a part.
 * OBS: the crew scoreboard URL + `?scenario`. TBD: 부별 상금 · 미션, 시간 초과 알림 소리.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew scenario API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;
const bad = (s: string) => MOCK_FORBIDDEN_WORDS.some((w) => s.toLowerCase().includes(w));

/** Replaces the plan (sent on every edit; no separate save step). A running broadcast keeps its own copy. */
export async function setScenario(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const raw = rec(input).parts;
  if (!Array.isArray(raw) || raw.length > SCENARIO_PARTS_MAX) return { status: "INVALID", message: `시나리오는 ${SCENARIO_PARTS_MAX}부까지예요.` };
  const parts: ScenarioPart[] = [];
  for (const r of raw) {
    const v = rec(r);
    const title = typeof v.title === "string" ? v.title.trim() : "";
    const memo = typeof v.memo === "string" ? v.memo.trim() : "";
    if (title.length > SCENARIO_TITLE_MAX) return { status: "INVALID", message: `부 이름은 ${SCENARIO_TITLE_MAX}자 이내로 입력해 주세요.` };
    if (memo.length > SCENARIO_MEMO_MAX) return { status: "INVALID", message: `메모는 ${SCENARIO_MEMO_MAX}자까지예요.` };
    if (bad(title) || bad(memo)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
    const minutes = v.minutes ?? null;
    if (minutes !== null && (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1 || minutes > SCENARIO_MINUTES_MAX)) {
      return { status: "INVALID", message: `예정 시간은 1~${SCENARIO_MINUTES_MAX}분이에요.` };
    }
    if (typeof v.openBoard !== "boolean") return { status: "INVALID", message: "서브 점수판 설정을 확인해 주세요." };
    parts.push({ title, minutes, memo, openBoard: v.openBoard });
  }
  (mockCrew.scenario ??= {})[STUDIO_CHANNEL] = parts;
  return { status: "SAVED" };
}

/**
 * Starts part `index` (ending the running one). The first call takes a copy of the plan. Opening a
 * part's 서브 점수판 follows the plan; a board limit error is reported but the part still starts.
 */
export async function startScenarioPart(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  if (live.scenario?.requests.includes(v.requestId)) return { status: "SAVED" };
  const plan = live.scenario?.parts ?? mockCrew.scenario?.[STUDIO_CHANNEL] ?? [];
  if (!plan.length) return { status: "INVALID", message: "먼저 시나리오를 만들어 주세요." };
  const index = v.index;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= plan.length) return { status: "INVALID", message: "부를 찾을 수 없어요." };
  if (live.scenario?.current === index) return { status: "SAVED" };

  const s = (live.scenario ??= { parts: structuredClone(plan), current: null, history: [], requests: [] });
  const now = new Date().toISOString();
  for (const h of s.history) h.endedAt ??= now;
  s.history.push({ index, startedAt: now, endedAt: null });
  s.current = index;
  s.requests.push(v.requestId);
  const part = s.parts[index];
  if (part.openBoard) {
    const error = openBoard(live, `${index + 1}부${part.title ? ` · ${part.title}` : ""}`.slice(0, 20), v.requestId, now);
    if (error) return { status: "INVALID", message: `${index + 1}부를 시작했지만 ${error}` };
  }
  return { status: "SAVED" };
}

/** 시나리오 마치기: ends the running part. Idempotent. */
export async function finishScenario(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== rec(input).broadcastId) return notLive;
  if (live.scenario) {
    const now = new Date().toISOString();
    for (const h of live.scenario.history) h.endedAt ??= now;
    live.scenario.current = null;
  }
  return { status: "SAVED" };
}
