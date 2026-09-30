import { USE_MOCK } from "@/lib/mock";

/**
 * 사이트 공지 배너 (관리자 콘솔 › 시스템) — code-first. Server-only store plus a public read used by the
 * site layout. Operators turn it on for 점검 · 장애 안내; schedules and multi-banner rules are TBD.
 */

export type BannerLevel = "INFO" | "WARNING";
export type SiteBanner = { enabled: boolean; level: BannerLevel; message: string; href: string | null; updatedAt: string | null; updatedBy: string | null };

export const BANNER_MESSAGE_MAX = 120;

const g = globalThis as typeof globalThis & { __funationMockSiteBannerV1?: SiteBanner };
export const siteBannerStore = (): SiteBanner => (g.__funationMockSiteBannerV1 ??= { enabled: false, level: "INFO", message: "", href: null, updatedAt: null, updatedBy: null });

/** What visitors see: the banner only while enabled. */
export async function getSiteBanner(): Promise<Pick<SiteBanner, "level" | "message" | "href"> | null> {
  if (!USE_MOCK) return null;
  const b = siteBannerStore();
  return b.enabled && b.message ? { level: b.level, message: b.message, href: b.href } : null;
}
