import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { ADAPTERS, BROADCAST_PLATFORMS } from "@/services/platforms/adapters";
import { PlatformError, type ExternalChatMessage, type PlatformErrorCode } from "@/services/platforms/platformTypes";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import { broadcastChannel, broadcastChannelId } from "./channelsCore";
import type { ChatOverlayLine, ChatPlatformState, ChatSendOutcome, ModerationAction, ModerationEntry, UnifiedChatMessage, UnifiedChatView } from "./chatTypes";

/**
 * Server-only 통합 채팅 core (not a "use server" module): merges every connected platform's chat into one
 * feed, dedupes re-delivered messages by `${platform}:${externalMessageId}`, and routes send / delete /
 * ban to the platform adapters that declare the capability. Reading happens on demand (studio and overlay
 * polls); the real backend keeps a live connection per platform and pushes (transport TBD).
 * TBD: per-creator feeds, persistence, rate limits per platform, moderator accounts.
 */

const FEED_MAX = 500;
const SEEN_MAX = 5_000;
const LOG_MAX = 100;
const INGEST_MIN_GAP_MS = 400;

type PlatformStatus = { lastSyncAt: string | null; lastError: PlatformErrorCode | null; received: number; duplicates: number };
type SendRecord = { text: string; platforms: Platform[]; results: Partial<Record<Platform, ChatSendOutcome>> };

export type ChatStore = {
  messages: UnifiedChatMessage[];
  seen: Record<string, true>;
  seenOrder: string[];
  seq: number;
  cursors: Partial<Record<Platform, string | null>>;
  status: Record<Platform, PlatformStatus>;
  sends: Record<string, SendRecord>;
  log: ModerationEntry[];
  requests: Record<string, true>;
  lastIngestAt: number;
};

const g = globalThis as typeof globalThis & { __funationMockUnifiedChatV1?: ChatStore };
export const chatStore = (): ChatStore =>
  (g.__funationMockUnifiedChatV1 ??= {
    messages: [],
    seen: {},
    seenOrder: [],
    seq: 0,
    cursors: {},
    status: Object.fromEntries(BROADCAST_PLATFORMS.map((p) => [p, { lastSyncAt: null, lastError: null, received: 0, duplicates: 0 }])) as Record<Platform, PlatformStatus>,
    sends: {},
    log: [],
    requests: {},
    lastIngestAt: 0
  });

const can = (p: Platform, c: "CHAT_EVENTS" | "CHAT_SEND" | "CHAT_MODERATE") => ADAPTERS[p].capabilities.includes(c);
const codeOf = (e: unknown): PlatformErrorCode => (e instanceof PlatformError ? e.code : "UNAVAILABLE");
const filtered = (text: string) => MOCK_FORBIDDEN_WORDS.some((w) => text.toLowerCase().includes(w));

function remember(s: ChatStore, id: string) {
  s.seen[id] = true;
  s.seenOrder.push(id);
  while (s.seenOrder.length > SEEN_MAX) delete s.seen[s.seenOrder.shift()!];
}

function push(s: ChatStore, m: ExternalChatMessage, fromStudio: boolean) {
  const id = `${m.platform}:${m.externalMessageId}`;
  if (s.seen[id]) {
    s.status[m.platform].duplicates++;
    return;
  }
  remember(s, id);
  s.status[m.platform].received++;
  s.messages.push({ id, seq: ++s.seq, ...m, author: { ...m.author, roles: [...m.author.roles] }, receivedAt: new Date().toISOString(), hidden: filtered(m.text) ? "FILTER" : null, fromStudio });
  if (s.messages.length > FEED_MAX) s.messages.splice(0, s.messages.length - FEED_MAX);
}

/** New messages from every connected, readable platform. One platform failing never blocks the others. */
export async function ingestChat(opts: { force?: boolean } = {}) {
  const s = chatStore();
  if (!opts.force && Date.now() - s.lastIngestAt < INGEST_MIN_GAP_MS) return;
  s.lastIngestAt = Date.now();
  await Promise.all(
    BROADCAST_PLATFORMS.map(async (p) => {
      const channel = broadcastChannelId(p);
      if (!channel || !can(p, "CHAT_EVENTS")) return;
      try {
        const { messages, cursor } = await ADAPTERS[p].fetchChatMessages(channel, s.cursors[p] ?? null);
        s.cursors[p] = cursor;
        for (const m of messages) push(s, m, false);
        s.status[p].lastSyncAt = new Date().toISOString();
        s.status[p].lastError = null;
      } catch (e) {
        s.status[p].lastError = codeOf(e);
      }
    })
  );
  s.messages.sort((a, b) => a.seq - b.seq);
}

/** A newly connected channel starts from "now": the backlog is not replayed into the feed. */
export async function startChatFrom(p: Platform) {
  const s = chatStore();
  const channel = broadcastChannelId(p);
  delete s.cursors[p];
  if (!channel || !can(p, "CHAT_EVENTS")) return;
  try {
    s.cursors[p] = (await ADAPTERS[p].fetchChatMessages(channel, null)).cursor;
  } catch (e) {
    s.status[p].lastError = codeOf(e);
  }
}

