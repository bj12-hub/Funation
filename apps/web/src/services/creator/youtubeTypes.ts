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

/**
 * A synced video plus the creator's channel settings for it. `missing`: YouTube no longer shows it (deleted or made
 * private, 2026-10-08 결정 "유튜브에서 지운 영상 표시") — listed as 찾을 수 없음 with its settings kept, and cleared
 * when it comes back. `syncedAt` is when YouTube last confirmed the video.
 */
export type ManagedVideo = ChannelVideo & { visible: boolean; pinned: boolean; missing: boolean; syncedAt: string };

export type VideoFilter = "ALL" | "VOD" | "SHORTS" | "HIDDEN";

export const HANDLE_PATTERN = /^@?[A-Za-z0-9._-]{3,30}$/;

export type YouTubeResult =
  | { status: "OK"; added?: number; missing?: number }
  | { status: "INVALID"; message: string }
  | { status: "PLATFORM_ERROR"; code: PlatformErrorCode }
  | { status: "UNAUTHORIZED" };
