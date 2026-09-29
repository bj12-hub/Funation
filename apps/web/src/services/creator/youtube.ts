"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { YouTubeAdapter } from "@/services/platforms/adapters";
import { PlatformError, type ChannelVideo, type PlatformErrorCode } from "@/services/platforms/platformTypes";
import { youtubeStore, type YouTubeStore } from "./youtubeCore";
import { HANDLE_PATTERN, type ManagedVideo, type YouTubeIntegration, type YouTubeResult } from "./youtubeTypes";

/**
 * 유튜브 연동 · 영상 목록 Server Actions — code-first. Routes `/creator/youtube`, `/creator/videos`.
 * All platform calls go through the YouTubeAdapter (core types only). Sync is keyed by the platform's
 * video id, so re-syncing never duplicates a video and keeps the creator's settings for it.
 */

type Store = YouTubeStore;
const store = youtubeStore;

const assertMock = () => {
  if (!USE_MOCK) throw new Error("YouTube integration API is not connected yet.");
};
const codeOf = (e: unknown): PlatformErrorCode => (e instanceof PlatformError ? e.code : "UNAVAILABLE");

function view(s: Store): YouTubeIntegration {
  return {
    status: !s.channel ? "DISCONNECTED" : s.lastError ? "ERROR" : "CONNECTED",
    channel: s.channel,
    connectedAt: s.connectedAt,
    lastSyncedAt: s.lastSyncedAt,
    lastError: s.lastError,
    videoCount: Object.keys(s.videos).length
  };
}

/** Upserts by externalId: new videos start visible; known ones keep visible / pinned. */
function merge(s: Store, videos: ChannelVideo[], now: string) {
  let added = 0;
  for (const v of videos) {
    const prev = s.videos[v.externalId];
    if (!prev) added++;
    s.videos[v.externalId] = { ...v, visible: prev?.visible ?? true, pinned: prev?.pinned ?? false, syncedAt: now };
  }
  return added;
}

export async function getYouTubeIntegration(): Promise<YouTubeIntegration | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return structuredClone(view(store()));
}

export async function connectYouTube(input: unknown): Promise<YouTubeResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const s = store();
  if (s.requests[v.requestId]) return { status: "OK" };
  const handle = typeof v.handle === "string" ? v.handle.trim() : "";
  if (!HANDLE_PATTERN.test(handle)) return { status: "INVALID", message: "채널 핸들을 확인해 주세요 (예: @mychannel)." };
  if (s.channel) return { status: "INVALID", message: "이미 연결된 채널이 있어요. 연결을 해제한 뒤 다시 시도해 주세요." };
  try {
    const channel = await YouTubeAdapter.getChannel(handle.replace(/^@/, "").toLowerCase());
    const videos = await YouTubeAdapter.listVideos(channel.externalChannelId);
    const now = new Date().toISOString();
    s.requests[v.requestId] = true;
    Object.assign(s, { channel, connectedAt: now, lastSyncedAt: now, lastError: null, videos: {} });
    return { status: "OK", added: merge(s, videos, now) };
  } catch (e) {
    return { status: "PLATFORM_ERROR", code: codeOf(e) };
  }
}

export async function syncYouTubeVideos(): Promise<YouTubeResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const s = store();
  if (!s.channel) return { status: "INVALID", message: "먼저 유튜브 채널을 연결해 주세요." };
  try {
    const videos = await YouTubeAdapter.listVideos(s.channel.externalChannelId);
    const now = new Date().toISOString();
    s.lastSyncedAt = now;
    s.lastError = null;
    return { status: "OK", added: merge(s, videos, now) };
  } catch (e) {
    // Keep the last good list; the status card shows the error until the next successful sync.
    s.lastError = codeOf(e);
    return { status: "PLATFORM_ERROR", code: s.lastError };
  }
}

/** Disconnect removes the synced list (the real backend also revokes the OAuth token — TBD). */
export async function disconnectYouTube(): Promise<YouTubeResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  Object.assign(store(), { channel: null, connectedAt: null, lastSyncedAt: null, lastError: null, videos: {} });
  return { status: "OK" };
}

export async function listManagedVideos(): Promise<ManagedVideo[] | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return Object.values(store().videos)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt))
    .map((v) => ({ ...v }));
}

/** 채널 영상 탭 표시 / 고정 (최대 3개 고정). */
export async function updateVideo(input: unknown): Promise<YouTubeResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const s = store();
  const video = typeof v.externalId === "string" ? s.videos[v.externalId] : undefined;
  if (!video) return { status: "INVALID", message: "영상을 찾을 수 없어요." };
  if (v.visible !== undefined && typeof v.visible !== "boolean") return { status: "INVALID", message: "표시 여부를 확인해 주세요." };
  if (v.pinned !== undefined && typeof v.pinned !== "boolean") return { status: "INVALID", message: "고정 여부를 확인해 주세요." };
  if (v.pinned === true && !video.pinned && Object.values(s.videos).filter((x) => x.pinned).length >= 3) return { status: "INVALID", message: "고정은 3개까지 할 수 있어요." };
  if (typeof v.visible === "boolean") video.visible = v.visible;
  if (typeof v.pinned === "boolean") video.pinned = v.pinned;
  if (!video.visible) video.pinned = false;
  return { status: "OK" };
}
