import { randomInt, randomUUID } from "node:crypto";
import { chatStore } from "@/services/broadcast/chatCore";
import { addEntrantByName, parseKeyword, shuffled, syncChatEntries, type StoredEntrant } from "./playEntryCore";
import {
  DEFAULT_RUMBLE,
  RUMBLE_BATTLE_MAX_SEC,
  RUMBLE_BATTLE_MIN_SEC,
  RUMBLE_FILL_MAX,
  RUMBLE_HISTORY_MAX,
  RUMBLE_KEYWORD_MAX,
  RUMBLE_LEAD_SEC,
  RUMBLE_PLAYERS_MAX,
  RUMBLE_PLAYERS_MIN,
  RUMBLE_SHRINK_AT,
  RUMBLE_SUDDEN_AT,
  RUMBLE_TITLE_MAX,
  rumbleBots,
  rumbleStandings,
  type RumbleBattle,
  type RumbleFighter,
  type RumbleHistoryEntry,
  type RumbleKnockout,
  type RumbleRound,
  type RumbleSettings
} from "./rumbleTypes";

/**
 * 로얄 럼블 (server-only) — code-first, StreamDonate 로얄 럼블 참고. One round at a time per studio: 참가 모집 시작 opens it
 * with the settings of that moment; entrants come from chat (the keyword, once per platform user, read from the 통합 채팅
 * feed since the round opened) or the operator, up to the 최대 인원. 배틀 시작 adds the 봇 and decides the whole fight with
 * server randomness — the winner (a person), the knockout order, each knockout's time and cause — and keeps the 회차 결과.
 * No FN, no points.
 */

type StoredRound = {
  id: string;
  no: number;
  requestId: string;
  keyword: string;
  maxPlayers: number;
  fillTo: number;
  battleSec: number;
  ringShrink: boolean;
  suddenDeath: boolean;
  /** The chat feed's last message when the round opened (and the last one read since). */
  chatSeq: number;
  entrants: StoredEntrant[];
  battle: (RumbleBattle & { requestId: string }) | null;
};
type RumbleStore = { settings: RumbleSettings; round: StoredRound | null; history: RumbleHistoryEntry[]; seq: number };

const g = globalThis as typeof globalThis & { __ssumnationMockRumbleV1?: RumbleStore };
export const rumbleStore = (): RumbleStore => (g.__ssumnationMockRumbleV1 ??= { settings: DEFAULT_RUMBLE, round: null, history: [], seq: 0 });

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const iso = (ms: number) => new Date(ms).toISOString();

