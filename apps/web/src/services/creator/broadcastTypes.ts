/**
 * 방송 설정 with FLEXTV (phase 5, docs/development/flextv-backend.md "5단계"). Client-safe types and limits; FLEXTV's
 * own broadcast form is the reference (its title field takes 64 characters, three tags).
 */

export type BroadcastOption = { value: string; label: string };
export type BroadcastEngine = "ncp_llh" | "ncp";
export type BroadcastDisplayMode = "landscape" | "portrait";
export type BroadcastResolution = "1080" | "720" | "480";

export const ENGINE_LABEL: Record<BroadcastEngine, string> = { ncp_llh: "짧은 지연", ncp: "일반" };
export const RESOLUTION_OPTIONS: BroadcastResolution[] = ["1080", "720", "480"];

export const BROADCAST_TITLE_MAX = 64;
export const BROADCAST_TAG_MAX = 3;
/** A technical guard; FLEXTV sets no limit of its own. */
export const BROADCAST_PASSWORD_MAX = 32;

/** What the form starts from: the open stream, else the last one (as FLEXTV's form does). */
export type BroadcastDefaults = {
  title: string;
  themeId: string | null;
  tagCodes: string[];
  forAdult: boolean;
  hasPassword: boolean;
  visitAllow: boolean;
  watermark: boolean;
  recordingWarning: boolean;
  adultThumbnail: boolean;
  displayMode: BroadcastDisplayMode;
};

export type BroadcastView = {
  channelId: string;
  channelName: string;
  /** The room on this site. */
  watchPath: string;
  /** On air. */
  live: boolean;
  /** A stream not ended yet (on air, or waiting for OBS to reconnect): the form changes it instead of starting one. */
  streaming: boolean;
  defaults: BroadcastDefaults;
  suspension: { permanent: boolean; until: string | null; reason: string | null } | null;
  /** OBS 서버 per engine; the key itself is fetched only on request (`revealStreamKey`). */
  keys: { engine: BroadcastEngine; label: string; serverUrl: string }[];
  /** The engine FLEXTV plays the channel with; null = FLEXTV has none yet. */
  engine: BroadcastEngine | null;
  themes: BroadcastOption[];
  tags: BroadcastOption[];
  /** 19+: may set 연령제한 and the 성인 theme. */
  adult: boolean;
};

export type BroadcastInput = {
  title: string;
  themeId: string;
  tagCodes: string[];
  forAdult: boolean;
  /** KEEP: the room password stays as it is (it never comes to the browser). */
  password: { mode: "NONE" } | { mode: "KEEP" } | { mode: "SET"; value: string };
  visitAllow: boolean;
  watermark: boolean;
  recordingWarning: boolean;
  adultThumbnail: boolean;
  displayMode: BroadcastDisplayMode;
  resolution: BroadcastResolution;
  /** FLEXTV's 방송 준수사항, asked before each start. */
  agreed: boolean;
};

export type BroadcastResult =
  | { status: "STARTED" | "UPDATED" | "STOPPED" }
  | { status: "INVALID"; message: string }
  /** FLEXTV refused: the reason in the member's words. */
  | { status: "REFUSED"; message: string }
  | { status: "UNAUTHORIZED" }
  /** FLEXTV did not answer: the page reads the state again. */
  | { status: "UNKNOWN" };

export type RevealResult = { status: "OK"; streamKey: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" | "UNKNOWN" };
export type EngineResult = { status: "SAVED"; engine: BroadcastEngine } | { status: "INVALID" | "UNAUTHORIZED" | "UNKNOWN" };
