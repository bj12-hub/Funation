import { mockAccount } from "@/services/account/mockStore";
import { currentAccountCredits } from "./mockCreditStore";
import { currentAccountFnSettlements } from "./mockFnSettlementStore";
import { mockRefunds } from "./mockRefundStore";
import { mockWallet } from "./mockWalletStore";
import { quoteRefund, refundAmounts, unusedPaidFn, withinWithdrawalPeriod, type ChargeRefundLine, type FnLedgerEvent, type RefundQuote } from "./refundPolicy";
import { listChargeRecords, listDonationRecords } from "./walletHistory";
import type { ChargeRecord, DonationStatus } from "./walletTypes";

/**
 * 충전 환불 계산 (환불 정책 기본값, `refundPolicy.ts`) — server-only, not a "use server" module: the member's refund
 * actions, the admin console's approval and 남은 FN 정리 all call it, and nothing here awaits, so a caller can check and
 * write in one synchronous step. Covers the signed-in account (the mock's one slot; the backend reads the member's ledger).
 */

/** Donations whose FN are spent or held. A failed one never took FN; a refunded one took them and gave them back. */
const SPENT: ReadonlySet<DonationStatus> = new Set<DonationStatus>(["COMPLETED", "PROCESSING", "REFUNDING"]);

/**
 * When a charge's paid FN landed in the balance, or null when they never did. A 처리중 charge confirmed later (결제 확인 —
 * the console's 처리 중 충전, 2026-10-12 결정, `chargeCore.confirmChargePayment`) got them at its confirmation, not when
 * it was requested; one confirmed after its account withdrew got none (FN 미지급), nor did a 처리중 or 결제 취소 charge.
 */
function creditedAt(c: ChargeRecord): string | null {
  if (c.status !== "COMPLETED") return null;
  if (!Object.hasOwn(mockWallet.seedChargeResults, c.id)) return c.chargedAt;
  const confirmed = mockWallet.seedChargeResults[c.id];
  return confirmed.fnCredited ? confirmed.at : null;
}

/**
 * FIFO: the paid FN of each charge of the current account still unused at `now` (free FN spent first, then oldest charge
 * first; FN the records do not explain settled oldest-received first — `unusedPaidFn`).
 */
export function unusedPaidFnByCharge(now = new Date()): Map<string, number> {
  const charges = listChargeRecords();
  const own = new Set(charges.map((c) => c.id));
  const events: FnLedgerEvent[] = [
    // A charge's paid FN are received when they landed; a 결제 취소 or still 처리중 charge brought none.
    ...charges.flatMap((c): FnLedgerEvent[] => {
      const at = creditedAt(c);
      return at ? [{ kind: "PAID", chargeId: c.id, at, fn: c.fnAmount }] : [];
    }),
    ...currentAccountCredits().map((c): FnLedgerEvent => ({ kind: "FREE", at: c.at, fn: c.fnAmount })),
    // A refunded donation (퀘스트 실패 · 취소, a platform donation that failed) spent or held its FN when it was sent and
    // gave the same FN back at the refund — dated like its FN Wallet 환불 row (sample rows without a time: at the donation).
    ...listDonationRecords().flatMap((d): FnLedgerEvent[] => {
      const spend: FnLedgerEvent = { kind: "SPEND", id: d.id, at: d.donatedAt, fn: d.fnAmount };
      if (SPENT.has(d.status)) return [spend];
      return d.status === "REFUNDED" ? [spend, { kind: "RETURN", spendId: d.id, at: d.refundedAt ?? d.donatedAt, fn: d.fnAmount }] : [];
    }),
    ...mockRefunds.requests.flatMap((r): FnLedgerEvent[] => (r.debit && own.has(r.chargeId) ? [{ kind: "RECLAIM", chargeId: r.chargeId, at: r.debit.at, fn: r.debit.fnAmount }] : [])),
    // 남은 FN 정리 (영구 정지): each charge's refund takes its paid FN back; the free FN it wrote off are gone too.
    ...currentAccountFnSettlements().flatMap((s): FnLedgerEvent[] => {
      const forfeit: FnLedgerEvent = { kind: "FORFEIT", at: s.ledgerAt, fn: s.forfeitFn };
      const reclaims = s.lines.filter((l) => own.has(l.chargeId)).map((l): FnLedgerEvent => ({ kind: "RECLAIM", chargeId: l.chargeId, at: s.ledgerAt, fn: l.grossFn }));
      return s.forfeitFn > 0 ? [...reclaims, forfeit] : reclaims;
    })
  ];
  return unusedPaidFn(events, mockAccount.fnBalance, now);
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
  const unused = unusedPaidFnByCharge(now);
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
