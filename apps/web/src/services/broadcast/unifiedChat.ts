"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { sameSecret } from "@/lib/secret";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { ADAPTERS, BROADCAST_PLATFORMS, withTimeout } from "@/services/platforms/adapters";
import { mockViewerChat } from "@/services/platforms/mockBroadcastRemote";
import { PLATFORM_ERROR_LABEL, PlatformError } from "@/services/platforms/platformTypes";
import type { Platform } from "@/types/platform";
import { broadcastChannelId, channelsStore } from "./channelsCore";
import {
  banAction,
  chatStore,
  chatView,
  deleteAction,
  hideAction,
  ingestChat,
  managerLinksView,
  mockChatReconnect,
  onChannelChanged,
  overlayLines,
  sendAction,
  startChatFrom
} from "./chatCore";
import { CHAT_TEXT_MAX, type ChatActionResult, type ChatOverlayLine, type ChatSendResult, type UnifiedChatView } from "./chatTypes";

/**
 * 통합 채팅 Server Actions — code-first. Routes `/creator/chat` (studio) and `/overlay/chat/[key]` (OBS).
 * Creator actions need the creator session; the overlay needs the integration key. Platform-side
 * moderation is only attempted where the adapter declares CHAT_MODERATE.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Unified chat API is not connected yet.");
};
const obj = (v: unknown) => (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
const isPlatform = (v: unknown): v is Platform => BROADCAST_PLATFORMS.includes(v as Platform);
const isRequestId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);
const failure = (e: unknown): ChatActionResult => ({ status: "FAILED", message: e instanceof PlatformError ? PLATFORM_ERROR_LABEL[e.code] : "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });

export async function getUnifiedChat(): Promise<UnifiedChatView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await ingestChat();
  return { ...chatView(), managerLinks: managerLinksView() };
}

/** YouTube connects through 유튜브 연동; the other platforms by channel handle in the mock (login/OAuth — TBD). */
export async function connectBroadcastChannel(input: unknown): Promise<ChatActionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = obj(input);
  if (!isPlatform(v.platform) || v.platform === "YOUTUBE") return { status: "INVALID", message: "잘못된 요청입니다." };
  const handle = typeof v.handle === "string" ? v.handle.trim() : "";
  if (!/^@?[A-Za-z0-9가-힣_.-]{2,40}$/.test(handle)) return { status: "INVALID", message: "채널 아이디를 2~40자로 입력해 주세요." };
  try {
    const ch = await withTimeout(ADAPTERS[v.platform].getChannel(handle));
    const channels = channelsStore().channels;
    const changed = channels[v.platform]?.externalChannelId !== ch.externalChannelId;
    channels[v.platform] = { platform: v.platform, externalChannelId: ch.externalChannelId, handle: ch.handle, title: ch.title, connectedAt: new Date().toISOString() };
    // Same tick as the write: chat and 후원 연동 never read the new channel with the old one's cursor.
    if (changed) onChannelChanged(v.platform);
  } catch (e) {
    return failure(e);
  }
  await startChatFrom(v.platform);
  return { status: "OK" };
}

export async function disconnectBroadcastChannel(input: unknown): Promise<ChatActionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = obj(input);
  if (!isPlatform(v.platform) || v.platform === "YOUTUBE") return { status: "INVALID", message: "잘못된 요청입니다." };
  delete channelsStore().channels[v.platform];
  onChannelChanged(v.platform);
  return { status: "OK" };
}

/** 통합 입력: one message to the chosen platforms. Partial failure is reported per platform. */
export async function sendUnifiedChat(input: unknown): Promise<ChatSendResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  return sendAction(input);
}

export async function hideChatMessage(input: unknown): Promise<ChatActionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  return hideAction(input, null);
}

export async function deleteChatMessage(input: unknown): Promise<ChatActionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  return deleteAction(input, null);
}

export async function banChatAuthor(input: unknown): Promise<ChatActionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  return banAction(input, null);
}

/** Developer simulator: a viewer chats on a platform (mock remote), then the feed pulls it in. */
export async function simulateViewerChat(input: unknown): Promise<ChatActionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = obj(input);
  if (!isRequestId(v.requestId) || !isPlatform(v.platform)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const s = chatStore();
  if (s.requests[v.requestId]) return { status: "OK" };
  const channel = broadcastChannelId(v.platform);
  if (!channel) return { status: "INVALID", message: "먼저 플랫폼 채널을 연결해 주세요." };
  const nick = typeof v.nick === "string" ? v.nick.trim() : "";
  const text = typeof v.text === "string" ? v.text.trim() : "";
  if (!nick || nick.length > 40) return { status: "INVALID", message: "닉네임을 1~40자로 입력해 주세요." };
  if (!text || text.length > CHAT_TEXT_MAX) return { status: "INVALID", message: `메시지를 1~${CHAT_TEXT_MAX}자로 입력해 주세요.` };
  const role = v.role === "MODERATOR" || v.role === "MEMBER" ? v.role : null;
  s.requests[v.requestId] = true;
  mockViewerChat(v.platform, channel, { userId: `sim:${v.platform}:${nick}`, nick, text, role });
  await ingestChat({ force: true });
  return { status: "OK" };
}

/** Developer simulator: the platform connection drops and re-delivers its backlog. */
export async function simulateChatReconnect(input: unknown): Promise<ChatActionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = obj(input);
  if (!isPlatform(v.platform)) return { status: "INVALID", message: "잘못된 요청입니다." };
  mockChatReconnect(v.platform);
  await ingestChat({ force: true });
  return { status: "OK" };
}

/** OBS overlay read — no login (OBS cannot sign in); the integration key is the secret. */
export async function getChatOverlay(key: unknown): Promise<ChatOverlayLine[] | "FORBIDDEN"> {
  assertMock();
  if (!sameSecret(key, mockCreator.integrationKey)) return "FORBIDDEN";
  await ingestChat();
  return overlayLines();
}
