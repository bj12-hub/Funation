import type { Platform } from "@/types/platform";
import {
  channelRemote,
  consumeFailure,
  mockViewerChat,
  type ChzzkChatDto,
  type FlexChatDto,
  type SoopChatDto,
  type YtChatDto
} from "./mockBroadcastRemote";
import { PlatformError, type ChannelProfile, type ChannelVideo, type ChatAuthorRole, type ExternalChatMessage, type ExternalDonationEvent, type PlatformCapability } from "./platformTypes";

/**
 * PlatformAdapter (CLAUDE.md §9) — server-only. Each platform declares what it can do; callers check
 * `capabilities` instead of assuming every platform has the same API. The mock "remote" calls below
 * stand in for the real APIs (YouTube Data API via OAuth — TBD) and return platform-shaped DTOs that
 * are mapped here, so the rest of the app only sees core types.
 */
export interface PlatformAdapter {
  platform: Platform;
  capabilities: readonly PlatformCapability[];
  /**
   * Declared for the mock but not yet confirmed against the platform's real API (TBD). Screens show
   * these as "확인 중" so nobody mistakes the mock for a verified integration.
   */
  unverified: readonly PlatformCapability[];
  getChannel(handle: string): Promise<ChannelProfile>;
  listVideos(externalChannelId: string, opts?: { max?: number }): Promise<ChannelVideo[]>;
  /** Events after `cursor` (opaque), oldest first. Only for adapters with DONATION_EVENTS. */
  fetchDonationEvents(externalChannelId: string, cursor: string | null): Promise<{ events: ExternalDonationEvent[]; cursor: string | null }>;
  /** Live chat after `cursor`, oldest first. CHAT_EVENTS only. */
  fetchChatMessages(externalChannelId: string, cursor: string | null): Promise<{ messages: ExternalChatMessage[]; cursor: string | null }>;
  /** Posts as the channel owner. CHAT_SEND only. Returns the platform's message id. */
  sendChatMessage(externalChannelId: string, text: string): Promise<{ externalMessageId: string }>;
  /** CHAT_MODERATE only. */
  deleteChatMessage(externalChannelId: string, externalMessageId: string): Promise<void>;
  /** `durationSec` null = permanent. CHAT_MODERATE only. */
  banChatUser(externalChannelId: string, platformUserId: string, durationSec: number | null): Promise<void>;
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
// ── Chat helpers ─────────────────────────────────────────────────────────────

const MAX_TEXT = 200;
const clip = (s: string, n: number) => s.slice(0, n);
/** Index cursor over an append-only remote list (the real APIs use page tokens / socket offsets). */
const sliceFrom = <T>(list: T[], cursor: string | null) => ({ items: list.slice(cursor ? Number(cursor) || 0 : 0), cursor: String(list.length) });
const unsupportedCall = async (): Promise<never> => {
  throw new PlatformError("UNSUPPORTED", "unsupported");
};

/** Mock channel lookup for platforms whose profile API is unconfirmed (TBD): the handle becomes the id. */
function mockChannel(platform: Platform, prefix: string, handle: string): ChannelProfile {
  simulateFailure(handle);
  const clean = handle.replace(/^@/, "").trim();
  return { platform, externalChannelId: `${prefix}${hash(`${platform}:${clean}`).toString(36)}`, title: `${clean} 채널`, handle: clean, subscriberCount: 0 };
}

/** The streamer's own message, echoed back into the chat feed like the platforms do. */
function echoOwner(platform: Platform, channelId: string, text: string) {
  return mockViewerChat(platform, channelId, { userId: `owner:${channelId}`, nick: "내 방송 계정", text, role: "OWNER" });
}

// ── YouTube ──────────────────────────────────────────────────────────────────

function ytRoles(a: YtChatDto["authorDetails"]): ChatAuthorRole[] {
  const roles: ChatAuthorRole[] = [];
  if (a.isChatOwner) roles.push("OWNER");
  if (a.isChatModerator) roles.push("MODERATOR");
  if (a.isChatSponsor) roles.push("MEMBER");
  return roles;
}

export const mapYouTubeChat = (d: YtChatDto): ExternalChatMessage => ({
  platform: "YOUTUBE",
  externalMessageId: d.id,
  author: { platformUserId: d.authorDetails.channelId, displayName: clip(d.authorDetails.displayName, 40), roles: ytRoles(d.authorDetails) },
  text: clip(d.snippet.displayMessage, MAX_TEXT),
  sentAt: d.snippet.publishedAt
});

/** YouTube Data API: liveChatMessages.list / insert / delete and liveChatBans.insert (OAuth — TBD). */
export const YouTubeAdapter: PlatformAdapter = {
  platform: "YOUTUBE",
  capabilities: ["CHANNEL_PROFILE", "VIDEO_LIST", "LIVE_STATUS", "DONATION_EVENTS", "CHAT_EVENTS", "CHAT_SEND", "CHAT_MODERATE"],
  unverified: [],
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
  },
  async fetchChatMessages(channelId, cursor) {
    consumeFailure("YOUTUBE");
    const r = channelRemote(channelId);
    const { items, cursor: next } = sliceFrom(r.yt, cursor);
    return { messages: items.filter((d) => !r.deleted[d.id]).map(mapYouTubeChat), cursor: next };
  },
  async sendChatMessage(channelId, text) {
    consumeFailure("YOUTUBE");
    return { externalMessageId: echoOwner("YOUTUBE", channelId, clip(text, MAX_TEXT)) };
  },
  async deleteChatMessage(channelId, id) {
    consumeFailure("YOUTUBE");
    channelRemote(channelId).deleted[id] = true;
  },
  async banChatUser(channelId, userId, durationSec) {
    consumeFailure("YOUTUBE");
    channelRemote(channelId).bans[userId] = { untilMs: durationSec === null ? null : Date.now() + durationSec * 1000 };
  }
};

