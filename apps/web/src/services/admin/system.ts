"use server";

import { USE_MOCK } from "@/lib/mock";
import { getAdminSession } from "@/lib/session";
import { donationLinkStore } from "@/services/creator/donationLinkCore";
import { youtubeStore } from "@/services/creator/youtubeCore";
import { ADAPTERS } from "@/services/platforms/adapters";
import { PlatformError, type PlatformErrorCode } from "@/services/platforms/platformTypes";
import { BANNER_MESSAGE_MAX, siteBannerStore } from "@/services/system/siteBanner";
import type { Platform } from "@/types/platform";
import { auditStore, recordAudit } from "./auditCore";
import type { PlatformStatusRow, SystemResult, SystemView } from "./systemTypes";

/**
 * 플랫폼 연동 · 시스템 Server Actions — code-first. Routes `/admin/platforms`, `/admin/system`. Admin only.
 * The connection check calls each adapter the way production code would (timeouts and error codes
 * included) and never exposes platform DTOs.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin system API is not connected yet.");
};
const PLATFORMS: Platform[] = ["YOUTUBE", "FLEXTV", "SOOP"];

type Checks = Partial<Record<Platform, PlatformStatusRow["lastCheck"]>>;
const g = globalThis as typeof globalThis & { __funationMockPlatformChecksV1?: Checks };
const checks = (): Checks => (g.__funationMockPlatformChecksV1 ??= {});

export async function getPlatformStatus(): Promise<PlatformStatusRow[] | null> {
  assertMock();
  if (!(await getAdminSession())) return null;
  const yt = youtubeStore();
  const link = donationLinkStore();
  return PLATFORMS.map((p) => ({
    platform: p,
    capabilities: [...ADAPTERS[p].capabilities],
    connection:
      p === "YOUTUBE"
        ? { connected: !!yt.channel, channelTitle: yt.channel?.title ?? null, lastSyncedAt: yt.lastSyncedAt, lastError: yt.lastError, videoCount: Object.keys(yt.videos).length }
        : { connected: false, channelTitle: null, lastSyncedAt: null, lastError: null, videoCount: 0 },
    donationLink: { enabled: link.enabled[p], ...link.stats[p] },
    lastCheck: checks()[p] ?? null
  }));
}

/** 연결 확인: a lightweight read through the adapter; the result is kept for the status table. */
export async function checkPlatform(platform: unknown): Promise<SystemResult> {
  assertMock();
  if (!(await getAdminSession())) return { status: "UNAUTHORIZED" };
  if (!PLATFORMS.includes(platform as Platform)) return { status: "INVALID", message: "알 수 없는 플랫폼이에요." };
  const p = platform as Platform;
  const started = Date.now();
  let error: PlatformErrorCode | null = null;
  try {
    await ADAPTERS[p].getChannel("healthcheck");
  } catch (e) {
    error = e instanceof PlatformError ? e.code : "UNAVAILABLE";
  }
  checks()[p] = { at: new Date().toISOString(), ok: error === null, latencyMs: Date.now() - started, error };
  return { status: "OK" };
}

export async function getSystemView(): Promise<SystemView | null> {
  assertMock();
  if (!(await getAdminSession())) return null;
  return { banner: { ...siteBannerStore() }, runtime: { mock: USE_MOCK, nodeEnv: process.env.NODE_ENV ?? "unknown", auditEntries: auditStore().entries.length } };
}

export async function saveSiteBanner(input: unknown): Promise<SystemResult> {
  assertMock();
  const admin = await getAdminSession();
  if (!admin) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const message = typeof v.message === "string" ? v.message.trim() : "";
  const href = typeof v.href === "string" ? v.href.trim() : "";
  if (typeof v.enabled !== "boolean") return { status: "INVALID", message: "표시 여부를 확인해 주세요." };
  if (v.level !== "INFO" && v.level !== "WARNING") return { status: "INVALID", message: "배너 종류를 골라 주세요." };
  if ((v.enabled && !message) || message.length > BANNER_MESSAGE_MAX) return { status: "INVALID", message: `문구를 1~${BANNER_MESSAGE_MAX}자로 입력해 주세요.` };
  if (href && (!/^\/[A-Za-z0-9/_\-?=&.]*$/.test(href) || href.startsWith("//"))) return { status: "INVALID", message: "링크는 사이트 안의 주소(/로 시작)만 쓸 수 있어요." };
  const store = siteBannerStore();
  Object.assign(store, { enabled: v.enabled, level: v.level, message, href: href || null, updatedAt: new Date().toISOString(), updatedBy: admin.nickname });
  recordAudit(admin, "SYSTEM_UPDATE", "site-banner", `${v.enabled ? "표시" : "숨김"} · ${message || "(문구 없음)"}`);
  return { status: "OK" };
}
