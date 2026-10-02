"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { liveBroadcastOf } from "./crewCore";
import { BATTLES_MAX, BATTLE_MAX_SEC, BATTLE_MIN_SEC, BATTLE_TITLE_MAX, type BroadcastResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * 실시간 배틀 Server Actions — code-first (no Figma frame), part of `/creator/crew/broadcast`.
 * Two BJs of the crew (or A팀 vs B팀 in team mode) battle for a set time; a side's score is the
 * points its members receive while the battle runs. One battle runs at a time. Start and time
 * changes carry a request id so a retried click never starts twice or adds time twice.
 * OBS: the crew scoreboard URL + `?battle`. TBD: 배틀 배수 · 벌칙 · prize mapping.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew battle API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);
const activeMember = (id: unknown) => (mockCrew.crews[STUDIO_CHANNEL] ?? []).some((m) => m.id === id && m.active);
const isRunning = (x: { endsAt: string; stoppedAt: string | null }, now = Date.now()) => !x.stoppedAt && new Date(x.endsAt).getTime() > now;

export async function startBattle(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const battles = (live.battles ??= []);
  if (battles.some((x) => x.requests.includes(v.requestId as string))) return { status: "SAVED" };
  if (battles.some((x) => isRunning(x))) return { status: "INVALID", message: "진행 중인 배틀이 있어요. 먼저 끝내 주세요." };
  if (battles.length >= BATTLES_MAX) return { status: "INVALID", message: `배틀은 방송당 ${BATTLES_MAX}번까지예요.` };
  const sec = v.durationSec;
  if (typeof sec !== "number" || !Number.isInteger(sec) || sec < BATTLE_MIN_SEC || sec > BATTLE_MAX_SEC) {
    return { status: "INVALID", message: `배틀 시간은 ${BATTLE_MIN_SEC}초 ~ ${BATTLE_MAX_SEC / 3600}시간이에요.` };
  }
  const title = (typeof v.title === "string" ? v.title.trim() : "") || `배틀 ${battles.length + 1}`;
  if (title.length > BATTLE_TITLE_MAX) return { status: "INVALID", message: `배틀 이름은 ${BATTLE_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => title.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };

  let a: string[];
  let b: string[];
  if (v.mode === "MEMBERS") {
    if (!activeMember(v.memberA) || !activeMember(v.memberB)) return { status: "INVALID", message: "배틀할 BJ 두 명을 골라 주세요." };
    if (v.memberA === v.memberB) return { status: "INVALID", message: "서로 다른 BJ를 골라 주세요." };
    [a, b] = [[v.memberA as string], [v.memberB as string]];
  } else if (v.mode === "TEAMS") {
    if (!live.teamMode) return { status: "INVALID", message: "팀 배틀로 시작한 방송에서만 팀 대결을 할 수 있어요." };
    a = Object.entries(live.teams).filter(([id, t]) => t === "A" && activeMember(id)).map(([id]) => id);
    b = Object.entries(live.teams).filter(([id, t]) => t === "B" && activeMember(id)).map(([id]) => id);
    if (!a.length || !b.length) return { status: "INVALID", message: "두 팀에 활동 중인 멤버가 있어야 해요." };
  } else return { status: "INVALID", message: "배틀 방식을 골라 주세요." };

  const now = Date.now();
  battles.push({ no: battles.length + 1, title, mode: v.mode, a, b, startedAt: new Date(now).toISOString(), endsAt: new Date(now + sec * 1000).toISOString(), stoppedAt: null, requests: [v.requestId] });
  return { status: "SAVED" };
}

/** 시간 추가 · 빼기 on the running battle. Taking away more than is left ends it now. */
export async function adjustBattleTime(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const battle = (live.battles ?? []).find((x) => x.no === v.no);
  if (!battle) return { status: "INVALID", message: "배틀을 찾을 수 없어요." };
  if (battle.requests.includes(v.requestId)) return { status: "SAVED" };
  if (!isRunning(battle)) return { status: "INVALID", message: "이미 끝난 배틀이에요." };
  const delta = v.deltaSec;
  if (typeof delta !== "number" || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > BATTLE_MAX_SEC) return { status: "INVALID", message: "시간을 확인해 주세요." };
  const now = Date.now();
  const end = new Date(battle.endsAt).getTime() + delta * 1000;
  if (end - new Date(battle.startedAt).getTime() > BATTLE_MAX_SEC * 1000) return { status: "INVALID", message: `배틀은 최대 ${BATTLE_MAX_SEC / 3600}시간이에요.` };
  battle.endsAt = new Date(Math.max(end, now)).toISOString();
  battle.requests.push(v.requestId);
  return { status: "SAVED" };
}

/** 지금 끝내기: freezes the result now. Stopping an ended battle is a no-op (double click safe). */
export async function stopBattle(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const battle = (live.battles ?? []).find((x) => x.no === v.no);
  if (!battle) return { status: "INVALID", message: "배틀을 찾을 수 없어요." };
  if (isRunning(battle)) battle.stoppedAt = new Date().toISOString();
  return { status: "SAVED" };
}
