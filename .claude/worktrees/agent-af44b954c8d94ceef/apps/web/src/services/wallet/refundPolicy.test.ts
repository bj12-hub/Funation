import { describe, expect, it } from "vitest";
import { REFUND_FEE_RATE, REFUND_WITHDRAWAL_DAYS, quoteRefund, refundFee, unusedPaidFn, withinWithdrawalPeriod, type FnLedgerEvent } from "./refundPolicy";

/** 환불 정책 기본값 (일반적인 기준, 법무 검토 전) — the pure rules; refund.test.ts runs them through the services. */
describe("환불 정책 기본값", () => {
  it("keeps the numbers in one place", () => {
    expect([REFUND_WITHDRAWAL_DAYS, REFUND_FEE_RATE]).toEqual([7, 0.1]);
  });

  it("rounds the 10% fee down to a whole FN, in the member's favour", () => {
    expect(refundFee(12_345)).toBe(1_234); // 1,234.5
    expect(refundFee(9)).toBe(0);
    expect(refundFee(19)).toBe(1); // 1.9
    expect(refundFee(70)).toBe(7); // 0.1 × 70 is 7.000000000000001 in floating point
    expect(refundFee(10_000)).toBe(1_000);
    expect(quoteRefund({ chargeFn: 20_000, unusedFn: 12_345, withinPeriod: true })).toEqual({
      type: "PARTIAL",
      chargeFn: 20_000,
      usedFn: 7_655,
      withinPeriod: true,
      grossFn: 12_345,
      feeFn: 1_234,
      netFn: 11_111
    });
  });

  it("cancels the whole charge only within the period and unused; otherwise the unused FN minus the fee; nothing when all used", () => {
    expect(quoteRefund({ chargeFn: 10_000, unusedFn: 10_000, withinPeriod: true })).toMatchObject({ type: "FULL_CANCEL", grossFn: 10_000, feeFn: 0, netFn: 10_000, usedFn: 0 });
    expect(quoteRefund({ chargeFn: 10_000, unusedFn: 10_000, withinPeriod: false })).toMatchObject({ type: "PARTIAL", grossFn: 10_000, feeFn: 1_000, netFn: 9_000 });
    expect(quoteRefund({ chargeFn: 10_000, unusedFn: 9_999, withinPeriod: true })).toMatchObject({ type: "PARTIAL", grossFn: 9_999, feeFn: 999, netFn: 9_000, usedFn: 1 });
    expect(quoteRefund({ chargeFn: 10_000, unusedFn: 0, withinPeriod: true })).toMatchObject({ type: "NOT_REFUNDABLE", grossFn: 0, feeFn: 0, netFn: 0, usedFn: 10_000 });
  });

  it("counts the 청약철회 period in calendar days from the payment date (server time)", () => {
    const paid = "2026-10-01 15:00:00";
    expect(withinWithdrawalPeriod(paid, new Date(2026, 9, 1, 15, 1))).toBe(true);
    expect(withinWithdrawalPeriod(paid, new Date(2026, 9, 8, 23, 59, 59))).toBe(true);
    expect(withinWithdrawalPeriod(paid, new Date(2026, 9, 9, 0, 0, 0))).toBe(false);
    expect(withinWithdrawalPeriod("2026-09-28 10:00:00", new Date(2026, 9, 5, 12))).toBe(true); // across a month end
    expect(withinWithdrawalPeriod("2026-09-28 10:00:00", new Date(2026, 9, 6, 0))).toBe(false);
  });

  describe("FIFO: free FN first, then paid FN oldest charge first", () => {
    const paid = (chargeId: string, at: string, fn: number): FnLedgerEvent => ({ kind: "PAID", chargeId, at, fn });
    const spend = (at: string, fn: number): FnLedgerEvent => ({ kind: "SPEND", at, fn });
    const free = (at: string, fn: number): FnLedgerEvent => ({ kind: "FREE", at, fn });

    it("spends the oldest charge first", () => {
      const left = unusedPaidFn([paid("a", "2026-10-01 10:00:00", 5_000), paid("b", "2026-10-02 10:00:00", 3_000), spend("2026-10-03 10:00:00", 6_000)], 2_000);
      expect([...left]).toEqual([
        ["a", 0],
        ["b", 2_000]
      ]);
    });

    it("spends free FN before paid FN, but only free FN the member had at the time", () => {
      // Free FN received before the spend cover it; the charge stays whole.
      expect(unusedPaidFn([paid("a", "2026-10-01 10:00:00", 1_000), free("2026-10-01 11:00", 500), spend("2026-10-01 12:00:00", 500)], 1_000).get("a")).toBe(1_000);
      // Free FN received after the charge was spent are not a charge's: nothing is refundable.
      expect(unusedPaidFn([paid("a", "2026-10-01 10:00:00", 1_000), spend("2026-10-01 11:00:00", 1_000), free("2026-10-01 12:00", 300)], 300).get("a")).toBe(0);
      // Same second: the credit comes first.
      expect(unusedPaidFn([spend("2026-10-01 10:00:00", 500), free("2026-10-01 10:00:00", 500), paid("a", "2026-10-01 10:00:00", 1_000)], 1_000).get("a")).toBe(1_000);
    });

    it("takes an approved refund from its own charge", () => {
      const left = unusedPaidFn([paid("a", "2026-10-01 10:00:00", 1_000), paid("b", "2026-10-02 10:00:00", 2_000), { kind: "RECLAIM", chargeId: "b", at: "2026-10-03 10:00:00", fn: 2_000 }], 1_000);
      expect([...left]).toEqual([
        ["a", 1_000],
        ["b", 0]
      ]);
    });

    it("keeps the balance authoritative: FN missing from it count as used earlier (free first, oldest charge first)", () => {
      const events = [paid("a", "2026-10-01 10:00:00", 5_000), free("2026-10-01 11:00", 1_000), paid("b", "2026-10-02 10:00:00", 5_000)];
      expect([...unusedPaidFn(events, 7_000)]).toEqual([
        ["a", 2_000],
        ["b", 5_000]
      ]);
      // FN in the balance that no charge explains are not refundable as a charge.
      expect([...unusedPaidFn(events, 50_000)]).toEqual([
        ["a", 5_000],
        ["b", 5_000]
      ]);
      expect([...unusedPaidFn(events, 0)]).toEqual([
        ["a", 0],
        ["b", 0]
      ]);
    });
  });
});