/** Mock only: a reconnect re-delivers everything (the dedupe keeps the feed clean). */
export function mockChatReconnect(p: Platform) {
  chatStore().cursors[p] = null;
}

function log(action: ModerationAction, m: UnifiedChatMessage, detail: string) {
  const s = chatStore();
  s.log.unshift({ at: new Date().toISOString(), action, platform: m.platform, target: m.author.displayName, detail });
  s.log.length = Math.min(s.log.length, LOG_MAX);
}

export function platformStates(): ChatPlatformState[] {
  const s = chatStore();
  return BROADCAST_PLATFORMS.map((p) => {
    const a = ADAPTERS[p];
    const channel = broadcastChannel(p);
    return {
      platform: p,
      connected: !!channel,
      channel: channel ? { handle: channel.handle, title: channel.title } : null,
      canRead: can(p, "CHAT_EVENTS"),
      canSend: can(p, "CHAT_SEND"),
      canModerate: can(p, "CHAT_MODERATE"),
      unverified: a.unverified.some((c) => c.startsWith("CHAT_")),
      ...s.status[p]
    };
  });
}

export function chatView(limit = 200): UnifiedChatView {
  const s = chatStore();
  return structuredClone({ platforms: platformStates(), messages: s.messages.slice(-limit), log: s.log.slice(0, 20) });
}

/** What the overlay shows: the latest visible lines, oldest first (a snapshot, so later hides disappear). */
export function overlayLines(limit = 30): ChatOverlayLine[] {
  return chatStore()
    .messages.filter((m) => !m.hidden)
    .slice(-limit)
    .map((m) => ({ id: m.id, platform: m.platform, name: m.author.displayName, roles: [...m.author.roles], text: m.text }));
}

/**
 * Sends one message to every chosen platform. `requestId` makes retries deterministic: a repeated request
 * re-attempts only the platforms that failed and never re-posts where it already succeeded.
 */
export async function sendChat(requestId: string, text: string, platforms: Platform[]) {
  const s = chatStore();
  const record = (s.sends[requestId] ??= { text, platforms, results: {} });
  if (record.text !== text) throw new Error("requestId reused with a different message");
  for (const p of record.platforms) {
    const prev = record.results[p];
    if (prev && prev.status !== "FAILED") continue;
    const channel = broadcastChannelId(p);
    if (!channel) {
      record.results[p] = { status: "NOT_CONNECTED" };
      continue;
    }
    if (!can(p, "CHAT_SEND")) {
      record.results[p] = { status: "UNSUPPORTED" };
      continue;
    }
    try {
      const { externalMessageId } = await ADAPTERS[p].sendChatMessage(channel, text);
      record.results[p] = { status: "SENT", externalMessageId };
    } catch (e) {
      record.results[p] = { status: "FAILED", code: codeOf(e) };
    }
  }
  await ingestChat({ force: true });
  const sentIds = new Set(Object.entries(record.results).flatMap(([p, r]) => (r?.status === "SENT" ? [`${p}:${r.externalMessageId}`] : [])));
  for (const m of s.messages) if (sentIds.has(m.id)) m.fromStudio = true;
  return structuredClone(record.results);
}

export const findMessage = (id: string) => chatStore().messages.find((m) => m.id === id) ?? null;

/** Ours only — works for every platform. Platform-side deletion is `deleteOnPlatform`. */
export function setHidden(m: UnifiedChatMessage, hidden: boolean) {
  if (hidden && m.hidden) return;
  if (!hidden && (m.hidden === "DELETED" || m.hidden === "BANNED")) throw new PlatformError("UNSUPPORTED", "removed on platform");
  m.hidden = hidden ? "MANUAL" : null;
  log(hidden ? "HIDE" : "UNHIDE", m, m.text.slice(0, 40));
}

export async function deleteOnPlatform(m: UnifiedChatMessage) {
  if (!can(m.platform, "CHAT_MODERATE")) throw new PlatformError("UNSUPPORTED", "unsupported");
  const channel = broadcastChannelId(m.platform);
  if (!channel) throw new PlatformError("UNAUTHORIZED", "not connected");
  if (m.hidden === "DELETED") return;
  await ADAPTERS[m.platform].deleteChatMessage(channel, m.externalMessageId);
  m.hidden = "DELETED";
  log("DELETE", m, m.text.slice(0, 40));
}

/** Bans the author on that platform and hides everything they wrote there. */
export async function banOnPlatform(m: UnifiedChatMessage, durationSec: number | null, durationLabel: string) {
  if (!can(m.platform, "CHAT_MODERATE")) throw new PlatformError("UNSUPPORTED", "unsupported");
  const channel = broadcastChannelId(m.platform);
  if (!channel) throw new PlatformError("UNAUTHORIZED", "not connected");
  if (m.author.roles.includes("OWNER")) throw new PlatformError("UNSUPPORTED", "cannot ban the owner");
  await ADAPTERS[m.platform].banChatUser(channel, m.author.platformUserId, durationSec);
  for (const x of chatStore().messages) if (x.platform === m.platform && x.author.platformUserId === m.author.platformUserId && x.hidden !== "DELETED") x.hidden = "BANNED";
  log("BAN", m, `${PLATFORM_LABEL[m.platform]} ${durationLabel}`);
}
