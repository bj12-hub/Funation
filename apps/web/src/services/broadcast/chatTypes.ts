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
  /** Messages the platform delivered in a shape we could not read (dropped, not shown). */
  skipped: number;
};

export type ModerationAction = "HIDE" | "UNHIDE" | "DELETE" | "BAN";

/** `by`: null = the creator, otherwise the manager link's name (매니저 채팅창 링크). */
export type ModerationEntry = { at: string; action: ModerationAction; platform: Platform; target: string; detail: string; by: string | null };

export type UnifiedChatView = { platforms: ChatPlatformState[]; messages: UnifiedChatMessage[]; log: ModerationEntry[]; managerLinks: ManagerLink[] };

// ── 매니저 채팅창 링크 — code-first. A link per manager; the creator picks what it may do (viewing is always on).

export const MANAGER_PERMISSIONS = [
  { key: "HIDE", label: "숨김", hint: "오버레이에서 가리기 · 다시 보이기" },
  { key: "MODERATE", label: "삭제 · 차단", hint: "플랫폼에서 메시지 삭제 · 시청자 차단" },
  { key: "SEND", label: "통합 입력", hint: "채널 이름으로 모든 플랫폼에 보내기" }
] as const;
export type ManagerPermission = (typeof MANAGER_PERMISSIONS)[number]["key"];
export const isManagerPermission = (v: unknown): v is ManagerPermission => MANAGER_PERMISSIONS.some((p) => p.key === v);
export const MANAGER_LINKS_MAX = 5;
export const MANAGER_NAME_MAX = 12;
/** A new link starts with 숨김 only; the creator turns on more. */
export const MANAGER_DEFAULT_PERMISSIONS: ManagerPermission[] = ["HIDE"];

/** Shown to the creator only (the path carries the secret token). */
export type ManagerLink = { id: string; name: string; path: string; permissions: ManagerPermission[]; createdAt: string; lastUsedAt: string | null };

/** What a manager link sees: the feed and its own permissions (no log, no other links, no channel settings). */
export type ManagerChatView = { name: string; permissions: ManagerPermission[]; platforms: ChatPlatformState[]; messages: UnifiedChatMessage[] };

export const managerChatPath = (token: string) => `/popout/chat/m/${token}`;

export type ChatSendOutcome =
  | { status: "SENT"; externalMessageId: string }
  | { status: "NOT_CONNECTED" }
  | { status: "UNSUPPORTED" }
  /** Another call with the same requestId is sending it right now. */
  | { status: "PENDING" }
  /** The platform did not answer in time: it may have been posted, so it is not sent again automatically. */
  | { status: "UNCONFIRMED" }
  /** The platform refused it; a retry with the same requestId sends it again. */
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
  PENDING: "보내는 중",
  UNCONFIRMED: "확인 필요",
  FAILED: "실패"
};

/** Shown next to UNCONFIRMED: the creator checks the platform chat instead of a blind resend. */
export const SEND_UNCONFIRMED_HINT = "응답이 늦어 올라갔는지 알 수 없어요. 채팅에서 확인해 주세요.";

export const HIDDEN_LABEL: Record<ChatHiddenReason, string> = { MANUAL: "숨김", FILTER: "금칙어", DELETED: "삭제됨", BANNED: "차단됨" };

/** 채팅창 링크: the chat as its own web page (no studio menu), for a second monitor, an OBS browser dock or a phone. */
export const CHAT_WINDOW_PATH = "/popout/chat";
