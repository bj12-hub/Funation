import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { MEDIA_LIMITS, type Drawing, type DrawingSettings, type VideoRequest, type VideoSettings } from "./mediaTypes";

/**
 * Server-only video queue and drawing gallery (not a "use server" module): the Donation Core adds
 * paid requests, the studio actions add tests and control playback. State lives on `globalThis`.
 * 그림후원 대기열 (2026-10-07 결정): drawings take turns like 영상 후원 — a new one waits until the one on
 * screen has had its 전시 시간, instead of replacing it.
 */

type MockMedia = {
  videos: VideoRequest[];
  /** When the PLAYING video started (the server ends it after its range). */
  playingSince: number | null;
  videoSettings: VideoSettings;
  drawings: Drawing[];
  showing: { id: string; until: number } | null;
  /** Drawings waiting for the overlay, oldest first (ids). */
  drawingQueue: string[];
  drawingSettings: DrawingSettings;
  requests: Record<string, true>;
};

// V2: drawings queue (`drawingQueue`); a new key starts a running dev server with the new shape.
const g = globalThis as typeof globalThis & { __funationMockMediaV2?: MockMedia };
export const mockMedia = (g.__funationMockMediaV2 ??= {
  videos: [],
  playingSince: null,
  videoSettings: { autoPlay: true, maxSec: 180, volume: 70 },
  drawings: [],
  showing: null,
  drawingQueue: [],
  drawingSettings: { displaySec: 15 },
  requests: {}
});

const stamp = (ms: number) => new Date(ms).toISOString();
const newId = (prefix: string, now: number) => `${prefix}-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Seconds the overlay plays for this request (range cut to the channel's max). */
export const playSeconds = (v: VideoRequest, settings = mockMedia.videoSettings) => Math.min(v.endSec - v.startSec, settings.maxSec);

export function playingVideo() {
  return mockMedia.videos.find((v) => v.status === "PLAYING") ?? null;
}

function trimHistory() {
  const done = mockMedia.videos.filter((v) => v.status === "DONE" || v.status === "SKIPPED");
  const drop = new Set(done.slice(0, Math.max(0, done.length - MEDIA_LIMITS.historyMax)).map((v) => v.id));
  if (drop.size) mockMedia.videos = mockMedia.videos.filter((v) => !drop.has(v.id));
}

export function startVideo(id: string, now = Date.now()) {
  const current = playingVideo();
  if (current) current.status = "DONE";
  const next = mockMedia.videos.find((v) => v.id === id && v.status === "WAITING");
  if (!next) return false;
  next.status = "PLAYING";
  mockMedia.playingSince = now;
  trimHistory();
  return true;
}

/** Ends a finished clip and, with 자동 재생, starts the oldest waiting request. */
export function advanceVideos(now = Date.now()) {
  const current = playingVideo();
  if (current && mockMedia.playingSince !== null && now >= mockMedia.playingSince + playSeconds(current) * 1000) {
    current.status = "DONE";
    mockMedia.playingSince = null;
  }
  if (!playingVideo() && mockMedia.videoSettings.autoPlay) {
    const next = mockMedia.videos.find((v) => v.status === "WAITING");
    if (next) startVideo(next.id, now);
  }
  trimHistory();
}

export function playingEndsAt(v: VideoRequest) {
  return stamp((mockMedia.playingSince ?? Date.now()) + playSeconds(v) * 1000);
}

export function enqueueVideo(input: Pick<VideoRequest, "kind" | "donor" | "fnAmount" | "videoId" | "startSec" | "endSec">, now = Date.now()) {
  const item: VideoRequest = { id: newId("vid", now), ...input, requestedAt: stamp(now), status: "WAITING" };
  mockMedia.videos.push(item);
  advanceVideos(now);
  return item;
}

/** Donation Core hook: only the studio channel has an overlay in the mock (TBD: per-creator queues). */
export function enqueueDonationVideo(creatorId: string, input: { donor: string; fnAmount: number; videoId: string; startSec: number; endSec: number }) {
  if (creatorId !== STUDIO_CHANNEL) return;
  enqueueVideo({ kind: "DONATION", ...input });
}

/** The gallery keeps the newest `drawingsMax`, but never drops a drawing that is waiting or on screen. */
function trimDrawings() {
  const keep = new Set([...mockMedia.drawingQueue, mockMedia.showing?.id]);
  let extra = mockMedia.drawings.length - MEDIA_LIMITS.drawingsMax;
  for (let i = mockMedia.drawings.length - 1; i >= 0 && extra > 0; i--) {
    if (keep.has(mockMedia.drawings[i].id)) continue;
    mockMedia.drawings.splice(i, 1);
    extra--;
  }
}

/** Once the drawing on screen has had its 전시 시간 (or nothing is on screen), the next waiting one goes up. */
export function advanceDrawings(now = Date.now()) {
  const s = mockMedia.showing;
  if (s && now < s.until) return;
  mockMedia.showing = null;
  while (mockMedia.drawingQueue.length) {
    const id = mockMedia.drawingQueue.shift()!;
    if (!mockMedia.drawings.some((d) => d.id === id)) continue; // deleted while waiting
    mockMedia.showing = { id, until: now + mockMedia.drawingSettings.displaySec * 1000 };
    break;
  }
}

export function addDrawing(input: Omit<Drawing, "id" | "receivedAt">, now = Date.now()) {
  const item: Drawing = { id: newId("drw", now), ...input, receivedAt: stamp(now) };
  mockMedia.drawings.unshift(item);
  mockMedia.drawingQueue.push(item.id);
  advanceDrawings(now);
  trimDrawings();
  return item;
}

export function addDonationDrawing(creatorId: string, input: { donor: string; title: string; fnAmount: number; image: string }) {
  if (creatorId !== STUDIO_CHANNEL) return;
  addDrawing({ kind: "DONATION", ...input });
}

/** 전시: the creator puts this drawing up now (it leaves the queue; the one it replaces is done). */
export function showDrawing(id: string, now = Date.now()) {
  if (!mockMedia.drawings.some((d) => d.id === id)) return false;
  mockMedia.drawingQueue = mockMedia.drawingQueue.filter((x) => x !== id);
  mockMedia.showing = { id, until: now + mockMedia.drawingSettings.displaySec * 1000 };
  return true;
}

export function currentDrawing(now = Date.now()) {
  const s = mockMedia.showing;
  if (!s || now >= s.until) return null;
  const d = mockMedia.drawings.find((x) => x.id === s.id);
  return d ? { drawing: d, until: stamp(s.until) } : null;
}
