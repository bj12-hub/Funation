"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { battleRulesOf, liveBroadcastOf, parseBattleRules } from "./crewCore";
import {
  BATTLES_MAX,
  BATTLE_DISPLAYS,
  BATTLE_MAX_SEC,
  BATTLE_MIN_SEC,
  BATTLE_PAIRS_MAX,
  BATTLE_TEAM_NAME_MAX,
  BATTLE_TITLE_MAX,
  MULTI_TEAMS_MAX,
  MULTI_TEAMS_MIN,
  MULTI_TEAM_KEYS,
  type BattleDisplay,
  type BroadcastResult
} from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * 실시간 배틀 Server Actions — code-first (no Figma frame), part of `/creator/crew/broadcast`.
 * Two BJs of the crew (or A팀 vs B팀 in team mode, 2 ~ 8 teams made for the battle, or up to 12 BJ 1:1 pairs at once —
 * 2026-10-23) battle for a set time; a side's score is the
 * points its members receive while the battle runs. One battle runs at a time. Start and time
 * changes carry a request id so a retried click never starts twice or adds time twice.
 * OBS: the crew scoreboard URL + `?battle`. 배수 · 벌칙 (2026-10-05 결정): platform defaults 1배 · 벌칙 없음, the creator
 * changes them per battle and can keep their own defaults. TBD: prize mapping.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew battle API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);
const activeMember = (id: unknown) => (mockCrew.crews[STUDIO_CHANNEL] ?? []).some((m) => m.id === id && m.active);
const isRunning = (x: { endsAt: string; stoppedAt: string | null }, now = Date.now()) => !x.stoppedAt && new Date(x.endsAt).getTime() > now;

