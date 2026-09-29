import type { ChannelProfile, ChannelVideo, PlatformErrorCode } from "@/services/platforms/platformTypes";

/**
 * 유튜브 연동 · 영상 목록 — code-first (funnation studio 채널 › 유튜브 연동 / 영상 목록). Client-safe.
 * The mock connects by channel handle; the real flow is Google OAuth with the channel owner's consent (TBD).
 */

export type YouTubeStatus = "DISCONNECTED" | "CONNECTED" | "ERROR";

export type YouTubeIntegration = {
  status: YouTubeStatus;
  channel: ChannelProfile | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: PlatformErrorCode | null;
  videoCount: number;
};

/** A synced video plus the creator's channel settings for it. */
export type ManagedVideo = ChannelVideo & { visible: boolean; pinned: boolean; syncedAt: string };

export type VideoFilter = "ALL" | "VOD" | "SHORTS" | "HIDDEN";

export const HANDLE_PATTERN = /^@?[A-Za-z0-9._-]{3,30}$/;

export type YouTubeResult =
  | { status: "OK"; added?: number }
  | { status: "INVALID"; message: string }
  | { status: "PLATFORM_ERROR"; code: PlatformErrorCode }
  | { status: "UNAUTHORIZED" };
