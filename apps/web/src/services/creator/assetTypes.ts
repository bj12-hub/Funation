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
 * Names compare in Unicode NFC: macOS gives decomposed (NFD) Korean file names, which look the same but differ.
 */
export const nameKey = (name: string) => name.normalize("NFC").trim().toLowerCase();
const pairKey = nameKey;

/** The other half of `asset`'s pair in `library`, if any (the first match by upload order). */
export function pairOf(asset: Pick<Asset, "kind" | "name">, library: Asset[]): Asset | null {
  const other: AssetKind = asset.kind === "IMAGE" ? "SOUND" : "IMAGE";
  return library.find((a) => a.kind === other && pairKey(a.name) === pairKey(asset.name)) ?? null;
}

/** 라이브러리 정렬 (funnation "정렬·필터", code-first 2026-10-06). The store keeps the newest first. */
export const ASSET_SORTS = [
  { key: "NEW", label: "최신순" },
  { key: "OLD", label: "오래된순" },
  { key: "NAME", label: "이름순" },
  { key: "SIZE", label: "큰 파일순" }
] as const;
export type AssetSort = (typeof ASSET_SORTS)[number]["key"];

export type AssetFilter = { kind: AssetKind; query: string; sort: AssetSort; pairedOnly: boolean };

/** The files of one kind matching the name search (case and spaces ignored) and the 짝 filter, in the chosen order. */
export function filterAssets(library: Asset[], f: AssetFilter): Asset[] {
  const q = nameKey(f.query);
  const shown = library.filter((a) => a.kind === f.kind && (!q || nameKey(a.name).includes(q)) && (!f.pairedOnly || pairOf(a, library)));
  const time = (a: Asset) => Date.parse(a.uploadedAt) || 0;
  // Uploads in the same millisecond fall back to the store's order (newest first).
  const at = new Map(library.map((a, i) => [a.id, i]));
  const pos = (a: Asset) => at.get(a.id) ?? 0;
  const by: Record<AssetSort, (a: Asset, b: Asset) => number> = {
    NEW: (a, b) => time(b) - time(a) || pos(a) - pos(b),
    OLD: (a, b) => time(a) - time(b) || pos(b) - pos(a),
    NAME: (a, b) => a.name.normalize("NFC").localeCompare(b.name.normalize("NFC"), "ko") || pos(a) - pos(b),
    SIZE: (a, b) => b.size - a.size || pos(a) - pos(b)
  };
  return shown.sort(by[f.sort]);
}

export type AssetResult = { status: "SAVED"; asset: Asset } | { status: "DELETED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
