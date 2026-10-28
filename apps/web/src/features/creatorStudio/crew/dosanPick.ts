/** 두산 시그니처 list order in the card: 낮은 금액순 (default) · 높은 금액순 · 시그니처 목록 순서. */
export type DosanSort = "PRICE_ASC" | "PRICE_DESC" | "LIST";
export const DOSAN_SORTS: { key: DosanSort; label: string }[] = [
  { key: "PRICE_ASC", label: "낮은 금액순" },
  { key: "PRICE_DESC", label: "높은 금액순" },
  { key: "LIST", label: "목록 순서" }
];

export function sortDosanSignatures<T extends { price: number }>(signatures: T[], sort: DosanSort): T[] {
  if (sort === "LIST") return [...signatures];
  return [...signatures].sort((x, y) => (sort === "PRICE_ASC" ? x.price - y.price : y.price - x.price));
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
