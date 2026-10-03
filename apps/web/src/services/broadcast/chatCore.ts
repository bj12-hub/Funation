import { randomBytes } from "node:crypto";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { ADAPTERS, BROADCAST_PLATFORMS } from "@/services/platforms/adapters";
import { PLATFORM_ERROR_LABEL, PlatformError, type ExternalChatMessage, type PlatformErrorCode } from "@/services/platforms/platformTypes";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import { broadcastChannel, broadcastChannelId } from "./channelsCore";
import {
  BAN_DURATIONS,
  CHAT_TEXT_MAX,
  managerChatPath,
  type ChatActionResult,
  type ChatOverlayLine,
  type ChatPlatformState,
  type ChatSendOutcome,
  type ChatSendResult,
  type ManagerLink,
  type ManagerPermission,
  type ModerationAction,
  type ModerationEntry,
  type UnifiedChatMessage
} from "./chatTypes";

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
  /** 매니저 채팅창 링크 (mock keeps the token as is; the real backend stores only a hash). */
  managerLinks?: StoredManagerLink[];
};

export type StoredManagerLink = { id: string; name: string; token: string; permissions: ManagerPermission[]; createdAt: string; lastUsedAt: string | null; requestId: string };

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

function log(action: ModerationAction, m: UnifiedChatMessage, detail: string, by: string | null) {
  const s = chatStore();
  s.log.unshift({ at: new Date().toISOString(), action, platform: m.platform, target: m.author.displayName, detail, by });
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

export function chatView(limit = 200) {
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
export function setHidden(m: UnifiedChatMessage, hidden: boolean, by: string | null = null) {
  if (hidden && m.hidden) return;
  if (!hidden && (m.hidden === "DELETED" || m.hidden === "BANNED")) throw new PlatformError("UNSUPPORTED", "removed on platform");
  m.hidden = hidden ? "MANUAL" : null;
  log(hidden ? "HIDE" : "UNHIDE", m, m.text.slice(0, 40), by);
}

export async function deleteOnPlatform(m: UnifiedChatMessage, by: string | null = null) {
  if (!can(m.platform, "CHAT_MODERATE")) throw new PlatformError("UNSUPPORTED", "unsupported");
  const channel = broadcastChannelId(m.platform);
  if (!channel) throw new PlatformError("UNAUTHORIZED", "not connected");
  if (m.hidden === "DELETED") return;
  await ADAPTERS[m.platform].deleteChatMessage(channel, m.externalMessageId);
  m.hidden = "DELETED";
  log("DELETE", m, m.text.slice(0, 40), by);
}

/** Bans the author on that platform and hides everything they wrote there. */
export async function banOnPlatform(m: UnifiedChatMessage, durationSec: number | null, durationLabel: string, by: string | null = null) {
  if (!can(m.platform, "CHAT_MODERATE")) throw new PlatformError("UNSUPPORTED", "unsupported");
  const channel = broadcastChannelId(m.platform);
  if (!channel) throw new PlatformError("UNAUTHORIZED", "not connected");
  if (m.author.roles.includes("OWNER")) throw new PlatformError("UNSUPPORTED", "cannot ban the owner");
  await ADAPTERS[m.platform].banChatUser(channel, m.author.platformUserId, durationSec);
  for (const x of chatStore().messages) if (x.platform === m.platform && x.author.platformUserId === m.author.platformUserId && x.hidden !== "DELETED") x.hidden = "BANNED";
  log("BAN", m, `${PLATFORM_LABEL[m.platform]} ${durationLabel}`, by);
}

// ── Moderation / send actions shared by the creator (session) and manager links (token) ─────────────

const obj = (v: unknown) => (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
const isRequestId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);
const failure = (e: unknown): ChatActionResult => ({ status: "FAILED", message: e instanceof PlatformError ? PLATFORM_ERROR_LABEL[e.code] : "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });

/** 숨김 · 다시 보이기 on our overlay. `by` = manager name (null = creator). */
export function hideAction(input: unknown, by: string | null): ChatActionResult {
  const v = obj(input);
  const m = typeof v.id === "string" ? findMessage(v.id) : null;
  if (!m || typeof v.hidden !== "boolean") return { status: "INVALID", message: "메시지를 찾을 수 없어요." };
  try {
    setHidden(m, v.hidden, by);
  } catch {
    return { status: "INVALID", message: "플랫폼에서 삭제 · 차단된 메시지는 다시 보이게 할 수 없어요." };
  }
  return { status: "OK" };
}

export async function deleteAction(input: unknown, by: string | null): Promise<ChatActionResult> {
  const v = obj(input);
  const m = typeof v.id === "string" ? findMessage(v.id) : null;
  if (!m) return { status: "INVALID", message: "메시지를 찾을 수 없어요." };
  try {
    await deleteOnPlatform(m, by);
  } catch (e) {
    return failure(e);
  }
  return { status: "OK" };
}

export async function banAction(input: unknown, by: string | null): Promise<ChatActionResult> {
  const v = obj(input);
  const m = typeof v.id === "string" ? findMessage(v.id) : null;
  const duration = BAN_DURATIONS.find((d) => d.sec === v.durationSec);
  if (!m || !duration) return { status: "INVALID", message: "잘못된 요청입니다." };
  if (m.author.roles.includes("OWNER")) return { status: "INVALID", message: "스트리머 본인은 차단할 수 없어요." };
  try {
    await banOnPlatform(m, duration.sec, duration.label, by);
  } catch (e) {
    return failure(e);
  }
  return { status: "OK" };
}

/** 통합 입력: one message to the chosen platforms (sent as the channel). Partial failure is reported per platform. */
export async function sendAction(input: unknown): Promise<ChatSendResult> {
  const v = obj(input);
  if (!isRequestId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const text = typeof v.text === "string" ? v.text.trim() : "";
  if (!text || text.length > CHAT_TEXT_MAX) return { status: "INVALID", message: `메시지를 1~${CHAT_TEXT_MAX}자로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => text.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const platforms = Array.isArray(v.platforms) ? [...new Set(v.platforms.filter((p): p is Platform => BROADCAST_PLATFORMS.includes(p as Platform)))] : [];
  if (platforms.length === 0) return { status: "INVALID", message: "보낼 플랫폼을 골라 주세요." };
  const existing = chatStore().sends[v.requestId];
  if (existing && existing.text !== text) return { status: "INVALID", message: "잘못된 요청입니다." };
  return { status: "OK", results: await sendChat(v.requestId, text, existing?.platforms ?? platforms) };
}

// ── 매니저 채팅창 링크 ──────────────────────────────────────────────────────────

export const managerLinks = () => (chatStore().managerLinks ??= []);
/** 192-bit random token, URL-safe. */
export const newManagerToken = () => randomBytes(24).toString("base64url");
export const isManagerToken = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{32}$/.test(v);
export const managerLinkByToken = (token: unknown) => (isManagerToken(token) ? (managerLinks().find((l) => l.token === token) ?? null) : null);

export function managerLinksView(): ManagerLink[] {
  return managerLinks().map((l) => ({ id: l.id, name: l.name, path: managerChatPath(l.token), permissions: [...l.permissions], createdAt: l.createdAt, lastUsedAt: l.lastUsedAt }));
}
