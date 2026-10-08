import type { PlatformCapability, PlatformErrorCode } from "@/services/platforms/platformTypes";
import type { Platform } from "@/types/platform";

/** 플랫폼 연동 · 시스템 — code-first. Client-safe types. */

export type PlatformStatusRow = {
  platform: Platform;
  capabilities: PlatformCapability[];
  /** Declared for the mock but not confirmed against the real API yet (TBD). */
  unverified: PlatformCapability[];
  /** Studio channel connection (유튜브 연동 · 통합 채팅 › 채널 연결). */
  connection: { connected: boolean; channelTitle: string | null; lastSyncedAt: string | null; lastError: PlatformErrorCode | null; videoCount: number };
  donationLink: { enabled: boolean; received: number; duplicates: number; lastEventAt: string | null };
  lastCheck: { at: string; ok: boolean; latencyMs: number; error: PlatformErrorCode | null } | null;
};

export type SystemView = {
  banner: { enabled: boolean; level: "INFO" | "WARNING"; message: string; href: string | null; updatedAt: string | null; updatedBy: string | null };
  runtime: { mock: boolean; nodeEnv: string; auditEntries: number };
};

export type SystemResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