// ── CHZZK (치지직) — Open API scope unconfirmed (TBD) ─────────────────────────

function chzzkRoles(p: ChzzkChatDto["profile"]): ChatAuthorRole[] {
  const roles: ChatAuthorRole[] = [];
  if (p.userRoleCode === "streamer") roles.push("OWNER");
  if (p.userRoleCode === "streaming_chat_manager") roles.push("MODERATOR");
  if (p.subscription) roles.push("MEMBER");
  return roles;
}

export const mapChzzkChat = (d: ChzzkChatDto): ExternalChatMessage => ({
  platform: "CHZZK",
  externalMessageId: d.messageId,
  author: { platformUserId: d.senderChannelId, displayName: clip(d.profile.nickname, 40), roles: chzzkRoles(d.profile) },
  text: clip(d.content, MAX_TEXT),
  sentAt: new Date(d.messageTime).toISOString()
});

export const ChzzkAdapter: PlatformAdapter = {
  platform: "CHZZK",
  capabilities: ["CHANNEL_PROFILE", "LIVE_STATUS", "DONATION_EVENTS", "CHAT_EVENTS", "CHAT_SEND"],
  unverified: ["CHANNEL_PROFILE", "DONATION_EVENTS", "CHAT_EVENTS", "CHAT_SEND"],
  async getChannel(handle) {
    return mockChannel("CHZZK", "chz_", handle);
  },
  listVideos: unsupportedCall,
  async fetchDonationEvents(channelId, cursor) {
    const { items, cursor: next } = sliceFrom(channelRemote(channelId).chzzkDonations, cursor);
    return {
      events: items.map((d) => ({
        platform: "CHZZK" as const,
        externalEventId: d.donationId,
        donorName: clip(d.donatorNickname, 40),
        message: clip(d.donationText, 200),
        amount: { value: Number(d.payAmount) || 0, currency: "치즈" },
        kindLabel: "치지직 치즈",
        occurredAt: new Date(d.donatedAt).toISOString()
      })),
      cursor: next
    };
  },
  async fetchChatMessages(channelId, cursor) {
    consumeFailure("CHZZK");
    const { items, cursor: next } = sliceFrom(channelRemote(channelId).chzzk, cursor);
    return { messages: items.map(mapChzzkChat), cursor: next };
  },
  async sendChatMessage(channelId, text) {
    consumeFailure("CHZZK");
    return { externalMessageId: echoOwner("CHZZK", channelId, clip(text, MAX_TEXT)) };
  },
  deleteChatMessage: unsupportedCall,
  banChatUser: unsupportedCall
};

// ── SOOP — chat / 별풍선 APIs unconfirmed (TBD) ───────────────────────────────

const SOOP_ROLE: Record<SoopChatDto["userFlag"], ChatAuthorRole[]> = { bj: ["OWNER"], manager: ["MODERATOR"], fan: ["MEMBER"], normal: [] };

