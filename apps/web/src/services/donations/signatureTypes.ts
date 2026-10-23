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
  /**
   * 금액범위 (2026-10-23, StreamDonate 시그니처 금액범위 참고): with 금액 일치, a 일반 후원 from `rangeMin` up to the price
   * also alerts as this signature. null = the price only. Two active 금액 일치 signatures never share an amount.
   */
  rangeMin: number | null;
  /** 그룹 (2026-10-23): a label to filter signatures and to show or hide a whole group at once. */
  group: string;
};

export const SIGNATURE_LIMITS = { max: 50, nameMax: 20, priceMin: 100, priceMax: 10_000_000, groupMax: 10 } as const;
export const DEFAULT_SIGNATURE_GROUP = "기본";

/** The 일반 후원 amounts a 금액 일치 signature takes: from `rangeMin` (or the price) to the price. */
export const amountSpan = (s: Pick<ManagedSignature, "price" | "rangeMin">) => ({ from: s.rangeMin ?? s.price, to: s.price });

/** Two active 금액 일치 signatures that would both take some amount (a price in another's range, or overlapping ranges). */
export function amountConflict(list: ManagedSignature[]): [ManagedSignature, ManagedSignature] | null {
  const matched = list.filter((s) => s.active && s.match === "AMOUNT");
  for (let i = 0; i < matched.length; i++) {
    for (let j = i + 1; j < matched.length; j++) {
      const a = amountSpan(matched[i]);
      const b = amountSpan(matched[j]);
      if (a.from <= b.to && b.from <= a.to) return [matched[i], matched[j]];
    }
  }
  return null;
}

/** "10,000 FN" or "9,000 ~ 10,000 FN". */
export const spanText = (s: Pick<ManagedSignature, "price" | "rangeMin">) =>
  s.rangeMin === null ? `${s.price.toLocaleString("ko-KR")} FN` : `${s.rangeMin.toLocaleString("ko-KR")} ~ ${s.price.toLocaleString("ko-KR")} FN`;

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
