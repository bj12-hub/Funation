import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { MEDIA_LIMITS, type Drawing, type DrawingSettings, type VideoRequest, type VideoSettings } from "./mediaTypes";

/**
 * Server-only video queue and drawing gallery (not a "use server" module): the Donation Core adds
 * paid requests, the studio actions add tests and control playback. State lives on `globalThis`.
 */

type MockMedia = {
  videos: VideoRequest[];
  /** When the PLAYING video started (the server ends it after its range). */
  playingSince: number | null;
  videoSettings: VideoSettings;
  drawings: Drawing[];
  showing: { id: string; until: number } | null;
  drawingSettings: DrawingSettings;
  requests: Record<string, true>;
};

const g = globalThis as typeof globalThis & { __funationMockMediaV1?: MockMedia };
export const mockMedia = (g.__funationMockMediaV1 ??= {
  videos: [],
  playingSince: null,
  videoSettings: { autoPlay: true, maxSec: 180, volume: 70 },
  drawings: [],
  showing: null,
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

export function addDrawing(input: Omit<Drawing, "id" | "receivedAt">, now = Date.now()) {
  const item: Drawing = { id: newId("drw", now), ...input, receivedAt: stamp(now) };
  mockMedia.drawings.unshift(item);
  mockMedia.drawings.length = Math.min(mockMedia.drawings.length, MEDIA_LIMITS.drawingsMax);
  showDrawing(item.id, now);
  return item;
}

export function addDonationDrawing(creatorId: string, input: { donor: string; title: string; fnAmount: number; image: string }) {
  if (creatorId !== STUDIO_CHANNEL) return;
  addDrawing({ kind: "DONATION", ...input });
}

export function showDrawing(id: string, now = Date.now()) {
  if (!mockMedia.drawings.some((d) => d.id === id)) return false;
  mockMedia.showing = { id, until: now + mockMedia.drawingSettings.displaySec * 1000 };
  return true;
}

export function currentDrawing(now = Date.now()) {
  const s = mockMedia.showing;
  if (!s || now >= s.until) return null;
  const d = mockMedia.drawings.find((x) => x.id === s.id);
  return d ? { drawing: d, until: stamp(s.until) } : null;
}
