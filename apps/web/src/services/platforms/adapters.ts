import type { Platform } from "@/types/platform";
import { PlatformError, type ChannelProfile, type ChannelVideo, type ExternalDonationEvent, type PlatformCapability } from "./platformTypes";

/**
 * PlatformAdapter (CLAUDE.md §9) — server-only. Each platform declares what it can do; callers check
 * `capabilities` instead of assuming every platform has the same API. The mock "remote" calls below
 * stand in for the real APIs (YouTube Data API via OAuth — TBD) and return platform-shaped DTOs that
 * are mapped here, so the rest of the app only sees core types.
 */
export interface PlatformAdapter {
  platform: Platform;
  capabilities: readonly PlatformCapability[];
  getChannel(handle: string): Promise<ChannelProfile>;
  listVideos(externalChannelId: string, opts?: { max?: number }): Promise<ChannelVideo[]>;
  /** Events after `cursor` (opaque), oldest first. Only for adapters with DONATION_EVENTS. */
  fetchDonationEvents(externalChannelId: string, cursor: string | null): Promise<{ events: ExternalDonationEvent[]; cursor: string | null }>;
}

const TIMEOUT_MS = 5_000;

/** Bounded wait for a remote call; the backend would also retry idempotent reads with backoff. */
async function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new PlatformError("TIMEOUT", "timeout")), ms)))]);
  } finally {
    clearTimeout(timer);
  }
}

// ── YouTube (mock remote) ────────────────────────────────────────────────────

/** Shapes loosely modelled on the YouTube Data API; used only inside this file. */
type YtChannelDto = { id: string; snippet: { title: string; customUrl: string }; statistics: { subscriberCount: string } };
type YtVideoDto = { id: { videoId: string }; snippet: { title: string; publishedAt: string }; contentDetails: { duration: string }; statistics: { viewCount: string } };

type YtSuperChatDto = { id: string; snippet: { publishedAt: string; superChatDetails: { amountMicros: string; currency: string; userComment: string } }; authorDetails: { displayName: string } };

const g = globalThis as typeof globalThis & { __funationMockYouTubeRemoteV2?: { uploads: Record<string, number>; chats: Record<string, YtSuperChatDto[]> } };
const remote = () => (g.__funationMockYouTubeRemoteV2 ??= { uploads: {}, chats: {} });

/** Mock only: a paid chat arrives on the channel (the developer simulator in 후원 연동 calls this). */
export function mockYouTubeSuperChat(channelId: string, input: { id: string; donor: string; message: string; value: number; currency: string }) {
  (remote().chats[channelId] ??= []).push({
    id: input.id,
    snippet: { publishedAt: new Date().toISOString(), superChatDetails: { amountMicros: String(Math.round(input.value * 1_000_000)), currency: input.currency, userComment: input.message } },
    authorDetails: { displayName: input.donor }
  });
}

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Test hooks for failure paths: a handle containing these words fails like the real API might. */
function simulateFailure(handle: string) {
  if (handle.includes("timeout")) throw new PlatformError("TIMEOUT", "timeout");
  if (handle.includes("down")) throw new PlatformError("UNAVAILABLE", "unavailable");
  if (handle.includes("missing")) throw new PlatformError("NOT_FOUND", "not found");
}

async function ytFetchChannel(handle: string): Promise<YtChannelDto> {
  simulateFailure(handle);
  const h = hash(handle);
  return { id: `UC${h.toString(36).padStart(8, "0")}`, snippet: { title: `${handle} 채널`, customUrl: `@${handle}` }, statistics: { subscriberCount: String(1_000 + (h % 90_000)) } };
}

