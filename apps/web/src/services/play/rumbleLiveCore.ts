import { randomBytes, randomUUID } from "node:crypto";
import { sameSecret } from "@/lib/secret";
import { LIVE_ATTACK_COOLDOWN_MS, LIVE_HP, LIVE_TICK_MS, createSim, joystick, ringAt, standings, step, type LiveSim } from "./rumbleLiveSim";
import {
  DEFAULT_LIVE,
  LIVE_BATTLE_MAX_SEC,
  LIVE_BATTLE_MIN_SEC,
  LIVE_HISTORY_MAX,
  LIVE_LEAD_SEC,
  LIVE_NAME_MAX,
  LIVE_PLAYERS_MAX,
  LIVE_PLAYERS_MIN,
  LIVE_TITLE_DEFAULT,
  LIVE_TITLE_MAX,
  type LiveHistoryEntry,
  type LiveInviteView,
  type LiveMe,
  type LivePhase,
  type LiveRoundView,
  type LiveSettings,
  type LiveStandingView,
  type LiveState
} from "./rumbleLiveTypes";

/**
 * 로얄 럼블 (조작형) (server-only) — code-first. One round at a time. The battle advances in fixed ticks up to "now" whenever
 * anyone reads it (OBS, a controller, the studio), using each player's latest stick and attack. A player is known by the
 * round link's token plus their own id and secret (handed out once when they join; a retried join gets the same ones).
 */

type StoredPlayer = { id: string; name: string; secret: string; color: number; lastInputAt: number };
type StoredRound = {
  id: string;
  no: number;
  requestId: string;
  token: string;
  maxPlayers: number;
  battleSec: number;
  ringShrink: boolean;
  players: StoredPlayer[];
  joins: Record<string, string>;
  startAt: number | null;
  startRequestId: string | null;
  sim: LiveSim | null;
  lastTick: number;
  saved: boolean;
};
type LiveStore = { settings: LiveSettings; round: StoredRound | null; history: LiveHistoryEntry[]; seq: number };

const g = globalThis as typeof globalThis & { __ssumnationMockRumbleLiveV1?: LiveStore };
export const liveStore = (): LiveStore => (g.__ssumnationMockRumbleLiveV1 ??= { settings: DEFAULT_LIVE, round: null, history: [], seq: 0 });

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const iso = (ms: number) => new Date(ms).toISOString();
/** Catching up after a long quiet spell stops here (the rest of the gap is skipped, not simulated). */
const CATCH_UP_TICKS = 200;
/** Inputs closer together than this from one player are ignored. */
const INPUT_GAP_MS = 25;

