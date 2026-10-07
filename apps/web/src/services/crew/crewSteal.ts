"use server";

import { randomInt, randomUUID } from "node:crypto";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { battleBonus, divideByMultiplier, gradeBonus, liveBroadcastOf, stealRecordView, stealRulesOf, windowScores } from "./crewCore";
import {
  STEAL_BASES,
  STEAL_COOLDOWN_MAX,
  STEAL_LABEL_MAX,
  STEAL_POINTS_MAX,
  STEAL_SLOTS_MAX,
  STEAL_WEIGHT_MAX,
  type BroadcastResult,
  type StealSlot,
  type StealSpinResult
} from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 기여도 강탈 룰렛 Server Actions — code-first (no Figma frame), part of `/creator/crew/broadcast`.
 * The creator sets the slots (빼앗는 비율 · 고정 점수 · 꽝) and their odds. 강탈 기준 · 쿨다운 (2026-10-05 결정): platform
 * defaults 방송 전체 점수 · 쿨다운 없음, changeable by the creator. A spin is drawn on the server: the thief takes the slot's points from the target's
 * current score (never more than the target has). Points are display scores only. The request id is
 * the record id, so a retried spin returns the same result instead of spinning again.
 * TBD: 후원 연동 (특정 금액 후원 시 자동 룰렛).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew steal API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;
