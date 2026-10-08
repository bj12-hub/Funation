import { formatNumber } from "@/lib/format";
import { toDateString } from "@/lib/period";

/**
 * FN 충전 환불 정책 — 기본값 (일반적인 기준, 법무 검토 전). On 2026-10-08 the user asked to start with commonly used
 * rules; each number is one constant here so it can change after the legal review (docs/domains/wallet.md "환불 정책").
 * Client-safe (no server-only imports): the screens format these values, the server decides with them
 * (`refundCore.ts`). Amounts are in FN, like the charge and wallet records.
 *
 * 1. 청약철회: requested within REFUND_WITHDRAWAL_DAYS of the payment date and none of the charge's FN used —
 *    the whole charge is cancelled, no fee.
 * 2. Otherwise the charge's paid FN still unused are refunded minus REFUND_FEE_RATE (fee rounded down to a whole FN).
 * 3. Never refunded: FN already used, and free FN (출석 보상, events — `mockCreditStore` credits). A quest refund just
 *    returns FN to the balance; it is not a charge.
 * 4. Which paid FN are still unused: free FN count as spent first, then paid FN oldest charge first (FIFO).
 *
 * TBD: the payment provider and how each method returns KRW, the FN/KRW rate (a partial refund is stated in FN).
 */

export const REFUND_POLICY_LABEL = "기본값 (일반적인 기준, 법무 검토 전)";
/**
 * 청약철회 기간: the request date may be at most this many calendar days after the payment date (server time) —
 * paid on 10/1, a request until 10/8 23:59:59 counts.
 */
export const REFUND_WITHDRAWAL_DAYS = 7;
/** 환불 수수료 on the unused paid FN of a charge that is not a 청약철회. */
export const REFUND_FEE_RATE = 0.1;
/** Processing target stated in the copy (a target only — no SLA engine). */
export const REFUND_PROCESSING_TARGET = "접수 후 3영업일 이내 처리";
/** The payment provider is TBD, so the copy does not promise how each method returns the money. */
export const REFUND_METHOD_NOTE = "결제 수단별 환불 방식은 결제 대행사 연동 후 확정";
/** 환불 정책 문서 (the page itself comes from another branch). */
export const REFUND_POLICY_HREF = "/terms/refund";

export type RefundType = "FULL_CANCEL" | "PARTIAL" | "NOT_REFUNDABLE";
export const REFUND_TYPE_LABEL: Record<RefundType, string> = { FULL_CANCEL: "전액 취소", PARTIAL: "수수료 공제 후 환불", NOT_REFUNDABLE: "환불 불가" };

/**
 * A refund as the server stores it with a request (and with its approval). `grossFn`: the paid FN taken back from the
 * wallet; `feeFn` + `netFn` = `grossFn`; `netFn` is what the member gets back (KRW per method: TBD).
 */
export type RefundAmounts = { type: Exclude<RefundType, "NOT_REFUNDABLE">; grossFn: number; feeFn: number; netFn: number };

/**
 * The server's refund outcome for one charge. `usedFn`: the charge's FN counted as used (FIFO); `withinPeriod`: the
 * request falls in the 청약철회 period. NOT_REFUNDABLE has 0 for the three amounts.
 */
export type RefundQuote = {
  type: RefundType;
  chargeFn: number;
  usedFn: number;
  withinPeriod: boolean;
  grossFn: number;
  feeFn: number;
  netFn: number;
};

/** "10%" */
export const REFUND_FEE_PERCENT = `${Math.round(REFUND_FEE_RATE * 1000) / 10}%`;

/** The refund fee, rounded down to a whole FN (in the member's favour; the inner round only removes float noise). */
export function refundFee(grossFn: number): number {
  return Math.floor(Math.round(grossFn * REFUND_FEE_RATE * 1e6) / 1e6);
}

/** Whether a request made at `requestedAt` is within the 청약철회 period of a charge paid at `chargedAt` (local "YYYY-MM-DD …"). */
export function withinWithdrawalPeriod(chargedAt: string, requestedAt: Date): boolean {
  const [y, m, d] = chargedAt.slice(0, 10).split("-").map(Number);
  return toDateString(requestedAt) <= toDateString(new Date(y, m - 1, d + REFUND_WITHDRAWAL_DAYS));
}

/** Policy 1–3 for one charge, given how many of its paid FN are still unused. */
export function quoteRefund(input: { chargeFn: number; unusedFn: number; withinPeriod: boolean }): RefundQuote {
  const { chargeFn, withinPeriod } = input;
  const grossFn = Math.max(0, Math.min(chargeFn, Math.floor(input.unusedFn)));
  const base = { chargeFn, usedFn: chargeFn - grossFn, withinPeriod };
  if (grossFn === 0) return { ...base, type: "NOT_REFUNDABLE", grossFn: 0, feeFn: 0, netFn: 0 };
  if (withinPeriod && grossFn === chargeFn) return { ...base, type: "FULL_CANCEL", grossFn, feeFn: 0, netFn: grossFn };
  const feeFn = refundFee(grossFn);
  return { ...base, type: "PARTIAL", grossFn, feeFn, netFn: grossFn - feeFn };
}