export function parseLiveSettings(input: unknown, forbidden: string[]): LiveSettings | { message: string } {
  const v = rec(input);
  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (title.length > LIVE_TITLE_MAX) return { message: `제목은 ${LIVE_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (forbidden.some((w) => title.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (typeof v.ringShrink !== "boolean") return { message: "설정을 확인해 주세요." };
  if (!isInt(v.maxPlayers, LIVE_PLAYERS_MIN, LIVE_PLAYERS_MAX)) return { message: `최대 인원은 ${LIVE_PLAYERS_MIN} ~ ${LIVE_PLAYERS_MAX}명이에요.` };
  if (!isInt(v.battleSec, LIVE_BATTLE_MIN_SEC, LIVE_BATTLE_MAX_SEC)) return { message: `배틀 시간은 ${LIVE_BATTLE_MIN_SEC} ~ ${LIVE_BATTLE_MAX_SEC}초예요.` };
  return { title, maxPlayers: v.maxPlayers, battleSec: v.battleSec, ringShrink: v.ringShrink };
}

const phaseOf = (r: StoredRound, now: number): LivePhase => (r.startAt === null ? "OPEN" : now < r.startAt ? "COUNTDOWN" : r.sim?.done ? "DONE" : "FIGHTING");
const rules = (r: StoredRound) => ({ battleSec: r.battleSec, ringShrink: r.ringShrink });
const nameOf = (r: StoredRound, id: string) => r.players.find((p) => p.id === id)?.name ?? "";

/** The battle up to `now`; the first time it ends, its result goes into 회차별 결과. */
export function advanceLive(now = Date.now()) {
  const s = liveStore();
  const r = s.round;
  if (!r?.sim || r.startAt === null || now < r.startAt || r.sim.done) return;
  let ticks = Math.floor((now - r.lastTick) / LIVE_TICK_MS);
  if (ticks > CATCH_UP_TICKS) {
    r.lastTick = now - CATCH_UP_TICKS * LIVE_TICK_MS;
    ticks = CATCH_UP_TICKS;
  }
  for (let i = 0; i < ticks && !r.sim.done; i++) step(r.sim, rules(r));
  r.lastTick += ticks * LIVE_TICK_MS;
  if (r.sim.done && !r.saved) {
    r.saved = true;
    const top = standings(r.sim)[0];
    s.history.unshift({ no: r.no, at: iso(r.startAt + r.sim.t), players: r.players.length, winner: nameOf(r, top.id), kills: top.kills });
    s.history.splice(LIVE_HISTORY_MAX);
  }
}

/** 참가 모집 시작: a new round with its own link. `requestId` makes a retried open a no-op. */
export function openLiveRound(requestId: string, now = Date.now()): string | null {
  const s = liveStore();
  if (s.round?.requestId === requestId) return null;
  advanceLive(now);
  if (s.round && (phaseOf(s.round, now) === "COUNTDOWN" || phaseOf(s.round, now) === "FIGHTING")) return "배틀이 끝난 뒤에 새 판을 열어 주세요.";
  s.seq += 1;
  const set = s.settings;
  s.round = {
    id: `lr-${randomUUID().slice(0, 8)}`,
    no: s.seq,
    requestId,
    token: randomBytes(18).toString("base64url"),
    maxPlayers: set.maxPlayers,
    battleSec: set.battleSec,
    ringShrink: set.ringShrink,
    players: [],
    joins: {},
    startAt: null,
    startRequestId: null,
    sim: null,
    lastTick: 0,
    saved: false
  };
  return null;
}

const roundByToken = (token: unknown) => {
  const r = liveStore().round;
  return r && typeof token === "string" && sameSecret(token, r.token) ? r : null;
};

/** 링크로 참가: a name, while 모집 중. A retried join (same requestId) gets the same fighter. */
export function joinLive(input: { token: unknown; name: unknown; requestId: string }, forbidden: string[], now = Date.now()): { playerId: string; secret: string; name: string } | { message: string } {
  const r = roundByToken(input.token);
  if (!r) return { message: "참가 모집이 끝났거나 없는 링크예요." };
  const again = r.players.find((p) => p.id === r.joins[input.requestId]);
  if (again) return { playerId: again.id, secret: again.secret, name: again.name };
  if (phaseOf(r, now) !== "OPEN") return { message: "이미 배틀이 시작됐어요. 다음 판에 참가해 주세요." };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > LIVE_NAME_MAX) return { message: `이름은 1~${LIVE_NAME_MAX}자로 입력해 주세요.` };
  if (forbidden.some((w) => name.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (r.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return { message: "이미 참가한 이름이에요." };
  if (r.players.length >= r.maxPlayers) return { message: "참가 인원이 다 찼어요." };
  const used = new Set(r.players.map((p) => p.color));
  const player: StoredPlayer = { id: `lp-${randomUUID().slice(0, 8)}`, name, secret: randomBytes(18).toString("base64url"), color: [...Array(LIVE_PLAYERS_MAX).keys()].find((c) => !used.has(c)) ?? 0, lastInputAt: 0 };
  r.players.push(player);
  r.joins[input.requestId] = player.id;
  return { playerId: player.id, secret: player.secret, name };
}

const openRound = (roundId: unknown, now: number) => {
  const r = liveStore().round;
  return r && r.id === roundId && phaseOf(r, now) === "OPEN" ? r : null;
};

/** 빼기 while 모집 중 (their link stops working for this round). */
export function kickLive(input: { roundId: unknown; playerId: unknown }, now = Date.now()): string | null {
  const r = openRound(input.roundId, now);
  if (!r) return "참가 모집 중인 판이 아니에요.";
  r.players = r.players.filter((p) => p.id !== input.playerId);
  return null;
}

/** 배틀 시작: the fighters take their places; the fight begins LIVE_LEAD_SEC later. A retried start is the same battle. */
export function startLive(input: { roundId: unknown; requestId: string }, now = Date.now()): string | null {
  const r = liveStore().round;
  if (!r || r.id !== input.roundId) return "참가 모집 중인 판이 아니에요.";
  if (r.startAt !== null) return r.startRequestId === input.requestId ? null : "이미 배틀을 시작했어요.";
  if (r.players.length < LIVE_PLAYERS_MIN) return `참가자가 ${LIVE_PLAYERS_MIN}명 이상이어야 시작할 수 있어요.`;
  r.startAt = now + LIVE_LEAD_SEC * 1000;
  r.startRequestId = input.requestId;
  r.lastTick = r.startAt;
  r.sim = createSim(r.players.map((p) => p.id));
  return null;
}

/** 판 닫기 (not during the countdown or the fight). */
export function closeLive(roundId: unknown, now = Date.now()): string | null {
  const s = liveStore();
  if (!s.round || s.round.id !== roundId) return null;
  advanceLive(now);
  const phase = phaseOf(s.round, now);
  if (phase === "COUNTDOWN" || phase === "FIGHTING") return "배틀이 끝난 뒤에 닫을 수 있어요.";
  s.round = null;
  return null;
}

function standingViews(r: StoredRound): LiveStandingView[] | null {
  if (!r.sim) return null;
  return standings(r.sim).map((x) => {
    const p = r.players.find((y) => y.id === x.id)!;
    return { id: x.id, name: p.name, color: p.color, rank: x.rank, hp: x.hp, kills: x.kills, outBy: x.out ? (x.out.by === "RING" ? "링 밖" : nameOf(r, x.out.by)) : null };
  });
}

/**
 * A controller's stick and attack (only while fighting and still standing) and what it shows. Null when the token, id or
 * secret do not match: the link was closed, or the player was removed.
 */
export function inputLive(input: { token: unknown; playerId: unknown; secret: unknown; dx?: unknown; dy?: unknown; attack?: unknown }, now = Date.now()): LiveMe | null {
  const r = roundByToken(input.token);
  const p = r?.players.find((x) => x.id === input.playerId);
  if (!r || !p || !sameSecret(input.secret, p.secret)) return null;
  advanceLive(now);
  const phase = phaseOf(r, now);
  const f = r.sim?.players.find((x) => x.id === p.id);
  if (phase === "FIGHTING" && f && !f.out && now - p.lastInputAt >= INPUT_GAP_MS && input.dx !== undefined) {
    p.lastInputAt = now;
    f.input = joystick(input.dx, input.dy);
    if (input.attack === true) f.attack = true;
  }
  const table = standingViews(r);
  const mine = table?.find((x) => x.id === p.id) ?? null;
  return {
    title: liveStore().settings.title || LIVE_TITLE_DEFAULT,
    phase,
    startAt: r.startAt === null ? null : iso(r.startAt),
    serverNow: iso(now),
    players: r.players.length,
    alive: r.sim ? r.sim.players.filter((x) => !x.out).length : r.players.length,
    me: { id: p.id, name: p.name, color: p.color, hp: f ? Math.ceil(f.hp) : LIVE_HP, alive: !f?.out, kills: f?.kills ?? 0, rank: phase === "DONE" || f?.out ? (mine?.rank ?? null) : null },
    winner: phase === "DONE" && table ? table[0].name : null
  };
}

/** The link page before joining (null: no round for this link). */
export function liveInvite(token: unknown, now = Date.now()): LiveInviteView | null {
  const r = roundByToken(token);
  if (!r) return null;
  advanceLive(now);
  return { title: liveStore().settings.title || LIVE_TITLE_DEFAULT, phase: phaseOf(r, now), players: r.players.length, maxPlayers: r.maxPlayers };
}

const FEED_SIZE = 4;
/** OBS: the battle now. */
export function liveState(signal: { reloadSeq: number; on: boolean }, now = Date.now()): LiveState {
  advanceLive(now);
  const s = liveStore();
  const r = s.round;
  const title = s.settings.title || LIVE_TITLE_DEFAULT;
  const base = { title, serverNow: iso(now), reloadSeq: signal.reloadSeq, on: signal.on };
  if (!r) return { ...base, no: null, phase: "NONE", startAt: null, t: 0, battleSec: s.settings.battleSec, ring: 1, fighters: [], feed: [], maxPlayers: s.settings.maxPlayers, standings: null };
  const phase = phaseOf(r, now);
  const sim = r.sim;
  const fighters = r.players.map((p) => {
    const f = sim?.players.find((x) => x.id === p.id);
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      x: f ? Math.round(f.x * 1000) / 1000 : 0,
      y: f ? Math.round(f.y * 1000) / 1000 : 0,
      fx: f?.fx ?? 0,
      fy: f?.fy ?? 1,
      hp: f ? Math.ceil(f.hp) : LIVE_HP,
      alive: !f?.out,
      kills: f?.kills ?? 0,
      attacking: f ? sim!.t - f.lastAttack < LIVE_ATTACK_COOLDOWN_MS / 3 : false
    };
  });
  const feed = (sim?.events ?? [])
    .filter((e) => e.kind !== "HIT")
    .slice(-FEED_SIZE)
    .reverse()
    .map((e) => (e.kind === "RING" ? `🌀 ${nameOf(r, e.target)} 링 밖 탈락` : `⚔️ ${nameOf(r, e.by!)} → ${nameOf(r, e.target)}`));
  return {
    ...base,
    no: r.no,
    phase,
    startAt: r.startAt === null ? null : iso(r.startAt),
    t: sim ? sim.t / 1000 : 0,
    battleSec: r.battleSec,
    ring: sim ? ringAt(sim, rules(r)) : 1,
    fighters,
    feed,
    maxPlayers: r.maxPlayers,
    standings: phase === "DONE" ? standingViews(r) : null
  };
}

/** The studio's round (with its link). */
export function liveRoundView(now = Date.now()): LiveRoundView | null {
  advanceLive(now);
  const r = liveStore().round;
  if (!r) return null;
  const phase = phaseOf(r, now);
  return {
    id: r.id,
    no: r.no,
    phase,
    maxPlayers: r.maxPlayers,
    battleSec: r.battleSec,
    ringShrink: r.ringShrink,
    players: r.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    invitePath: `/play/rumble/${r.token}`,
    startAt: r.startAt === null ? null : iso(r.startAt),
    alive: r.sim ? r.sim.players.filter((x) => !x.out).length : r.players.length,
    standings: phase === "DONE" ? standingViews(r) : null
  };
}
