import { formatCompactKo, formatNumber } from "@/lib/format";
import type { AmountUnit } from "@/services/creator/creatorStudio";

/** A studio amount in its unit: "₩12,000" (the mock, as designed) or "1,200 FN" (FLEXTV's 렉스, phase 5). */
export const formatAmount = (value: number, unit: AmountUnit = "KRW") => (unit === "KRW" ? `₩${formatNumber(value)}` : `${formatNumber(value)} FN`);

/** "₩28만" · "2.8천 FN" for chart labels. */
export const formatCompactAmount = (value: number, unit: AmountUnit = "KRW") => (unit === "KRW" ? `₩${formatCompactKo(value)}` : `${formatCompactKo(value)} FN`);