/** The stored part of a refundable quote (explicit fields). */
export function refundAmounts(q: RefundQuote): RefundAmounts | null {
  return q.type === "NOT_REFUNDABLE" ? null : { type: q.type, grossFn: q.grossFn, feeFn: q.feeFn, netFn: q.netFn };
}

export const sameRefund = (a: Pick<RefundAmounts, "type" | "grossFn" | "netFn">, b: Pick<RefundAmounts, "type" | "grossFn" | "netFn">) =>
  a.type === b.type && a.grossFn === b.grossFn && a.netFn === b.netFn;

// ── FIFO (policy 4) ──────────────────────────────────────────────────────────

/**
 * One balance change of an account. PAID: a completed charge; FREE: FN credited without a payment; SPEND: FN spent or
 * held (a donation); RECLAIM: an approved charge refund taking FN back from that charge. `at`: local "YYYY-MM-DD HH:mm[:ss]".
 */
export type FnLedgerEvent =
  | { kind: "PAID"; chargeId: string; at: string; fn: number }
  | { kind: "FREE"; at: string; fn: number }
  | { kind: "SPEND"; at: string; fn: number }
  | { kind: "RECLAIM"; chargeId: string; at: string; fn: number };

const stamp = (at: string) => (at.length === 16 ? `${at}:00` : at);

/**
 * How many paid FN of each charge are still unused. Events run in time order (credits before spends of the same
 * second); every spend uses free FN first, then paid FN oldest charge first. The balance stays authoritative: FN the
 * events do not explain as spent but that are no longer in the balance count as used earlier, in the same order; FN in
 * the balance that no charge explains are not a charge's (never refundable). Server-side only.
 */
export function unusedPaidFn(events: FnLedgerEvent[], balance: number): Map<string, number> {
  const rank = (e: FnLedgerEvent) => (e.kind === "PAID" || e.kind === "FREE" ? 0 : 1);
  const ordered = [...events].sort((a, b) => stamp(a.at).localeCompare(stamp(b.at)) || rank(a) - rank(b));
  let free = 0;
  const lots: { chargeId: string; left: number }[] = []; // oldest charge first
  const spend = (fn: number) => {
    const fromFree = Math.min(free, fn);
    free -= fromFree;
    let rest = fn - fromFree;
    for (const lot of lots) {
      if (rest <= 0) break;
      const take = Math.min(lot.left, rest);
      lot.left -= take;
      rest -= take;
    }
  };
  for (const e of ordered) {
    if (e.kind === "PAID") lots.push({ chargeId: e.chargeId, left: e.fn });
    else if (e.kind === "FREE") free += e.fn;
    else if (e.kind === "SPEND") spend(e.fn);
    else {
      const lot = lots.find((l) => l.chargeId === e.chargeId);
      if (lot) lot.left -= Math.min(lot.left, e.fn);
    }
  }
  const tracked = free + lots.reduce((sum, l) => sum + l.left, 0);
  if (tracked > Math.max(0, balance)) spend(tracked - Math.max(0, balance));
  return new Map(lots.map((l) => [l.chargeId, l.left]));
}

// ── Copy ─────────────────────────────────────────────────────────────────────

/** The member's policy summary (refund popup). */
export const REFUND_POLICY_LINES: string[] = [
  `결제일로부터 ${REFUND_WITHDRAWAL_DAYS}일 이내에 요청하고 충전한 FN을 하나도 쓰지 않았다면 전액 취소돼요 (수수료 없음).`,
  `그 밖에는 이 충전에서 남은 FN에서 환불 수수료 ${REFUND_FEE_PERCENT}를 빼고 환불해요. 수수료의 1 FN 미만은 버려요.`,
  "이미 사용한 FN과 출석 보상 · 이벤트로 받은 무료 FN은 환불되지 않아요. 무료 FN을 먼저, 그다음 먼저 충전한 FN부터 쓴 것으로 계산해요.",
  `${REFUND_PROCESSING_TARGET}를 목표로 해요. 원래 결제 수단으로 환불하며, ${REFUND_METHOD_NOTE}돼요.`
];

/** One-line summary for the admin console. */
export const REFUND_POLICY_SUMMARY = `청약철회(결제일로부터 ${REFUND_WITHDRAWAL_DAYS}일 이내 · 미사용) 전액 취소 · 그 밖에는 남은 충전 FN에서 수수료 ${REFUND_FEE_PERCENT}(1 FN 미만 버림) 공제 · 사용한 FN과 무료 FN은 환불 불가 · 무료 FN 먼저, 그다음 오래된 충전부터 사용으로 계산 · ${REFUND_PROCESSING_TARGET} 목표`;

/** "전액 취소 · 30,000 FN" / "수수료 공제 후 환불 · 4,500 FN (남은 5,000 FN − 수수료 500 FN)" */
export function describeRefund(a: RefundAmounts): string {
  return a.type === "FULL_CANCEL"
    ? `${REFUND_TYPE_LABEL.FULL_CANCEL} · ${formatNumber(a.netFn)} FN`
    : `${REFUND_TYPE_LABEL.PARTIAL} · ${formatNumber(a.netFn)} FN (남은 ${formatNumber(a.grossFn)} FN − 수수료 ${formatNumber(a.feeFn)} FN)`;
}
