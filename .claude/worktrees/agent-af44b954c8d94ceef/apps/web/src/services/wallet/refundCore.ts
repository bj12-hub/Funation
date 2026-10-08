import { mockAccount } from "@/services/account/mockStore";
import { currentAccountCredits } from "./mockCreditStore";
import { mockRefunds } from "./mockRefundStore";
import { quoteRefund, unusedPaidFn, withinWithdrawalPeriod, type FnLedgerEvent, type RefundQuote } from "./refundPolicy";
import { listChargeRecords, listDonationRecords } from "./walletHistory";
import type { ChargeRecord, DonationStatus } from "./walletTypes";

/**
 * 충전 환불 계산 (환불 정책 기본값, `refundPolicy.ts`) — server-only, not a "use server" module: the member's refund
 * actions and the admin console's approval both call it, and nothing here awaits, so a caller can check and write in
 * one synchronous step. Covers the signed-in account (the mock's one slot; the backend reads the member's ledger).
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
    ...mockRefunds.requests.flatMap((r): FnLedgerEvent[] => (r.debit && own.has(r.chargeId) ? [{ kind: "RECLAIM", chargeId: r.chargeId, at: r.debit.at, fn: r.debit.fnAmount }] : []))
  ];
  return unusedPaidFn(events, mockAccount.fnBalance);
}

/**
 * The refund outcome of a completed charge of the current account, now. `requestedAt` anchors the 청약철회 period: a
 * request keeps the period it was made in while it waits for an operator, but what is unused is always counted now.
 */
export function chargeRefundQuote(charge: ChargeRecord, requestedAt: Date): RefundQuote {
  const unusedFn = charge.status === "COMPLETED" ? (unusedPaidFnByCharge().get(charge.id) ?? 0) : 0;
  return quoteRefund({ chargeFn: charge.fnAmount, unusedFn, withinPeriod: withinWithdrawalPeriod(charge.chargedAt, requestedAt) });
}