export const mapSoopChat = (d: SoopChatDto): ExternalChatMessage => ({
  platform: "SOOP",
  externalMessageId: `soop-${d.chatNo}`,
  author: { platformUserId: d.userId, displayName: clip(d.userNick, 40), roles: SOOP_ROLE[d.userFlag] },
  text: clip(d.message, MAX_TEXT),
  sentAt: new Date(d.ts).toISOString()
});

export const SoopAdapter: PlatformAdapter = {
  platform: "SOOP",
  capabilities: ["CHANNEL_PROFILE", "LIVE_STATUS", "DONATION_EVENTS", "CHAT_EVENTS"],
  unverified: ["CHANNEL_PROFILE", "DONATION_EVENTS", "CHAT_EVENTS"],
  async getChannel(handle) {
    return mockChannel("SOOP", "soop_", handle);
  },
  listVideos: unsupportedCall,
  async fetchDonationEvents(channelId, cursor) {
    const { items, cursor: next } = sliceFrom(channelRemote(channelId).soopBalloons, cursor);
    return {
      events: items.map((d) => ({
        platform: "SOOP" as const,
        externalEventId: `balloon-${d.balloonNo}`,
        donorName: clip(d.userNick, 40),
        message: clip(d.message, 200),
        amount: { value: d.count, currency: "별풍선" },
        kindLabel: "SOOP 별풍선",
        occurredAt: new Date(d.ts).toISOString()
      })),
      cursor: next
    };
  },
  async fetchChatMessages(channelId, cursor) {
    consumeFailure("SOOP");
    const { items, cursor: next } = sliceFrom(channelRemote(channelId).soop, cursor);
    return { messages: items.map(mapSoopChat), cursor: next };
  },
  sendChatMessage: unsupportedCall,
  deleteChatMessage: unsupportedCall,
  banChatUser: unsupportedCall
};

// ── FlexTV — chat / donation APIs unconfirmed (TBD) ──────────────────────────

const FLEX_ROLE: Record<FlexChatDto["user"]["grade"], ChatAuthorRole[]> = { OWNER: ["OWNER"], MANAGER: ["MODERATOR"], VIP: ["MEMBER"], NORMAL: [] };

export const mapFlexChat = (d: FlexChatDto): ExternalChatMessage => ({
  platform: "FLEXTV",
  externalMessageId: d.id,
  author: { platformUserId: d.user.id, displayName: clip(d.user.nick, 40), roles: FLEX_ROLE[d.user.grade] },
  text: clip(d.text, MAX_TEXT),
  sentAt: d.createdAt
});

export const FlexTvAdapter: PlatformAdapter = {
  platform: "FLEXTV",
  capabilities: ["CHANNEL_PROFILE", "LIVE_STATUS", "DONATION_EVENTS", "CHAT_EVENTS"],
  unverified: ["CHANNEL_PROFILE", "DONATION_EVENTS", "CHAT_EVENTS"],
  async getChannel(handle) {
    return mockChannel("FLEXTV", "flex_", handle);
  },
  listVideos: unsupportedCall,
  async fetchDonationEvents(channelId, cursor) {
    const { items, cursor: next } = sliceFrom(channelRemote(channelId).flexDonations, cursor);
    return {
      events: items.map((d) => ({
        platform: "FLEXTV" as const,
        externalEventId: d.id,
        donorName: clip(d.user.nick, 40),
        message: clip(d.text, 200),
        // FlexTV's donation unit is unconfirmed (TBD); shown as delivered, never converted.
        amount: { value: d.amount, currency: "FlexTV 후원" },
        kindLabel: "FlexTV 후원",
        occurredAt: d.createdAt
      })),
      cursor: next
    };
  },
  async fetchChatMessages(channelId, cursor) {
    consumeFailure("FLEXTV");
    const { items, cursor: next } = sliceFrom(channelRemote(channelId).flex, cursor);
    return { messages: items.map(mapFlexChat), cursor: next };
  },
  sendChatMessage: unsupportedCall,
  deleteChatMessage: unsupportedCall,
  banChatUser: unsupportedCall
};

export const ADAPTERS: Record<Platform, PlatformAdapter> = { YOUTUBE: YouTubeAdapter, CHZZK: ChzzkAdapter, SOOP: SoopAdapter, FLEXTV: FlexTvAdapter };

/** Integration order on screens. */
export const BROADCAST_PLATFORMS: Platform[] = ["YOUTUBE", "CHZZK", "SOOP", "FLEXTV"];