export function parseRumbleSettings(input: unknown, forbidden: string[]): RumbleSettings | { message: string } {
  const v = rec(input);
  const banned = (text: string) => forbidden.some((w) => text.toLowerCase().includes(w));
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (title.length > RUMBLE_TITLE_MAX) return { message: `제목은 ${RUMBLE_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (typeof v.ringShrink !== "boolean" || typeof v.suddenDeath !== "boolean") return { message: "설정을 확인해 주세요." };
  const keyword = parseKeyword(v.keyword, RUMBLE_KEYWORD_MAX);
  if (!keyword) return { message: `참가 명령어는 띄어쓰기 없이 1~${RUMBLE_KEYWORD_MAX}자로 입력해 주세요.` };
  if (banned(title) || banned(keyword)) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (!isInt(v.maxPlayers, RUMBLE_PLAYERS_MIN, RUMBLE_PLAYERS_MAX)) return { message: `최대 인원은 ${RUMBLE_PLAYERS_MIN} ~ ${RUMBLE_PLAYERS_MAX}명이에요.` };
  if (!isInt(v.fillTo, 0, RUMBLE_FILL_MAX)) return { message: `봇 채우기는 0 ~ ${RUMBLE_FILL_MAX}명이에요.` };
  if (!isInt(v.battleSec, RUMBLE_BATTLE_MIN_SEC, RUMBLE_BATTLE_MAX_SEC)) return { message: `배틀 시간은 ${RUMBLE_BATTLE_MIN_SEC} ~ ${RUMBLE_BATTLE_MAX_SEC}초예요.` };
  return { title, keyword, maxPlayers: v.maxPlayers, fillTo: v.fillTo, battleSec: v.battleSec, ringShrink: v.ringShrink, suddenDeath: v.suddenDeath };
}

/** The round's state by the clock: 모집 중 until started, then FIGHTING until the last knockout. */
export const roundStatus = (r: StoredRound, now: number): RumbleRound["status"] => (!r.battle ? "OPEN" : now < Date.parse(r.battle.endAt) ? "FIGHTING" : "DONE");

/**
 * 참가 모집 시작: a new round with the settings saved now (chat entries count from now on). `requestId` makes a retried
 * open a no-op. Returns an error message, or null.
 */
export function openRumbleRound(requestId: string, now = Date.now()): string | null {
  const s = rumbleStore();
  if (s.round?.requestId === requestId) return null;
  if (s.round && roundStatus(s.round, now) === "FIGHTING") return "배틀이 끝난 뒤에 새 판을 열어 주세요.";
  const set = s.settings;
  s.seq += 1;
  s.round = {
    id: `rr-${randomUUID().slice(0, 8)}`,
    no: s.seq,
    requestId,
    keyword: set.keyword,
    maxPlayers: set.maxPlayers,
    fillTo: set.fillTo,
    battleSec: set.battleSec,
    ringShrink: set.ringShrink,
    suddenDeath: set.suddenDeath,
    chatSeq: chatStore().seq,
    entrants: [],
    battle: null
  };
  return null;
}

/** Chat entries of the open round. */
export function syncRumbleChat() {
  const r = rumbleStore().round;
  if (r && !r.battle) syncChatEntries(r, "re");
}

const openRound = (roundId: unknown, now: number) => {
  const r = rumbleStore().round;
  return r && r.id === roundId && roundStatus(r, now) === "OPEN" ? r : null;
};

/** 수동 추가 while the round is open. Returns an error message, or null. */
export function addRumbleEntrant(input: { roundId: unknown; name: unknown }, forbidden: string[], now = Date.now()): string | null {
  const r = openRound(input.roundId, now);
  if (!r) return "참가 모집 중인 판이 아니에요.";
  return addEntrantByName(r, { name: input.name, source: "MANUAL", idPrefix: "re" }, forbidden, now);
}

/** 참가 취소 while the round is open (removing someone gone is a no-op). */
export function removeRumbleEntrant(input: { roundId: unknown; entrantId: unknown }, now = Date.now()): string | null {
  const r = openRound(input.roundId, now);
  if (!r) return "참가 모집 중인 판이 아니에요.";
  r.entrants = r.entrants.filter((e) => e.id !== input.entrantId);
  return null;
}

/**
 * When the `count` knockouts happen in a `sec`-second fight, in seconds (0.1s steps, rising): many early and fewer as it
 * goes on, a little uneven; with 서든데스 the last ~15% come one by one after it starts. The last one ends the fight.
 */
export function knockoutTimes(count: number, sec: number, suddenDeath: boolean) {
  const sudden = suddenDeath ? Math.min(count, Math.max(1, Math.round((count + 1) * 0.15))) : 0;
  const early = count - sudden;
  const from = sec * 0.06;
  const to = sudden ? sec * (RUMBLE_SUDDEN_AT - 0.02) : sec;
  const base = Array.from({ length: early }, (_, i) => from + (to - from) * ((i + 1) / early) ** 1.4);
  const times = base.map((t, i) => (i === early - 1 && !sudden ? t : Math.min(to, t + ((randomInt(61) - 30) / 100) * (t - (base[i - 1] ?? from)))));
  for (let j = 0; j < sudden; j++) times.push(sec * (RUMBLE_SUDDEN_AT + ((1 - RUMBLE_SUDDEN_AT) * (j + 1)) / sudden));
  const out: number[] = [];
  for (const t of times) out.push(Math.max(Math.round(t * 10) / 10, (out.at(-1) ?? 0) + 0.1));
  out[out.length - 1] = sec;
  return out;
}

/**
 * 배틀 시작: 봇 fill the ring, then the server decides the fight — the winner among the people, the knockout order of the
 * rest, when each happens, and who did it (someone still standing) or the ring (after a 링 축소 · in 서든데스). `requestId`
 * makes a retried start the same battle. Returns an error message, or null.
 */
export function startRumbleBattle(input: { roundId: unknown; requestId: string }, now = Date.now()): string | null {
  const s = rumbleStore();
  const r = s.round;
  if (!r || r.id !== input.roundId) return "참가 모집 중인 판이 아니에요.";
  if (r.battle) return r.battle.requestId === input.requestId ? null : "이미 배틀을 시작했어요.";
  if (r.entrants.length < RUMBLE_PLAYERS_MIN) return `참가자가 ${RUMBLE_PLAYERS_MIN}명 이상이어야 시작할 수 있어요.`;
  const fighters: RumbleFighter[] = [
    ...r.entrants.map((e) => ({ id: e.id, name: e.name, bot: false })),
    ...Array.from({ length: rumbleBots(r.entrants.length, r.fillTo) }, (_, i) => ({ id: `rb-${i + 1}`, name: `봇 ${i + 1}`, bot: true }))
  ];
  const winnerId = r.entrants[randomInt(r.entrants.length)].id;
  const order = shuffled(fighters.filter((f) => f.id !== winnerId).map((f) => f.id));
  const times = knockoutTimes(order.length, r.battleSec, r.suddenDeath);
  const standing = new Set(fighters.map((f) => f.id));
  const knockouts: RumbleKnockout[] = order.map((victimId, i) => {
    standing.delete(victimId);
    const p = times[i] / r.battleSec;
    const ringOdds = r.suddenDeath && p > RUMBLE_SUDDEN_AT ? 50 : r.ringShrink && p > RUMBLE_SHRINK_AT[0] ? 25 : 0;
    const left = [...standing];
    const killerId = ringOdds > 0 && randomInt(100) < ringOdds ? null : left[randomInt(left.length)];
    return { at: times[i], victimId, killerId };
  });
  const startAt = now + RUMBLE_LEAD_SEC * 1000;
  const endAt = startAt + r.battleSec * 1000;
  r.battle = { requestId: input.requestId, startAt: iso(startAt), endAt: iso(endAt), ringShrink: r.ringShrink, suddenDeath: r.suddenDeath, fighters, knockouts, winnerId };
  const table = rumbleStandings(r.battle);
  const top = [...table].sort((a, b) => b.kills - a.kills || a.rank - b.rank)[0];
  s.history.unshift({
    no: r.no,
    at: iso(endAt),
    players: r.entrants.length,
    bots: fighters.length - r.entrants.length,
    winner: table[0].name,
    kills: table[0].kills,
    topKiller: top.kills > 0 ? { name: top.name, kills: top.kills } : null
  });
  s.history.splice(RUMBLE_HISTORY_MAX);
  return null;
}

/** 판 닫기: the round goes away (not while fighting). */
export function closeRumbleRound(roundId: unknown, now = Date.now()): string | null {
  const s = rumbleStore();
  if (!s.round || s.round.id !== roundId) return null;
  if (roundStatus(s.round, now) === "FIGHTING") return "배틀이 끝난 뒤에 닫을 수 있어요.";
  s.round = null;
  return null;
}

/** The round as shown (no entry keys). */
export function rumbleRoundView(now = Date.now()): RumbleRound | null {
  const r = rumbleStore().round;
  if (!r) return null;
  const b = r.battle;
  return {
    id: r.id,
    no: r.no,
    status: roundStatus(r, now),
    keyword: r.keyword,
    maxPlayers: r.maxPlayers,
    fillTo: r.fillTo,
    entrants: r.entrants.map((e) => ({ id: e.id, name: e.name, source: e.source })),
    battle: b && {
      startAt: b.startAt,
      endAt: b.endAt,
      ringShrink: b.ringShrink,
      suddenDeath: b.suddenDeath,
      fighters: b.fighters.map((f) => ({ ...f })),
      knockouts: b.knockouts.map((k) => ({ ...k })),
      winnerId: b.winnerId
    }
  };
}

/** 회차별 결과 of battles that are over, newest first. */
export const rumbleHistory = (now = Date.now()) => rumbleStore().history.filter((h) => Date.parse(h.at) <= now);
