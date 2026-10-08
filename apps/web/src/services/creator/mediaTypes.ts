import type { ResolvedTheme } from "./overlayThemeTypes";

/**
 * 영상 후원 · 그림후원 위젯 — code-first (funnation 위젯 "영상", "그림후원"). Client-safe types.
 * The queue order and timing are server-owned; overlays only render what the server says is on screen.
 */

export type VideoStatus = "WAITING" | "PLAYING" | "DONE" | "SKIPPED";

export type VideoRequest = {
  id: string;
  kind: "DONATION" | "TEST";
  /** AUDIO = 음성 후원 (sound with a small player); absent on requests from before it = VIDEO. */
  mode?: "VIDEO" | "AUDIO";
  donor: string;
  fnAmount: number;
  videoId: string;
  startSec: number;
  endSec: number;
  requestedAt: string;
  status: VideoStatus;
};

export type VideoSettings = {
  /** Off = 영상 후원 requests still queue, but nothing auto-plays. */
  autoPlay: boolean;
  /** Longest clip the overlay plays (a longer range is cut here). A channel setting. */
  maxSec: number;
  volume: number;
};

export type VideoQueueView = {
  settings: VideoSettings;
  playing: (VideoRequest & { endsAt: string }) | null;
  waiting: VideoRequest[];
  history: VideoRequest[];
};

/** `donor` shows as the creator's 대체 메시지 settings say (like alerts); `theme` = the 영상 후원 오버레이 테마. */
export type OverlayVideo = {
  playing: { id: string; videoId: string; startSec: number; endSec: number; endsAt: string; donor: string; fnAmount: number; mode: "VIDEO" | "AUDIO" } | null;
  volume: number;
  reloadSeq: number;
  on: boolean;
  theme: ResolvedTheme;
};

export type Drawing = { id: string; kind: "DONATION" | "TEST"; donor: string; title: string; fnAmount: number; image: string; receivedAt: string };

export type DrawingSettings = { displaySec: number };

/** `queue`: ids of drawings waiting for the overlay, next first. */
export type DrawingView = { settings: DrawingSettings; showing: { id: string; until: string } | null; queue: string[]; drawings: Drawing[] };

export type OverlayDrawing = { drawing: (Omit<Drawing, "kind" | "receivedAt"> & { until: string }) | null; reloadSeq: number; on: boolean; theme: ResolvedTheme };

/** `rangeSecMax`: the latest 시작 · 종료 second a 영상 후원 (or 테스트 영상) may name — 24 hours. */
export const MEDIA_LIMITS = { maxSecMin: 10, maxSecMax: 600, displaySecMin: 5, displaySecMax: 120, historyMax: 30, drawingsMax: 30, rangeSecMax: 86_400 } as const;

export type MediaResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
