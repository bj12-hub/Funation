"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { ownEntry } from "@/lib/records";
import { onChannelChanged, startChatFrom } from "@/services/broadcast/chatCore";
import { VIDEO_LOOKUP_MAX, YouTubeAdapter } from "@/services/platforms/adapters";
import { PlatformError, type ChannelVideo, type PlatformErrorCode } from "@/services/platforms/platformTypes";
import { youtubeStore, type YouTubeStore } from "./youtubeCore";
import { HANDLE_PATTERN, type ManagedVideo, type YouTubeIntegration, type YouTubeResult } from "./youtubeTypes";

/**
 * 유튜브 연동 · 영상 목록 Server Actions — code-first. Routes `/creator/youtube`, `/creator/videos`.
 * All platform calls go through the YouTubeAdapter (core types only). Sync is keyed by the platform's
 * video id, so re-syncing never duplicates a video and keeps the creator's settings for it.
 */

/**
 * Stored videos re-checked by id per sync when they are not on the latest page (a video deleted or made private on
 * YouTube is on neither). Bounded: the ones YouTube confirmed longest ago go first, the rest on a later sync.
 */
const VIDEO_CHECK_MAX = 4 * VIDEO_LOOKUP_MAX;
const channelChanged = (): YouTubeResult => ({ status: "INVALID", message: "동기화하는 동안 채널 연결이 바뀌었어요. 다시 시도해 주세요." });

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

/** Upserts by externalId: new videos start visible; known ones keep visible / pinned, and one that came back is no longer missing. */
function merge(s: Store, videos: ChannelVideo[], now: string) {
  let added = 0;
  for (const v of videos) {
    const prev = ownEntry(s.videos, v.externalId);
    if (!prev) added++;
    s.videos[v.externalId] = { ...v, visible: prev?.visible ?? true, pinned: prev?.pinned ?? false, missing: false, syncedAt: now };
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
  if (ownEntry(s.requests, v.requestId)) return { status: "OK" };
  const handle = typeof v.handle === "string" ? v.handle.trim() : "";
  if (!HANDLE_PATTERN.test(handle)) return { status: "INVALID", message: "채널 핸들을 확인해 주세요 (예: @mychannel)." };
  if (s.channel) return { status: "INVALID", message: "이미 연결된 채널이 있어요. 연결을 해제한 뒤 다시 시도해 주세요." };
  let added: number;
  try {
    const channel = await YouTubeAdapter.getChannel(handle.replace(/^@/, "").toLowerCase());
    const videos = await YouTubeAdapter.listVideos(channel.externalChannelId);
    // Checked again after the platform calls: a concurrent connect may have finished in the meantime.
    if (ownEntry(s.requests, v.requestId)) return { status: "OK" };
    if (s.channel) return { status: "INVALID", message: "이미 연결된 채널이 있어요. 연결을 해제한 뒤 다시 시도해 주세요." };
    const now = new Date().toISOString();
    s.requests[v.requestId] = true;
    Object.assign(s, { channel, connectedAt: now, lastSyncedAt: now, lastError: null, videos: {} });
    // Same tick as the write: 통합 채팅 and 후원 연동 start from "now" on the new channel.
    onChannelChanged("YOUTUBE");
    added = merge(s, videos, now);
  } catch (e) {
    return { status: "PLATFORM_ERROR", code: codeOf(e) };
  }
  await startChatFrom("YOUTUBE");
  return { status: "OK", added };
}

/**
 * Latest page plus a by-id check of the stored videos that are not on it: one YouTube no longer shows is marked
 * missing (settings kept), one that came back is unmarked. The settings are never removed here.
 */
export async function syncYouTubeVideos(): Promise<YouTubeResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  // The channel this sync is for: a disconnect, reconnect or 회원 탈퇴 during the platform calls must not get its videos.
  const channelId = store().channel?.externalChannelId;
  if (!channelId) return { status: "INVALID", message: "먼저 유튜브 채널을 연결해 주세요." };
  const sameChannel = () => store().channel?.externalChannelId === channelId;
  let latest: ChannelVideo[];
  let checked: string[];
  const found: ChannelVideo[] = [];
  try {
    latest = await YouTubeAdapter.listVideos(channelId);
    const onPage = new Set(latest.map((v) => v.externalId));
    checked = Object.values(store().videos)
      .filter((v) => !onPage.has(v.externalId))
      .sort((a, b) => a.syncedAt.localeCompare(b.syncedAt))
      .slice(0, VIDEO_CHECK_MAX)
      .map((v) => v.externalId);
    for (let i = 0; i < checked.length; i += VIDEO_LOOKUP_MAX) found.push(...(await YouTubeAdapter.findVideos(channelId, checked.slice(i, i + VIDEO_LOOKUP_MAX))));
  } catch (e) {
    if (!sameChannel()) return channelChanged();
    // Keep the last good list; the status card shows the error until the next successful sync.
    const s = store();
    s.lastError = codeOf(e);
    return { status: "PLATFORM_ERROR", code: s.lastError };
  }
  // Re-read after the last await; from here to the return there is none.
  if (!sameChannel()) return channelChanged();
  const s = store();
  const now = new Date().toISOString();
  s.lastSyncedAt = now;
  s.lastError = null;
  const added = merge(s, [...latest, ...found], now);
  const seen = new Set(found.map((v) => v.externalId));
  let missing = 0;
  for (const id of checked) {
    const v = ownEntry(s.videos, id);
    if (v && !seen.has(id)) {
      v.missing = true;
      missing++;
    }
  }
  return { status: "OK", added, missing };
}

/** Disconnect removes the synced list (the real backend also revokes the OAuth token — TBD). */
export async function disconnectYouTube(): Promise<YouTubeResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  Object.assign(store(), { channel: null, connectedAt: null, lastSyncedAt: null, lastError: null, videos: {} });
  onChannelChanged("YOUTUBE");
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
  const video = typeof v.externalId === "string" ? ownEntry(s.videos, v.externalId) : undefined;
  if (!video) return { status: "INVALID", message: "영상을 찾을 수 없어요." };
  if (v.visible !== undefined && typeof v.visible !== "boolean") return { status: "INVALID", message: "표시 여부를 확인해 주세요." };
  if (v.pinned !== undefined && typeof v.pinned !== "boolean") return { status: "INVALID", message: "고정 여부를 확인해 주세요." };
  if (v.pinned === true && !video.pinned && video.missing) return { status: "INVALID", message: "유튜브에서 찾을 수 없는 영상은 고정할 수 없어요." };
  if (v.pinned === true && !video.pinned && Object.values(s.videos).filter((x) => x.pinned).length >= 3) return { status: "INVALID", message: "고정은 3개까지 할 수 있어요." };
  if (typeof v.visible === "boolean") video.visible = v.visible;
  if (typeof v.pinned === "boolean") video.pinned = v.pinned;
  if (!video.visible) video.pinned = false;
  return { status: "OK" };
}
