/**
 * 로얄 럼블 (조작형) — code-first, StreamDonate "로얄 럼블 (조작형)" 참고 (P2 시청자 참여 게임, free: no FN, no points).
 * Client-safe. The creator opens a round and shares its link; viewers join with a name and steer their own fighter from the
 * link (joystick or keyboard, attack button). The server runs the battle (`rumbleLiveSim`), OBS draws it live, and the last
 * one standing wins. Without a realtime connection (TBD: WebSocket), the controller sends input and OBS reads the state
 * several times a second.
 */

export const LIVE_TITLE_DEFAULT = "로얄 럼블 (조작형)";
export const LIVE_TITLE_MAX = 20;
export const LIVE_PLAYERS_MIN = 2;
export const LIVE_PLAYERS_MAX = 16;
export const LIVE_NAME_MAX = 12;
export const LIVE_BATTLE_MIN_SEC = 30;
export const LIVE_BATTLE_MAX_SEC = 180;
/** Seconds between 배틀 시작 and the fight (OBS and the controllers count down). */
export const LIVE_LEAD_SEC = 3;
export const LIVE_HISTORY_MAX = 20;
/** How often OBS reads the battle when it cannot stream it, and how often a controller sends its stick at most (ms). */
export const LIVE_OBS_POLL_MS = 100;
export const LIVE_INPUT_MS = 100;
/**
 * OBS stream (2026-11-01): the battle on every server tick while a round counts down or fights (ms); otherwise when it
 * changes, or at least this often (ms).
 */
export const LIVE_STREAM_MS = 50;
export const LIVE_STREAM_IDLE_MS = 1_000;

export type LiveSettings = { title: string; maxPlayers: number; battleSec: number; ringShrink: boolean };
export const DEFAULT_LIVE: LiveSettings = { title: "", maxPlayers: 12, battleSec: 90, ringShrink: true };

/** OPEN (참가 모집) → COUNTDOWN → FIGHTING → DONE, by the clock once started. */
export type LivePhase = "OPEN" | "COUNTDOWN" | "FIGHTING" | "DONE";
export type LivePlayer = { id: string; name: string; color: number };
export type LiveFighter = LivePlayer & { x: number; y: number; fx: number; fy: number; hp: number; alive: boolean; kills: number; attacking: boolean };
export type LiveStandingView = { id: string; name: string; color: number; rank: number; hp: number; kills: number; outBy: string | null };
export type LiveHistoryEntry = { no: number; at: string; players: number; winner: string; kills: number };

/** OBS: the battle now (positions in arena units, radius 1). */
export type LiveState = {
  title: string;
  no: number | null;
  phase: LivePhase | "NONE";
  startAt: string | null;
  serverNow: string;
  /** Seconds into the fight. */
  t: number;
  battleSec: number;
  ring: number;
  fighters: LiveFighter[];
  /** The latest hits and knockouts, newest first, as shown. */
  feed: string[];
  maxPlayers: number;
  standings: LiveStandingView[] | null;
  reloadSeq: number;
  on: boolean;
};

/** The studio's round. `invitePath` holds the round's secret token (shown to the creator only). */
export type LiveRoundView = {
  id: string;
  no: number;
  phase: LivePhase;
  maxPlayers: number;
  battleSec: number;
  ringShrink: boolean;
  players: LivePlayer[];
  invitePath: string;
  startAt: string | null;
  alive: number;
  standings: LiveStandingView[] | null;
};
export type LiveView = { settings: LiveSettings; round: LiveRoundView | null; history: LiveHistoryEntry[]; overlayPath: string; serverNow: string };
export type LiveResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** The link page before joining. */
export type LiveInviteView = { title: string; phase: LivePhase; players: number; maxPlayers: number };
/** A player's key to their fighter: kept in that browser only. */
export type LiveJoinResult = { status: "JOINED"; playerId: string; secret: string; name: string } | { status: "INVALID"; message: string };
/** What a controller shows: the round and its own fighter. */
export type LiveMe = {
  title: string;
  phase: LivePhase;
  startAt: string | null;
  serverNow: string;
  players: number;
  alive: number;
  me: { id: string; name: string; color: number; hp: number; alive: boolean; kills: number; rank: number | null };
  winner: string | null;
};
