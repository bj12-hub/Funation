import type { Platform } from "@/types/platform";
import {
  channelRemote,
  consumeFailure,
  mockViewerChat,
  type ChzzkChatDto,
  type ChzzkDonationDto,
  type FlexChatDto,
  type FlexDonationDto,
  type SoopBalloonDto,
  type SoopChatDto,
  type YtChatDto
} from "./mockBroadcastRemote";
import type { AmountUnit, UnitCode } from "@/types/donationUnit";
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
  /**
   * Events after `cursor` (opaque), oldest first. Only for adapters with DONATION_EVENTS. Malformed items
   * (missing id, bad time or amount) are dropped and counted in `skipped`; the cursor still moves past them.
   */
  fetchDonationEvents(externalChannelId: string, cursor: string | null): Promise<{ events: ExternalDonationEvent[]; cursor: string | null; skipped: number }>;
  /** Live chat after `cursor`, oldest first. CHAT_EVENTS only. Malformed items are dropped and counted. */
  fetchChatMessages(externalChannelId: string, cursor: string | null): Promise<{ messages: ExternalChatMessage[]; cursor: string | null; skipped: number }>;
  /** Posts as the channel owner. CHAT_SEND only. Returns the platform's message id. */
  sendChatMessage(externalChannelId: string, text: string): Promise<{ externalMessageId: string }>;
  /** CHAT_MODERATE only. */
  deleteChatMessage(externalChannelId: string, externalMessageId: string): Promise<void>;
  /** `durationSec` null = permanent. CHAT_MODERATE only. */
  banChatUser(externalChannelId: string, platformUserId: string, durationSec: number | null): Promise<void>;
}

const TIMEOUT_MS = 5_000;

/**
 * Bounded wait for a remote call (rejects with PlatformError TIMEOUT); the backend would also retry
 * idempotent reads with backoff. Callers outside the adapters use it too, so one slow platform never
 * holds up the others.
 */
export async function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
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
// ── Mapping helpers ──────────────────────────────────────────────────────────
// Platform payloads are untrusted: every DTO is validated here, and one bad item is dropped and counted
// instead of throwing (a throw would stop the whole batch and keep the cursor from moving past it).

const MAX_TEXT = 200;
/** Sanity bound for one donation in the platform's own unit (the simulator's limit) — not a business rule. */
const AMOUNT_MAX = 10_000_000;
const clip = (s: string, n: number) => s.slice(0, n);
const str = (v: unknown) => (typeof v === "string" ? v : null);
const idOf = (v: unknown) => (typeof v === "string" && v.trim() ? v : typeof v === "number" && Number.isSafeInteger(v) ? String(v) : null);

/** ISO time from a platform timestamp (epoch ms or date string), or null when it is not a real time. */
export function toIsoTime(v: unknown): string | null {
  if ((typeof v !== "number" && typeof v !== "string") || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * A donation amount in the platform's own unit, or null when it is not a positive number up to `max`
 * (or not whole where the unit is). Numbers and plain decimal strings only: "1,000", "", NaN and
 * negatives are rejected rather than guessed.
 */
export function toAmount(v: unknown, opts: { integer: boolean; max?: number }): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+(\.\d+)?$/.test(v) ? Number(v) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0 || n > (opts.max ?? AMOUNT_MAX)) return null;
  if (opts.integer && !Number.isInteger(n)) return null;
  return n;
}

/** Maps each DTO, dropping (and counting) the ones that fail validation or have the wrong shape. */
function mapValid<D, T>(items: D[], map: (d: D) => T | null): { items: T[]; skipped: number } {
  const out: T[] = [];
  let skipped = 0;
  for (const d of items) {
    let mapped: T | null;
    try {
      mapped = map(d);
    } catch {
      mapped = null;
    }
    if (mapped) out.push(mapped);
    else skipped++;
  }
  return { items: out, skipped };
}

