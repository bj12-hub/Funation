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
  /** When it was made (2026-10-28, 최신순 · 오래된순); missing on signatures made before — they count as the oldest. */
  createdAt?: string;
};

/** 목록 정렬 (2026-10-28, StreamDonate 시그니처 관리): a view only — 기본 순서 is the room's order (↑ ↓ move it). */
export const SIGNATURE_SORTS = [
  { key: "ORDER", label: "기본 순서" },
  { key: "PRICE_ASC", label: "낮은 금액순" },
  { key: "PRICE_DESC", label: "높은 금액순" },
  { key: "NEWEST", label: "최신순" },
  { key: "OLDEST", label: "오래된순" }
] as const;
export type SignatureSort = (typeof SIGNATURE_SORTS)[number]["key"];

/**
 * The signatures in `sort` order. Ties keep the room's order (newest: the later one first); a signature without
 * `createdAt` is older than any with one, and among them the room's order stands for when they were made.
 */
export function sortSignatures<T extends Pick<ManagedSignature, "price" | "createdAt">>(items: T[], sort: SignatureSort): T[] {
  const at = (s: T) => s.createdAt ?? "";
  const indexed = items.map((s, i) => ({ s, i }));
  const by: Record<SignatureSort, (x: { s: T; i: number }, y: { s: T; i: number }) => number> = {
    ORDER: (x, y) => x.i - y.i,
    PRICE_ASC: (x, y) => x.s.price - y.s.price || x.i - y.i,
    PRICE_DESC: (x, y) => y.s.price - x.s.price || x.i - y.i,
    NEWEST: (x, y) => at(y.s).localeCompare(at(x.s)) || y.i - x.i,
    OLDEST: (x, y) => at(x.s).localeCompare(at(y.s)) || x.i - y.i
  };
  return indexed.sort(by[sort]).map((x) => x.s);
}

/**
 * 미디어 누락 (2026-10-25, StreamDonate 시그니처 관리 참고): where a signature's media stands, by the rules alerts use.
 * image MISSING = a library image deleted since (alerts show the first preset); sound NONE = none picked, MISSING = a
 * library sound deleted since (the alert plays none).
 */
export type SignatureMedia = { image: "OK" | "MISSING"; sound: "OK" | "NONE" | "MISSING" };
/** A signature as the 시그니처 후원 screen lists it. */
export type SignatureRow = ManagedSignature & { media: SignatureMedia };

/** 미디어 누락 필터: one chip per kind of gap. */
export const MEDIA_GAPS = [
  { key: "IMAGE_MISSING", label: "이미지 지워짐" },
  { key: "SOUND_MISSING", label: "소리 지워짐" },
  { key: "SOUND_NONE", label: "소리 없음" }
] as const;
export type MediaGap = (typeof MEDIA_GAPS)[number]["key"];
export function mediaGapsOf(m: SignatureMedia): MediaGap[] {
  const gaps: MediaGap[] = [];
  if (m.image === "MISSING") gaps.push("IMAGE_MISSING");
  if (m.sound === "MISSING") gaps.push("SOUND_MISSING");
  if (m.sound === "NONE") gaps.push("SOUND_NONE");
  return gaps;
}

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
 * 공개 시그니처 페이지 (2026-10-25, StreamDonate 참고 — 기본값): a page anyone with its address can open without logging in,
 * listing the active signatures with their sound. Off until the creator turns it on; the key in `path` can be reissued
 * (the old address stops), and it stops while the creator's access is closed (정지 · 탈퇴), like the other links.
 */
export type SignaturePageSettings = { enabled: boolean; path: string };
export type PublicSignature = { id: string; name: string; price: number; imageUrl: string; soundUrl: string | null; group: string };
/** The page: the channel's active signatures in the creator's order and their groups in order. */
export type PublicSignaturePage = { channelName: string; signatures: PublicSignature[]; groups: string[] };

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
