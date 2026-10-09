import { describe, expect, it } from "vitest";
import {
  REFUND_FEE_RATE,
  REFUND_KRW_RULE,
  REFUND_POLICY_LINES,
  REFUND_WITHDRAWAL_DAYS,
  describeRefund,
  quoteRefund,
  refundFee,
  refundKrw,
  unusedPaidFn,
  withinWithdrawalPeriod,
  type FnLedgerEvent
} from "./refundPolicy";

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
    expect(quoteRefund({ chargeFn: 20_000, paidKrw: 22_000, unusedFn: 12_345, withinPeriod: true })).toEqual({
      type: "PARTIAL",
      chargeFn: 20_000,
      paidKrw: 22_000,
      usedFn: 7_655,
      withinPeriod: true,
      grossFn: 12_345,
      feeFn: 1_234,
      netFn: 11_111,
      refundKrw: 12_222 // 11,111 ÷ 20,000 × 22,000 = 12,222.1
    });
  });

  it("cancels the whole charge only within the period and unused; otherwise the unused FN minus the fee; nothing when all used", () => {
    const paid = { chargeFn: 10_000, paidKrw: 11_000 };
    expect(quoteRefund({ ...paid, unusedFn: 10_000, withinPeriod: true })).toMatchObject({ type: "FULL_CANCEL", grossFn: 10_000, feeFn: 0, netFn: 10_000, usedFn: 0, refundKrw: 11_000 });
    expect(quoteRefund({ ...paid, unusedFn: 10_000, withinPeriod: false })).toMatchObject({ type: "PARTIAL", grossFn: 10_000, feeFn: 1_000, netFn: 9_000, refundKrw: 9_900 });
    expect(quoteRefund({ ...paid, unusedFn: 9_999, withinPeriod: true })).toMatchObject({ type: "PARTIAL", grossFn: 9_999, feeFn: 999, netFn: 9_000, usedFn: 1, refundKrw: 9_900 });
    expect(quoteRefund({ ...paid, unusedFn: 0, withinPeriod: true })).toMatchObject({ type: "NOT_REFUNDABLE", grossFn: 0, feeFn: 0, netFn: 0, usedFn: 10_000, refundKrw: 0 });
  });

  describe("원화 환불 금액 (2026-10-08 결정)", () => {
    it("refunds a partial refund's share of the paid amount: net FN ÷ the charge's FN × its paid KRW", () => {
      // The decision's example: 30,000 FN bought for 33,000원, 4,500 FN refunded.
      expect(refundKrw("PARTIAL", { netFn: 4_500, chargeFn: 30_000, paidKrw: 33_000 })).toBe(4_950);
      expect(quoteRefund({ chargeFn: 30_000, paidKrw: 33_000, unusedFn: 5_000, withinPeriod: false })).toMatchObject({ type: "PARTIAL", grossFn: 5_000, feeFn: 500, netFn: 4_500, refundKrw: 4_950 });
      // Any price: the share follows what this charge was paid, not a rate.
      expect(refundKrw("PARTIAL", { netFn: 2_700, chargeFn: 10_000, paidKrw: 9_900 })).toBe(2_673);
      expect(REFUND_KRW_RULE).toBe("환불 FN ÷ 충전 FN × 결제 금액, 원 미만 버림");
    });

    it("rounds down to the won, also where floating point would land on the next won", () => {
      expect(refundKrw("PARTIAL", { netFn: 1, chargeFn: 3, paidKrw: 10 })).toBe(3); // 3.33…
      expect(refundKrw("PARTIAL", { netFn: 2, chargeFn: 3, paidKrw: 10 })).toBe(6); // 6.66…
      expect(refundKrw("PARTIAL", { netFn: 999, chargeFn: 1_000, paidKrw: 1_099 })).toBe(1_097); // 1,097.901
      expect(refundKrw("PARTIAL", { netFn: 6_890, chargeFn: 10_000, paidKrw: 11_000 })).toBe(7_579); // 7,579 exactly
      // 0.29 × 100 is 28.999999999999996 in floating point; the exact share is 29.
      expect(refundKrw("PARTIAL", { netFn: 29, chargeFn: 100, paidKrw: 100 })).toBe(29);
      // Large amounts stay exact: 999,999,999 FN paid 1,099,999,999원, all but 1 FN refunded.
      expect(refundKrw("PARTIAL", { netFn: 999_999_998, chargeFn: 999_999_999, paidKrw: 1_099_999_999 })).toBe(1_099_999_997);
    });

    it("cancels the whole payment on a 전액 취소 and refunds nothing without FN or payment", () => {
      expect(refundKrw("FULL_CANCEL", { netFn: 10_000, chargeFn: 10_000, paidKrw: 11_000 })).toBe(11_000);
      expect(refundKrw("FULL_CANCEL", { netFn: 3_000, chargeFn: 3_000, paidKrw: 3_333 })).toBe(3_333); // not 3,000 × a rate
      expect(refundKrw("PARTIAL", { netFn: 0, chargeFn: 10_000, paidKrw: 11_000 })).toBe(0);
      expect(refundKrw("PARTIAL", { netFn: 5_000, chargeFn: 10_000, paidKrw: 0 })).toBe(0);
    });

    it("states the KRW amount in the member's copy", () => {
      expect(describeRefund({ type: "PARTIAL", grossFn: 5_000, feeFn: 500, netFn: 4_500, refundKrw: 4_950 })).toBe("수수료 공제 후 환불 · 4,500 FN · 4,950원 (남은 5,000 FN − 수수료 500 FN)");
      expect(describeRefund({ type: "FULL_CANCEL", grossFn: 30_000, feeFn: 0, netFn: 30_000, refundKrw: 33_000 })).toBe("전액 취소 · 30,000 FN · 33,000원");
      expect(REFUND_POLICY_LINES.join("\n")).toContain("원 미만 버림");
      expect(REFUND_POLICY_LINES.join("\n")).toContain("결제 수단별 환불 방식은 결제 대행사 연동 후 확정");
    });
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

    it("writes off only free FN on a FORFEIT (남은 FN 정리), never a charge's", () => {
      const events: FnLedgerEvent[] = [
        paid("a", "2026-10-01 10:00:00", 5_000),
        free("2026-10-01 11:00", 1_000),
        { kind: "RECLAIM", chargeId: "a", at: "2026-10-05 10:00:00", fn: 5_000 },
        { kind: "FORFEIT", at: "2026-10-05 10:00:00", fn: 1_000 },
        // Later a quest refund gives 2,000 FN back: they were never spent, so nothing of the charge is unused again.
        free("2026-10-06 10:00", 2_000)
      ];
      expect([...unusedPaidFn(events, 2_000)]).toEqual([["a", 0]]);
      // A FORFEIT larger than the free FN left does not touch the charge.
      expect([...unusedPaidFn([paid("a", "2026-10-01 10:00:00", 5_000), { kind: "FORFEIT", at: "2026-10-02 10:00:00", fn: 800 }], 5_000)]).toEqual([["a", 5_000]]);
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