/** Badge → roles; an unknown or new badge maps to no role instead of breaking the message. */
const rolesOf = <K extends string>(table: Record<K, ChatAuthorRole[]>, key: unknown): ChatAuthorRole[] =>
  typeof key === "string" && Object.hasOwn(table, key) ? [...table[key as K]] : [];

/** A chat message after the shared checks, or null. */
function chatMessage(platform: Platform, id: unknown, userId: unknown, nick: unknown, text: unknown, time: unknown, roles: ChatAuthorRole[]): ExternalChatMessage | null {
  const externalMessageId = idOf(id);
  const platformUserId = idOf(userId);
  const displayName = str(nick);
  const body = str(text);
  const sentAt = toIsoTime(time);
  if (!externalMessageId || !platformUserId || displayName === null || body === null || !sentAt) return null;
  return { platform, externalMessageId, author: { platformUserId, displayName: clip(displayName, 40), roles }, text: clip(body, MAX_TEXT), sentAt };
}

/**
 * A donation event after the shared checks, or null. `unit` is already the stable code (types/donationUnit): the
 * platform's own unit name never leaves the adapter.
 */
function donationEvent(platform: Platform, id: unknown, nick: unknown, message: unknown, time: unknown, value: number | null, unit: AmountUnit | null, kindLabel: string): ExternalDonationEvent | null {
  const externalEventId = idOf(id);
  const donorName = str(nick);
  const occurredAt = toIsoTime(time);
  if (!externalEventId || donorName === null || !occurredAt || value === null || !unit) return null;
  return { platform, externalEventId, donorName: clip(donorName, 40), message: clip(str(message) ?? "", 200), amount: { value, unit }, kindLabel, occurredAt };
}
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

export const mapYouTubeChat = (d: YtChatDto): ExternalChatMessage | null =>
  chatMessage("YOUTUBE", d.id, d.authorDetails.channelId, d.authorDetails.displayName, d.snippet.displayMessage, d.snippet.publishedAt, ytRoles(d.authorDetails));

/**
 * Super Chat → donation event. `amountMicros` is a whole number of millionths of `currency` (ISO 4217). An ISO code is
 * its own unit code: KRW · USD · JPY are 자동엑셀 units, any other currency is shown only.
 */
export function mapYouTubeSuperChat(d: YtSuperChatDto): ExternalDonationEvent | null {
  const details = d.snippet.superChatDetails;
  const micros = toAmount(details.amountMicros, { integer: true, max: AMOUNT_MAX * 1_000_000 });
  const unit = typeof details.currency === "string" && /^[A-Z]{3}$/.test(details.currency) ? details.currency : null;
  return donationEvent("YOUTUBE", d.id, d.authorDetails.displayName, details.userComment, d.snippet.publishedAt, micros === null ? null : micros / 1_000_000, unit, "YouTube 슈퍼챗");
}