/** 다수 팀: 2 ~ 8 teams, each with a unique name (blank = "A팀", "B팀" …) and at least one active member; a member in one team only. */
function parseTeams(input: unknown): { name: string; memberIds: string[] }[] | { message: string } {
  if (!Array.isArray(input) || input.length < MULTI_TEAMS_MIN || input.length > MULTI_TEAMS_MAX) return { message: `팀은 ${MULTI_TEAMS_MIN}~${MULTI_TEAMS_MAX}개로 만들어 주세요.` };
  const teams: { name: string; memberIds: string[] }[] = [];
  const taken = new Set<string>();
  for (const [i, raw] of input.entries()) {
    const t = rec(raw);
    const name = (typeof t.name === "string" ? t.name.trim() : "") || `${MULTI_TEAM_KEYS[i]}팀`;
    if (name.length > BATTLE_TEAM_NAME_MAX) return { message: `팀 이름은 ${BATTLE_TEAM_NAME_MAX}자 이내로 입력해 주세요.` };
    if (MOCK_FORBIDDEN_WORDS.some((w) => name.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    if (teams.some((x) => x.name === name)) return { message: "같은 이름의 팀이 있어요." };
    if (!Array.isArray(t.memberIds) || !t.memberIds.length) return { message: `${name}에 멤버를 한 명 이상 배정해 주세요.` };
    for (const id of t.memberIds) {
      if (!activeMember(id)) return { message: "팀 배정을 확인해 주세요." };
      if (taken.has(id)) return { message: "한 멤버는 한 팀에만 들어갈 수 있어요." };
      taken.add(id);
    }
    teams.push({ name, memberIds: [...(t.memberIds as string[])] });
  }
  return teams;
}

/** 1:1 여러 쌍: 1 ~ 12 pairs of two different active members; a member in one pair only. */
function parsePairs(input: unknown): [string, string][] | { message: string } {
  if (!Array.isArray(input) || !input.length || input.length > BATTLE_PAIRS_MAX) return { message: `1:1 대결은 1~${BATTLE_PAIRS_MAX}쌍으로 만들어 주세요.` };
  const pairs: [string, string][] = [];
  const taken = new Set<string>();
  for (const raw of input) {
    if (!Array.isArray(raw) || raw.length !== 2 || !activeMember(raw[0]) || !activeMember(raw[1])) return { message: "쌍마다 BJ 두 명을 골라 주세요." };
    const [p, q] = raw as [string, string];
    if (p === q) return { message: "한 쌍에는 서로 다른 BJ를 골라 주세요." };
    if (taken.has(p) || taken.has(q)) return { message: "한 BJ는 한 쌍에만 들어갈 수 있어요." };
    taken.add(p).add(q);
    pairs.push([p, q]);
  }
  return pairs;
}

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
  // 배수 · 벌칙: what the form sent, or the channel's defaults when left out.
  const defaults = battleRulesOf(STUDIO_CHANNEL);
  const rules = parseBattleRules({ multiplier: v.multiplier ?? defaults.multiplier, penalty: v.penalty ?? defaults.penalty }, MOCK_FORBIDDEN_WORDS);
  if ("message" in rules) return { status: "INVALID", message: rules.message };

  let a: string[] = [];
  let b: string[] = [];
  let teams: { name: string; memberIds: string[] }[] | undefined;
  let pairs: [string, string][] | undefined;
  let display: BattleDisplay | undefined;
  if (v.mode === "MEMBERS") {
    if (!activeMember(v.memberA) || !activeMember(v.memberB)) return { status: "INVALID", message: "배틀할 BJ 두 명을 골라 주세요." };
    if (v.memberA === v.memberB) return { status: "INVALID", message: "서로 다른 BJ를 골라 주세요." };
    [a, b] = [[v.memberA as string], [v.memberB as string]];
  } else if (v.mode === "TEAMS") {
    if (!live.teamMode) return { status: "INVALID", message: "팀 배틀로 시작한 방송에서만 팀 대결을 할 수 있어요." };
    a = Object.entries(live.teams).filter(([id, t]) => t === "A" && activeMember(id)).map(([id]) => id);
    b = Object.entries(live.teams).filter(([id, t]) => t === "B" && activeMember(id)).map(([id]) => id);
    if (!a.length || !b.length) return { status: "INVALID", message: "두 팀에 활동 중인 멤버가 있어야 해요." };
  } else if (v.mode === "MULTI_TEAMS") {
    const parsed = parseTeams(v.teams);
    if ("message" in parsed) return { status: "INVALID", message: parsed.message };
    teams = parsed;
    // 표시 방식 (2026-10-28): a screen from before sends none — 가로 막대.
    display = v.display === undefined ? "BARS" : BATTLE_DISPLAYS.find((d) => d.key === v.display)?.key;
    if (!display) return { status: "INVALID", message: "표시 방식을 골라 주세요." };
  } else if (v.mode === "PAIRS") {
    const parsed = parsePairs(v.pairs);
    if ("message" in parsed) return { status: "INVALID", message: parsed.message };
    pairs = parsed;
  } else return { status: "INVALID", message: "배틀 방식을 골라 주세요." };

  const now = Date.now();
  battles.push({
    no: battles.length + 1,
    title,
    mode: v.mode,
    a,
    b,
    ...(teams && { teams }),
    ...(pairs && { pairs }),
    ...(display && { display }),
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + sec * 1000).toISOString(),
    stoppedAt: null,
    requests: [v.requestId],
    multiplier: rules.multiplier,
    penalty: rules.penalty
  });
  return { status: "SAVED" };
}

/** The channel's 배수 · 벌칙 for new battles (kept across broadcasts). `reset` goes back to the platform defaults. */
export async function setBattleRules(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (v.reset === true) {
    if (mockCrew.battleRules) delete mockCrew.battleRules[STUDIO_CHANNEL];
    return { status: "SAVED" };
  }
  const rules = parseBattleRules(v, MOCK_FORBIDDEN_WORDS);
  if ("message" in rules) return { status: "INVALID", message: rules.message };
  (mockCrew.battleRules ??= {})[STUDIO_CHANNEL] = rules;
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

/**
 * 다수 팀 표시 방식 (2026-10-28): 가로 막대 / 누적 바 on OBS, while it runs or after. Only a 다수 팀 배틀 has one; the same
 * value again is a no-op.
 */
export async function setBattleDisplay(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const battle = (live.battles ?? []).find((x) => x.no === v.no);
  if (!battle) return { status: "INVALID", message: "배틀을 찾을 수 없어요." };
  if (battle.mode !== "MULTI_TEAMS") return { status: "INVALID", message: "다수 팀 배틀만 표시 방식을 고를 수 있어요." };
  const display = BATTLE_DISPLAYS.find((d) => d.key === v.display)?.key;
  if (!display) return { status: "INVALID", message: "표시 방식을 골라 주세요." };
  battle.display = display;
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
