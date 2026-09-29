/**
 * 배너 위젯 — code-first (funnation 위젯 "배너: 이미지 슬라이드쇼 배너를 화면 상/하/중앙에 표시").
 * Slides are library images; timing is a channel setting. Client-safe types.
 */

export type BannerPosition = "TOP" | "CENTER" | "BOTTOM";

export type BannerSettings = {
  enabled: boolean;
  position: BannerPosition;
  intervalSec: number;
  /** Library IMAGE asset ids, in slide order. */
  slides: string[];
};

export const BANNER_POSITIONS: { key: BannerPosition; label: string }[] = [
  { key: "TOP", label: "상단" },
  { key: "CENTER", label: "중앙" },
  { key: "BOTTOM", label: "하단" }
];

export const BANNER_LIMITS = { slidesMax: 10, intervalMin: 3, intervalMax: 60 } as const;

export type OverlayBanner = { enabled: boolean; position: BannerPosition; intervalSec: number; slides: { id: string; url: string }[]; reloadSeq: number };

export type BannerResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** Which slide is on screen: every overlay shows the same slide at the same time (display only). */
export const slideIndexAt = (now: number, intervalSec: number, count: number) => (count ? Math.floor(now / (intervalSec * 1000)) % count : 0);