const validId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);
const activeMember = (id: unknown) => (mockCrew.crews[STUDIO_CHANNEL] ?? []).some((m) => m.id === id && m.active);
const slotsOf = () => mockCrew.stealSlots?.[STUDIO_CHANNEL] ?? [];
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Replaces the roulette slots (sent on every edit; no separate save step). */
export async function setStealSlots(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const raw = rec(input).slots;
  if (!Array.isArray(raw) || raw.length > STEAL_SLOTS_MAX) return { status: "INVALID", message: `룰렛 칸은 ${STEAL_SLOTS_MAX}개까지예요.` };
  const slots: StealSlot[] = [];
  for (const r of raw) {
    const v = rec(r);
    const label = typeof v.label === "string" ? v.label.trim() : "";
    if (!label || label.length > STEAL_LABEL_MAX) return { status: "INVALID", message: `칸 이름을 1~${STEAL_LABEL_MAX}자로 입력해 주세요.` };
    if (MOCK_FORBIDDEN_WORDS.some((w) => label.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
    if (!isInt(v.weight, 1, STEAL_WEIGHT_MAX)) return { status: "INVALID", message: `확률 가중치는 1~${STEAL_WEIGHT_MAX} 사이 정수예요.` };
    let value = 0;
    if (v.kind === "PERCENT") {
      if (!isInt(v.value, 1, 100)) return { status: "INVALID", message: "빼앗는 비율은 1~100%예요." };
      value = v.value;
    } else if (v.kind === "POINTS") {
      if (!isInt(v.value, 1, STEAL_POINTS_MAX)) return { status: "INVALID", message: "빼앗는 점수를 확인해 주세요." };
      value = v.value;
    } else if (v.kind !== "MISS") return { status: "INVALID", message: "칸 종류를 골라 주세요." };
    const id = typeof v.id === "string" && /^st-[a-z0-9-]{4,40}$/.test(v.id) && !slots.some((s) => s.id === v.id) ? v.id : `st-${randomUUID().slice(0, 8)}`;
    slots.push({ id, label, kind: v.kind, value, weight: v.weight });
  }
  (mockCrew.stealSlots ??= {})[STUDIO_CHANNEL] = slots;
  return { status: "SAVED" };
}

/** 강탈 기준 · 쿨다운 (kept across broadcasts). `reset` goes back to the platform defaults. */
export async function setStealRules(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (v.reset === true) {
    if (mockCrew.stealRules) delete mockCrew.stealRules[STUDIO_CHANNEL];
    return { status: "SAVED" };
  }
  if (!STEAL_BASES.some((b) => b.key === v.basis)) return { status: "INVALID", message: "강탈 기준을 골라 주세요." };
  if (!isInt(v.cooldownSec, 0, STEAL_COOLDOWN_MAX)) return { status: "INVALID", message: `쿨다운은 0 ~ ${STEAL_COOLDOWN_MAX / 60}분이에요.` };
  (mockCrew.stealRules ??= {})[STUDIO_CHANNEL] = { basis: v.basis as "BROADCAST" | "BATTLE", cooldownSec: v.cooldownSec };
  return { status: "SAVED" };
}

/** The target's current scoreboard score (donations · 후원 리스트 · 강탈 in this broadcast + 보정 + 배틀 배수 + 직급 배수). */
function currentScore(b: MockBroadcast, memberId: string) {
  const fromWindow = windowScores(b, b.startedAt, null).get(memberId) ?? 0;
  return fromWindow + b.adjustments.filter((a) => a.memberId === memberId).reduce((s, a) => s + a.points, 0) + (battleBonus(b).get(memberId) ?? 0) + (gradeBonus(b).get(memberId) ?? 0);
}

export async function spinSteal(input: unknown): Promise<StealSpinResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!validId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const slots = slotsOf();
  const steals = (live.steals ??= []);
  const previous = steals.find((x) => x.id === v.requestId);
  if (previous) return { status: "SPUN", record: stealRecordView(live.channelId, previous), slotIndex: slots.findIndex((s) => s.id === previous.slotId) };
  if (!slots.length) return { status: "INVALID", message: "먼저 룰렛 칸을 만들어 주세요." };
  if (!activeMember(v.thiefId) || !activeMember(v.targetId)) return { status: "INVALID", message: "가져올 BJ와 빼앗길 BJ를 골라 주세요." };
  if (v.thiefId === v.targetId) return { status: "INVALID", message: "서로 다른 BJ를 골라 주세요." };
  const rules = stealRulesOf(STUDIO_CHANNEL);
  const now = Date.now();
  const last = steals.at(-1);
  const wait = last ? Math.ceil((new Date(last.at).getTime() + rules.cooldownSec * 1000 - now) / 1000) : 0;
  if (rules.cooldownSec > 0 && wait > 0) return { status: "INVALID", message: `쿨다운 중이에요. ${wait}초 뒤에 다시 돌릴 수 있어요.` };
  // 강탈 기준: the whole broadcast, or only what the target received in the running battle.
  const battle = (live.battles ?? []).find((x) => !x.stoppedAt && new Date(x.endsAt).getTime() > now);
  if (rules.basis === "BATTLE" && !battle) return { status: "INVALID", message: "강탈 기준이 배틀 점수예요. 배틀을 시작한 뒤 돌려 주세요." };

  // Weighted draw on the server — the browser only animates to the slot it is told.
  let roll = randomInt(slots.reduce((s, x) => s + x.weight, 0));
  const slotIndex = slots.findIndex((x) => (roll -= x.weight) < 0);
  const slot = slots[slotIndex];
  const target = v.targetId as string;
  const board = Math.max(0, currentScore(live, target));
  const has = rules.basis === "BATTLE" && battle ? Math.max(0, windowScores(live, battle.startedAt, null).get(target) ?? 0) : board;
  let points = slot.kind === "PERCENT" ? Math.floor((has * slot.value) / 100) : slot.kind === "POINTS" ? Math.min(slot.value, has) : 0;
  // The record falls inside the running battle's window, so for a target in that battle the main scoreboard takes it
  // × the battle 배수 as well (battleBonus). Whether battle ×n should apply to 강탈 at all is an open product decision
  // (TBD); until it is made, a target in a ×n battle (n > 1) loses at most board / n points here, so their scoreboard
  // score never drops below 0 after every multiplier.
  const battleMult = battle && (battle.a.includes(target) || battle.b.includes(target)) ? (battle.multiplier ?? 1) : 1;
  if (battleMult > 1) points = Math.min(points, divideByMultiplier(board, battleMult));
  const record = { id: v.requestId, at: new Date(now).toISOString(), thief: v.thiefId as string, target, slotId: slot.id, slotLabel: slot.label, points };
  steals.push(record);
  await mockDelay(100);
  return { status: "SPUN", record: stealRecordView(live.channelId, record), slotIndex };
}
