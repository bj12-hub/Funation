import { sortSignatures } from "@/services/donations/signatureTypes";

/**
 * 두산 시그니처 list order in the card: 낮은 금액순 (default) · 높은 금액순 · 최신순 · 오래된순 (2026-10-30, by when each was
 * made — older signatures without it count as the oldest) · 시그니처 목록 순서.
 */
export type DosanSort = "PRICE_ASC" | "PRICE_DESC" | "NEWEST" | "OLDEST" | "LIST";
export const DOSAN_SORTS: { key: DosanSort; label: string }[] = [
  { key: "PRICE_ASC", label: "낮은 금액순" },
  { key: "PRICE_DESC", label: "높은 금액순" },
  { key: "NEWEST", label: "최신순" },
  { key: "OLDEST", label: "오래된순" },
  { key: "LIST", label: "목록 순서" }
];

export function sortDosanSignatures<T extends { price: number; createdAt?: string }>(signatures: T[], sort: DosanSort): T[] {
  if (sort === "LIST") return [...signatures];
  return sortSignatures(signatures, sort);
}

/**
 * 끌어서 고르기 (2026-10-30, StreamDonate "클릭하거나 드래그하여 다중 선택/해제"): `ids` with `id` put in (`on`) or taken out,
 * at most `max` in.
 */
export function paintPick(ids: string[], id: string, on: boolean, max: number): string[] {
  if (!on) return ids.filter((x) => x !== id);
  return ids.includes(id) || ids.length >= max ? ids : [...ids, id];
}

/**
 * 시그니처 두산 랜덤 선택 (2026-10-28, StreamDonate "~ 원 · 개 랜덤 선택"): up to `count` signatures in use priced within
 * `min` ~ `max` (null = no end), picked at random — a helper for the card's selection (설정 저장 keeps it), so the
 * browser's randomness is enough. `found`: how many were in the range.
 */
export function pickDosanSignatures<T extends { id: string; price: number; active: boolean }>(
  signatures: T[],
  range: { min: number | null; max: number | null; count: number },
  random: () => number = Math.random
): { ids: string[]; found: number } {
  const pool = signatures.filter((s) => s.active && (range.min === null || s.price >= range.min) && (range.max === null || s.price <= range.max));
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ids: order.slice(0, Math.max(0, range.count)).map((s) => s.id), found: pool.length };
}
