import type { ChatAuthorRole, PlatformErrorCode } from "@/services/platforms/platformTypes";
import type { Platform } from "@/types/platform";

/**
 * 통합 채팅 — code-first (no Figma frame; reference: weflab 채팅창). Client-safe types.
 * Chat arrives separately on every platform the creator streams to; Somnation merges it into one feed
 * for the studio (manage) and one OBS overlay (display). Hiding is ours only; deleting and banning act on
 * the platform and only where its adapter declares CHAT_MODERATE.
 */

export type ChatHiddenReason = "MANUAL" | "FILTER" | "DELETED" | "BANNED";

export type UnifiedChatMessage = {
  /** `${platform}:${externalMessageId}` — unique across platforms. */
  id: string;
  /** Arrival order in the merged feed. */
  seq: number;
  platform: Platform;
  externalMessageId: string;
  author: { platformUserId: string; displayName: string; roles: ChatAuthorRole[] };
  text: string;
  sentAt: string;
  receivedAt: string;
  /** Hidden from the overlay (and dimmed in the studio). */
  hidden: ChatHiddenReason | null;
  /** Sent from the studio's 통합 입력 (the platform echoes our own message back). */
  fromStudio: boolean;
};

export type ChatPlatformState = {
  platform: Platform;
  connected: boolean;
  channel: { handle: string; title: string } | null;
  canRead: boolean;
  canSend: boolean;
  canModerate: boolean;
  /** Capabilities the mock declares but the real API is not confirmed for yet (TBD). */
  unverified: boolean;
  lastSyncAt: string | null;
  lastError: PlatformErrorCode | null;
  received: number;
  duplicates: number;
};

export type ModerationAction = "HIDE" | "UNHIDE" | "DELETE" | "BAN";

export type ModerationEntry = { at: string; action: ModerationAction; platform: Platform; target: string; detail: string };

export type UnifiedChatView = { platforms: ChatPlatformState[]; messages: UnifiedChatMessage[]; log: ModerationEntry[] };

export type ChatSendOutcome =
  | { status: "SENT"; externalMessageId: string }
  | { status: "NOT_CONNECTED" }
  | { status: "UNSUPPORTED" }
  | { status: "FAILED"; code: PlatformErrorCode };

export type ChatSendResult = { status: "OK"; results: Partial<Record<Platform, ChatSendOutcome>> } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

export type ChatActionResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "FAILED"; message: string } | { status: "UNAUTHORIZED" };

/** One overlay line — only what the screen shows. */
export type ChatOverlayLine = { id: string; platform: Platform; name: string; roles: ChatAuthorRole[]; text: string };

export const CHAT_TEXT_MAX = 200;

/** Ban lengths offered in the studio; platforms that only support some lengths are TBD per adapter. */
export const BAN_DURATIONS: { sec: number | null; label: string }[] = [
  { sec: 300, label: "5분" },
  { sec: 3600, label: "1시간" },
  { sec: 86_400, label: "1일" },
  { sec: null, label: "영구" }
];

export const ROLE_LABEL: Record<ChatAuthorRole, string> = { OWNER: "스트리머", MODERATOR: "매니저", MEMBER: "구독자" };

export const SEND_OUTCOME_LABEL: Record<ChatSendOutcome["status"], string> = {
  SENT: "보냄",
  NOT_CONNECTED: "채널 연결 안 됨",
  UNSUPPORTED: "보내기 미지원",
  FAILED: "실패"
};

export const HIDDEN_LABEL: Record<ChatHiddenReason, string> = { MANUAL: "숨김", FILTER: "금칙어", DELETED: "삭제됨", BANNED: "차단됨" };

/** 채팅창 링크: the chat as its own web page (no studio menu), for a second monitor, an OBS browser dock or a phone. */
export const CHAT_WINDOW_PATH = "/popout/chat";
