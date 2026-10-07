import type { Platform } from "@/types/platform";

/**
 * Core platform-integration types (CLAUDE.md §9). Adapters map each platform's own API responses to
 * these; external DTOs never leave the adapter. Client-safe.
 */

/**
 * CHAT_EVENTS = read live chat · CHAT_SEND = post as the channel · CHAT_MODERATE = delete messages and
 * ban/timeout users on the platform itself.
 */
export type PlatformCapability = "CHANNEL_PROFILE" | "VIDEO_LIST" | "LIVE_STATUS" | "CHAT_EVENTS" | "CHAT_SEND" | "CHAT_MODERATE" | "DONATION_EVENTS";

/** A live-chat message as the core domain sees it. Platform DTOs are mapped inside the adapter. */
export type ExternalChatMessage = {
  platform: Platform;
  /** The platform's own message id — the dedupe key (reconnects can re-deliver messages). */
  externalMessageId: string;
  author: {
    /** The platform's user id — what moderation (ban) targets. */
    platformUserId: string;
    displayName: string;
    /** Normalised roles; platform-specific badges are mapped to these or dropped. */
    roles: ChatAuthorRole[];
  };
  text: string;
  sentAt: string;
};

export type ChatAuthorRole = "OWNER" | "MODERATOR" | "MEMBER";

export type ChannelProfile = { platform: Platform; externalChannelId: string; title: string; handle: string; subscriberCount: number };

export type VideoKind = "VOD" | "SHORTS";

/** A platform video as the core domain sees it. `externalId` is the platform's id, unique per platform. */
export type ChannelVideo = {
  platform: Platform;
  externalId: string;
  title: string;
  kind: VideoKind;
  durationSec: number;
  publishedAt: string;
  viewCount: number;
  url: string;
};

/** A donation made on a broadcast platform (e.g. a paid chat). Amount stays in the platform's currency. */
export type ExternalDonationEvent = {
  platform: Platform;
  /** The platform's own event id — the dedupe key (platforms may deliver an event more than once). */
  externalEventId: string;
  donorName: string;
  message: string;
  amount: { value: number; currency: string };
  kindLabel: string;
  occurredAt: string;
};

/**
 * Read position in a platform feed (chat, donation events), tied to the channel it was read from. None,
 * or one for another channel, means "start from now"; `cursor: null` re-reads that channel from the start.
 */
export type ChannelCursor = { channelId: string; cursor: string | null };

export type PlatformErrorCode = "TIMEOUT" | "NOT_FOUND" | "UNAUTHORIZED" | "UNSUPPORTED" | "UNAVAILABLE";

export class PlatformError extends Error {
  constructor(
    readonly code: PlatformErrorCode,
    message: string
  ) {
    super(message);
  }
}

export const PLATFORM_ERROR_LABEL: Record<PlatformErrorCode, string> = {
  TIMEOUT: "플랫폼 응답이 늦어요. 잠시 후 다시 시도해 주세요.",
  NOT_FOUND: "채널을 찾을 수 없어요.",
  UNAUTHORIZED: "연결 권한이 만료됐어요. 다시 연결해 주세요.",
  UNSUPPORTED: "이 플랫폼은 아직 지원하지 않는 기능이에요.",
  UNAVAILABLE: "플랫폼에 연결할 수 없어요. 잠시 후 다시 시도해 주세요."
};
