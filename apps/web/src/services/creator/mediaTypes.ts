/**
 * 영상 후원 · 그림후원 위젯 — code-first (funnation 위젯 "영상", "그림후원"). Client-safe types.
 * The queue order and timing are server-owned; overlays only render what the server says is on screen.
 */

export type VideoStatus = "WAITING" | "PLAYING" | "DONE" | "SKIPPED";

export type VideoRequest = {
  id: string;
  kind: "DONATION" | "TEST";
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

export type OverlayVideo = { playing: { id: string; videoId: string; startSec: number; endSec: number; endsAt: string } | null; volume: number; reloadSeq: number };

export type Drawing = { id: string; kind: "DONATION" | "TEST"; donor: string; title: string; fnAmount: number; image: string; receivedAt: string };

export type DrawingSettings = { displaySec: number };

export type DrawingView = { settings: DrawingSettings; showing: { id: string; until: string } | null; drawings: Drawing[] };

export type OverlayDrawing = { drawing: (Omit<Drawing, "kind" | "receivedAt"> & { until: string }) | null; reloadSeq: number };

export const MEDIA_LIMITS = { maxSecMin: 10, maxSecMax: 600, displaySecMin: 5, displaySecMax: 120, historyMax: 30, drawingsMax: 30 } as const;

export type MediaResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