async function ytFetchSuperChats(channelId: string): Promise<YtSuperChatDto[]> {
  return [...(remote().chats[channelId] ?? [])];
}

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
    const { items, cursor: next } = sliceFrom(await withTimeout(ytFetchSuperChats(externalChannelId)), cursor);
    const { items: events, skipped } = mapValid(items, mapYouTubeSuperChat);
    return { events, cursor: next, skipped };
  },
  async fetchChatMessages(channelId, cursor) {
    consumeFailure("YOUTUBE");
    const r = channelRemote(channelId);
    const { items, cursor: next } = sliceFrom(r.yt, cursor);
    const { items: messages, skipped } = mapValid(
      items.filter((d) => !r.deleted[d.id]),
      mapYouTubeChat
    );
    return { messages, cursor: next, skipped };
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

export const mapChzzkChat = (d: ChzzkChatDto): ExternalChatMessage | null =>
  chatMessage("CHZZK", d.messageId, d.senderChannelId, d.profile.nickname, d.content, d.messageTime, chzzkRoles(d.profile));

export const mapChzzkDonation = (d: ChzzkDonationDto): ExternalDonationEvent | null =>
  donationEvent("CHZZK", d.donationId, d.donatorNickname, d.donationText, d.donatedAt, toAmount(d.payAmount, { integer: true }), "CHZZK_CHEESE" satisfies UnitCode, "치지직 치즈");

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
    const { items: events, skipped } = mapValid(items, mapChzzkDonation);
    return { events, cursor: next, skipped };
  },
  async fetchChatMessages(channelId, cursor) {
    consumeFailure("CHZZK");
    const { items, cursor: next } = sliceFrom(channelRemote(channelId).chzzk, cursor);
    const { items: messages, skipped } = mapValid(items, mapChzzkChat);
    return { messages, cursor: next, skipped };
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

/** SOOP numbers chats and balloons; only a whole number makes a usable id. */
const soopNo = (prefix: string, n: unknown) => (typeof n === "number" && Number.isSafeInteger(n) ? `${prefix}-${n}` : null);

export const mapSoopChat = (d: SoopChatDto): ExternalChatMessage | null =>
  chatMessage("SOOP", soopNo("soop", d.chatNo), d.userId, d.userNick, d.message, d.ts, rolesOf(SOOP_ROLE, d.userFlag));

export const mapSoopBalloon = (d: SoopBalloonDto): ExternalDonationEvent | null =>
  donationEvent("SOOP", soopNo("balloon", d.balloonNo), d.userNick, d.message, d.ts, toAmount(d.count, { integer: true }), "SOOP_BALLOON" satisfies UnitCode, "SOOP 별풍선");

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
    const { items: events, skipped } = mapValid(items, mapSoopBalloon);
    return { events, cursor: next, skipped };
  },
  async fetchChatMessages(channelId, cursor) {
    consumeFailure("SOOP");
    const { items, cursor: next } = sliceFrom(channelRemote(channelId).soop, cursor);
    const { items: messages, skipped } = mapValid(items, mapSoopChat);
    return { messages, cursor: next, skipped };
  },
  sendChatMessage: unsupportedCall,
  deleteChatMessage: unsupportedCall,
  banChatUser: unsupportedCall
};

// ── FlexTV — chat / donation APIs unconfirmed (TBD) ──────────────────────────

const FLEX_ROLE: Record<FlexChatDto["user"]["grade"], ChatAuthorRole[]> = { OWNER: ["OWNER"], MANAGER: ["MODERATOR"], VIP: ["MEMBER"], NORMAL: [] };

export const mapFlexChat = (d: FlexChatDto): ExternalChatMessage | null =>
  chatMessage("FLEXTV", d.id, d.user.id, d.user.nick, d.text, d.createdAt, rolesOf(FLEX_ROLE, d.user.grade));

// FlexTV's donation unit is unconfirmed (TBD): shown as delivered under a placeholder code (FLEXTV_UNIT), converted
// only with a value the creator enters, and fractions are not rejected.
export const mapFlexDonation = (d: FlexDonationDto): ExternalDonationEvent | null =>
  donationEvent("FLEXTV", d.id, d.user.nick, d.text, d.createdAt, toAmount(d.amount, { integer: false }), "FLEXTV_UNIT" satisfies UnitCode, "FlexTV 후원");

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
    const { items: events, skipped } = mapValid(items, mapFlexDonation);
    return { events, cursor: next, skipped };
  },
  async fetchChatMessages(channelId, cursor) {
    consumeFailure("FLEXTV");
    const { items, cursor: next } = sliceFrom(channelRemote(channelId).flex, cursor);
    const { items: messages, skipped } = mapValid(items, mapFlexChat);
    return { messages, cursor: next, skipped };
  },
  sendChatMessage: unsupportedCall,
  deleteChatMessage: unsupportedCall,
  banChatUser: unsupportedCall
};

export const ADAPTERS: Record<Platform, PlatformAdapter> = { YOUTUBE: YouTubeAdapter, CHZZK: ChzzkAdapter, SOOP: SoopAdapter, FLEXTV: FlexTvAdapter };

/** Integration order on screens. */
export const BROADCAST_PLATFORMS: Platform[] = ["YOUTUBE", "CHZZK", "SOOP", "FLEXTV"];
