import { mockAccount } from "@/services/account/mockStore";
import { currentAccountCredits } from "./mockCreditStore";
import { currentAccountFnSettlements } from "./mockFnSettlementStore";
import { mockRefunds } from "./mockRefundStore";
import { quoteRefund, refundAmounts, unusedPaidFn, withinWithdrawalPeriod, type ChargeRefundLine, type FnLedgerEvent, type RefundQuote } from "./refundPolicy";
import { listChargeRecords, listDonationRecords } from "./walletHistory";
import type { ChargeRecord, DonationStatus } from "./walletTypes";

/**
 * 충전 환불 계산 (환불 정책 기본값, `refundPolicy.ts`) — server-only, not a "use server" module: the member's refund
 * actions, the admin console's approval and 남은 FN 정리 all call it, and nothing here awaits, so a caller can check and
 * write in one synchronous step. Covers the signed-in account (the mock's one slot; the backend reads the member's ledger).
 */

/** Donations whose FN are spent or held: a failed one never took FN, a refunded one (e.g. a failed quest) gave them back. */
const SPENT: ReadonlySet<DonationStatus> = new Set<DonationStatus>(["COMPLETED", "PROCESSING", "REFUNDING"]);

/** FIFO: the paid FN of each charge of the current account still unused (free FN spent first, then oldest charge first). */
export function unusedPaidFnByCharge(): Map<string, number> {
  const charges = listChargeRecords();
  const own = new Set(charges.map((c) => c.id));
  const events: FnLedgerEvent[] = [
    ...charges.filter((c) => c.status === "COMPLETED").map((c): FnLedgerEvent => ({ kind: "PAID", chargeId: c.id, at: c.chargedAt, fn: c.fnAmount })),
    ...currentAccountCredits().map((c): FnLedgerEvent => ({ kind: "FREE", at: c.at, fn: c.fnAmount })),
    ...listDonationRecords()
      .filter((d) => SPENT.has(d.status))
      .map((d): FnLedgerEvent => ({ kind: "SPEND", at: d.donatedAt, fn: d.fnAmount })),
    ...mockRefunds.requests.flatMap((r): FnLedgerEvent[] => (r.debit && own.has(r.chargeId) ? [{ kind: "RECLAIM", chargeId: r.chargeId, at: r.debit.at, fn: r.debit.fnAmount }] : [])),
    // 남은 FN 정리 (영구 정지): each charge's refund takes its paid FN back; the free FN it wrote off are gone too.
    ...currentAccountFnSettlements().flatMap((s): FnLedgerEvent[] => {
      const forfeit: FnLedgerEvent = { kind: "FORFEIT", at: s.ledgerAt, fn: s.forfeitFn };
      const reclaims = s.lines.filter((l) => own.has(l.chargeId)).map((l): FnLedgerEvent => ({ kind: "RECLAIM", chargeId: l.chargeId, at: s.ledgerAt, fn: l.grossFn }));
      return s.forfeitFn > 0 ? [...reclaims, forfeit] : reclaims;
    })
  ];
  return unusedPaidFn(events, mockAccount.fnBalance);
}

/** The policy outcome of a charge, given its unused paid FN (KRW from what the charge was paid). */
const quoteOf = (charge: ChargeRecord, unusedFn: number, requestedAt: Date): RefundQuote =>
  quoteRefund({ chargeFn: charge.fnAmount, paidKrw: charge.paidAmount, unusedFn, withinPeriod: withinWithdrawalPeriod(charge.chargedAt, requestedAt) });

/**
 * The refund outcome of a completed charge of the current account, now. `requestedAt` anchors the 청약철회 period: a
 * request keeps the period it was made in while it waits for an operator, but what is unused is always counted now.
 */
export function chargeRefundQuote(charge: ChargeRecord, requestedAt: Date): RefundQuote {
  const unusedFn = charge.status === "COMPLETED" ? (unusedPaidFnByCharge().get(charge.id) ?? 0) : 0;
  return quoteOf(charge, unusedFn, requestedAt);
}

/**
 * 남은 FN 정리 of the current account at `now` (영구 정지, 2026-10-08 결정): every completed charge with unused paid FN is
 * refunded under the policy — 전액 취소 when it is still in its 청약철회 period and unused, otherwise 수수료 공제 후 환불 —
 * oldest charge first; `forfeitFn` is the rest of the balance (free FN, and FN no charge explains), which is written off.
 */
export function remainingFnPlan(now: Date): { balanceFn: number; lines: ChargeRefundLine[]; forfeitFn: number } {
  const unused = unusedPaidFnByCharge();
  const balanceFn = Math.max(0, mockAccount.fnBalance);
  const lines = listChargeRecords()
    .filter((c) => c.status === "COMPLETED" && (unused.get(c.id) ?? 0) > 0)
    .sort((a, b) => a.chargedAt.localeCompare(b.chargedAt))
    .flatMap((c): ChargeRefundLine[] => {
      const amounts = refundAmounts(quoteOf(c, unused.get(c.id) ?? 0, now));
      return amounts ? [{ chargeId: c.id, chargedAt: c.chargedAt, methodLabel: c.methodLabel, chargeFn: c.fnAmount, paidKrw: c.paidAmount, ...amounts }] : [];
    });
  const refundedFn = lines.reduce((sum, l) => sum + l.grossFn, 0);
  return { balanceFn, lines, forfeitFn: Math.max(0, balanceFn - refundedFn) };
}
