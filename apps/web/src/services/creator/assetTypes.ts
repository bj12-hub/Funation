/**
 * 이미지·사운드 라이브러리 — code-first (funnation 위젯 도구 "이미지·사운드"). Client-safe types and limits.
 * Size and format limits are placeholders (TBD: upload policy, content review).
 */

export type AssetKind = "IMAGE" | "SOUND";

export type Asset = {
  id: string;
  kind: AssetKind;
  name: string;
  mime: string;
  size: number;
  /** Served by `/api/media/[id]` (mock CDN: unguessable id, no login). */
  url: string;
  uploadedAt: string;
};

export const ASSET_TYPES: Record<AssetKind, readonly string[]> = {
  IMAGE: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  SOUND: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg"]
};

export const ASSET_LIMITS = {
  max: 60,
  nameMax: 40,
  bytes: { IMAGE: 5 * 1024 * 1024, SOUND: 2 * 1024 * 1024 } as Record<AssetKind, number>,
  totalBytes: 60 * 1024 * 1024
} as const;

export const assetUrl = (id: string) => `/api/media/${id}`;

export type AssetResult = { status: "SAVED"; asset: Asset } | { status: "DELETED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