async function ytFetchVideos(channelId: string, max: number): Promise<YtVideoDto[]> {
  const base = 8 + (remote().uploads[channelId] ?? 0);
  const h = hash(channelId);
  const day = 86_400_000;
  const start = Date.UTC(2026, 8, 1);
  return Array.from({ length: Math.min(base, max) }, (_, k) => {
    const i = base - 1 - k; // newest first
    const shorts = i % 3 === 2;
    const sec = shorts ? 20 + ((h + i) % 40) : 600 + ((h + i * 97) % 5_400);
    return {
      id: { videoId: `${channelId.slice(2, 8)}v${String(i).padStart(3, "0")}` },
      snippet: { title: shorts ? `쇼츠 하이라이트 #${i + 1}` : `방송 다시보기 #${i + 1}`, publishedAt: new Date(start + i * day).toISOString() },
      contentDetails: { duration: `PT${Math.floor(sec / 60)}M${sec % 60}S` },
      statistics: { viewCount: String(100 + ((h >>> (i % 16)) % 50_000)) }
    };
  });
}

/** Mock only: the next sync sees one more upload (to exercise incremental sync and dedupe). */
export function mockYouTubeUpload(channelId: string) {
  remote().uploads[channelId] = (remote().uploads[channelId] ?? 0) + 1;
}

export function parseIsoDuration(v: string) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(v);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

export const mapYouTubeVideo = (v: YtVideoDto): ChannelVideo => {
  const durationSec = parseIsoDuration(v.contentDetails.duration);
  return {
    platform: "YOUTUBE",
    externalId: v.id.videoId,
    title: v.snippet.title.slice(0, 100),
    kind: durationSec <= 60 ? "SHORTS" : "VOD",
    durationSec,
    publishedAt: v.snippet.publishedAt,
    viewCount: Math.max(0, Number(v.statistics.viewCount) || 0),
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(v.id.videoId)}`
  };
};

export const YouTubeAdapter: PlatformAdapter = {
  platform: "YOUTUBE",
  capabilities: ["CHANNEL_PROFILE", "VIDEO_LIST", "LIVE_STATUS", "DONATION_EVENTS"],
  async getChannel(handle) {
    const dto = await withTimeout(ytFetchChannel(handle));
    return { platform: "YOUTUBE", externalChannelId: dto.id, title: dto.snippet.title, handle: dto.snippet.customUrl, subscriberCount: Number(dto.statistics.subscriberCount) || 0 };
  },
  async listVideos(externalChannelId, opts) {
    const dtos = await withTimeout(ytFetchVideos(externalChannelId, opts?.max ?? 50));
    return dtos.map(mapYouTubeVideo);
  },
  async fetchDonationEvents(externalChannelId, cursor) {
    const all = remote().chats[externalChannelId] ?? [];
    const from = cursor ? Number(cursor) || 0 : 0;
    const events = all.slice(from).map(
      (d): ExternalDonationEvent => ({
        platform: "YOUTUBE",
        externalEventId: d.id,
        donorName: d.authorDetails.displayName.slice(0, 40),
        message: d.snippet.superChatDetails.userComment.slice(0, 200),
        amount: { value: Number(d.snippet.superChatDetails.amountMicros) / 1_000_000, currency: d.snippet.superChatDetails.currency },
        kindLabel: "YouTube 슈퍼챗",
        occurredAt: d.snippet.publishedAt
      })
    );
    return { events, cursor: String(all.length) };
  }
};

/** FlexTV / SOOP: video lists and donation events are not confirmed for these APIs (TBD), so neither is declared. */
const unsupported = (platform: Platform): PlatformAdapter => ({
  platform,
  capabilities: ["LIVE_STATUS"],
  async getChannel() {
    throw new PlatformError("UNSUPPORTED", "unsupported");
  },
  async listVideos() {
    throw new PlatformError("UNSUPPORTED", "unsupported");
  },
  async fetchDonationEvents() {
    throw new PlatformError("UNSUPPORTED", "unsupported");
  }
});

export const ADAPTERS: Record<Platform, PlatformAdapter> = { YOUTUBE: YouTubeAdapter, FLEXTV: unsupported("FLEXTV"), SOOP: unsupported("SOOP") };
