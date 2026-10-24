import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { PLAY_KEYWORD_MAX, PLAY_NAME_MAX, type PlaySource } from "./playTypes";

/**
 * 로얄 럼블 — code-first, StreamDonate 로얄 럼블 참고 (P2 시청자 참여 게임, free: no FN, no points). Viewers join a round by
 * typing the keyword in chat (통합 채팅 `!참여`); the operator can add names too, and 봇 fill the ring up to a set number.
 * When the battle starts the server decides it all — who is knocked out when, by whom (or by the ring), and the last one
 * standing (always a person, never a bot). OBS plays it out in a round arena: fighters roam, the ring closes in (링 축소),
 * 서든데스 squeezes the last few, and the winner is shown. Rounds are kept as 회차별 결과.
 */

export const RUMBLE_TITLE_DEFAULT = "로얄 럼블";
export const RUMBLE_TITLE_MAX = 20;
export const RUMBLE_KEYWORD_MAX = PLAY_KEYWORD_MAX;
export const RUMBLE_NAME_MAX = PLAY_NAME_MAX;
/** People needed to start a battle (봇 don't count). */
export const RUMBLE_PLAYERS_MIN = 2;
export const RUMBLE_PLAYERS_MAX = 50;
/** 봇 채우기: the ring is filled with 봇 up to this many fighters at most (0 = no 봇). */
export const RUMBLE_FILL_MAX = 30;
export const RUMBLE_BATTLE_MIN_SEC = 20;
export const RUMBLE_BATTLE_MAX_SEC = 120;
/** Seconds between 배틀 시작 and the fight (OBS counts down). */
export const RUMBLE_LEAD_SEC = 3;
export const RUMBLE_HISTORY_MAX = 20;
/** Where 링 축소 steps in, and 서든데스 starts, as a share of the battle. */
export const RUMBLE_SHRINK_AT = [0.25, 0.5] as const;
export const RUMBLE_SUDDEN_AT = 0.8;

export type RumbleSettings = {
  title: string;
  keyword: string;
  maxPlayers: number;
  /** 봇 채우기: fewer people than this and 봇 make up the rest (0 = no 봇). */
  fillTo: number;
  battleSec: number;
  ringShrink: boolean;
  suddenDeath: boolean;
};
export const DEFAULT_RUMBLE: RumbleSettings = { title: "", keyword: "!참여", maxPlayers: RUMBLE_PLAYERS_MAX, fillTo: 10, battleSec: 45, ringShrink: true, suddenDeath: true };

export type RumbleEntrant = { id: string; name: string; source: PlaySource };
export type RumbleFighter = { id: string; name: string; bot: boolean };
/** A knockout `at` seconds into the fight: by `killerId`, or by the ring (null). */
export type RumbleKnockout = { at: number; victimId: string; killerId: string | null };
/** A battle: the fight starts at `startAt` and the last knockout is at `endAt`. `knockouts` are in time order. */
export type RumbleBattle = {
  startAt: string;
  endAt: string;
  ringShrink: boolean;
  suddenDeath: boolean;
  fighters: RumbleFighter[];
  knockouts: RumbleKnockout[];
  winnerId: string;
};
/** A round: `status` OPEN (모집 중) → FIGHTING → DONE (by the clock once started). */
export type RumbleRound = {
  id: string;
  no: number;
  status: "OPEN" | "FIGHTING" | "DONE";
  keyword: string;
  maxPlayers: number;
  fillTo: number;
  entrants: RumbleEntrant[];
  battle: RumbleBattle | null;
};
export type RumbleHistoryEntry = { no: number; at: string; players: number; bots: number; winner: string; kills: number; topKiller: { name: string; kills: number } | null };

export type RumbleView = { settings: RumbleSettings; round: RumbleRound | null; history: RumbleHistoryEntry[]; overlayPath: string; serverNow: string };
/** OBS: `reloadSeq` · `on` from 리모컨. */
export type RumbleOverlayView = { title: string; round: RumbleRound | null; theme: ResolvedTheme; serverNow: string; reloadSeq: number; on: boolean };
export type RumbleResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** 봇 joining a round of `people`: enough to make `fillTo` fighters. */
export const rumbleBots = (people: number, fillTo: number) => Math.max(0, fillTo - people);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);

/**
 * The ring's radius (1 = the whole arena) `t` seconds into a `sec`-second fight: 링 축소 closes it in two steps
 * (1 → 0.8 → 0.62), 서든데스 squeezes it down to 0.22 by the end.
 */
export function rumbleRing(t: number, sec: number, ringShrink: boolean, suddenDeath: boolean) {
  const p = t / sec;
  const step = (at: number) => ease(clamp01((p - at) / 0.04));
  const base = ringShrink ? 1 - 0.2 * step(RUMBLE_SHRINK_AT[0]) - 0.18 * step(RUMBLE_SHRINK_AT[1]) : 1;
  if (!suddenDeath || p <= RUMBLE_SUDDEN_AT) return base;
  return base + (0.22 - base) * ease(clamp01((p - RUMBLE_SUDDEN_AT) / (1 - RUMBLE_SUDDEN_AT)));
}

export type RumbleStanding = RumbleFighter & { rank: number; kills: number; out: RumbleKnockout | null };
/** The battle's table: the winner 1st, then the last knocked out 2nd and so on, with each fighter's 처치 수. */
export function rumbleStandings(battle: RumbleBattle): RumbleStanding[] {
  const n = battle.fighters.length;
  const kills = new Map<string, number>();
  for (const k of battle.knockouts) if (k.killerId) kills.set(k.killerId, (kills.get(k.killerId) ?? 0) + 1);
  const rank = new Map<string, { rank: number; out: RumbleKnockout | null }>([[battle.winnerId, { rank: 1, out: null }]]);
  battle.knockouts.forEach((k, i) => rank.set(k.victimId, { rank: n - i, out: k }));
  return battle.fighters.map((f) => ({ ...f, ...rank.get(f.id)!, kills: kills.get(f.id) ?? 0 })).sort((a, b) => a.rank - b.rank);
}
