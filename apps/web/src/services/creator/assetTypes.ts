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

/**
 * 이미지·사운드 자동 매칭 (funnation 참고, 2026-10-06 결정): an image and a sound with the same name (uploads drop the
 * extension; case and surrounding spaces are ignored) belong together — picking the image for a 시그니처 brings the sound.
 */
const pairKey = (name: string) => name.trim().toLowerCase();

/** The other half of `asset`'s pair in `library`, if any (the first match by upload order). */
export function pairOf(asset: Pick<Asset, "kind" | "name">, library: Asset[]): Asset | null {
  const other: AssetKind = asset.kind === "IMAGE" ? "SOUND" : "IMAGE";
  return library.find((a) => a.kind === other && pairKey(a.name) === pairKey(asset.name)) ?? null;
}

export type AssetResult = { status: "SAVED"; asset: Asset } | { status: "DELETED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
