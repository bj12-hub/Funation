/**
 * 시그니처 후원 관리 — code-first (funnation 위젯 "시그니처 후원: 시그니처를 만들고 매칭 규칙을 정합니다").
 * Prices and matching are channel settings chosen by the creator. Client-safe types and limits.
 */

/** "SELECT" = only when the supporter picks it; "AMOUNT" = also when a 일반 후원 amount equals the price. */
export type SignatureMatch = "SELECT" | "AMOUNT";

export type ManagedSignature = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  /** A SOUND from the creator's library played with the signature's alert (null = none; code-first, 2026-10-06). */
  soundUrl: string | null;
  match: SignatureMatch;
  active: boolean;
};

export const SIGNATURE_LIMITS = { max: 50, nameMax: 20, priceMin: 100, priceMax: 10_000_000 } as const;

/** Preset images; creators can also pick a library image (`/api/media/[id]`). */
export const SIGNATURE_IMAGE_PRESETS = Array.from({ length: 8 }, (_, i) => `/mock/room/signatures/sig-${i + 1}.png`);

export type SignatureResult = { status: "SAVED"; id: string } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/**
 * 시그니처 일괄 만들기 (funnation "시그니처 일괄 생성", code-first 2026-10-06): one signature per library image,
 * all saved together or none. `row` is the index of the row the message is about.
 */
export type SignatureBulkResult = { status: "SAVED"; ids: string[] } | { status: "INVALID"; message: string; row?: number } | { status: "UNAUTHORIZED" };

/** A file name's default signature name: the name itself, cut to the limit. */
export const signatureNameFrom = (assetName: string) => assetName.trim().slice(0, SIGNATURE_LIMITS.nameMax).trim();

/**
 * A price suggested by the file name ("1004 하트" → 1004, "축하_5,000" → 5000): the first number in it, if it is a
 * valid price. Only a starting value — the creator checks every price before saving (prices are the channel's own).
 */
export function priceFromName(name: string): number | null {
  const m = name.match(/\d{1,3}(?:,\d{3})+(?!\d)|\d+/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isSafeInteger(n) && n >= SIGNATURE_LIMITS.priceMin && n <= SIGNATURE_LIMITS.priceMax ? n : null;
}
