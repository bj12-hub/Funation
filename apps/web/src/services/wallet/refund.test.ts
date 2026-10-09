import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

const OP = { userId: "adm-test", nickname: "테스트 운영자" };

/** 환불 요청 (code-first): records a request with the refund computed now — no FN moves until an operator approves. */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestChargeRefund, quoteChargeRefund } = await import("./refund");
  const { listChargeRecords } = await import("./walletHistory");
  return { requestChargeRefund, quoteChargeRefund, listChargeRecords, account: mockAccount };
}

describe("충전 환불 요청", () => {
  beforeEach(() => resetMockStores());

  it("records one request for a completed charge without moving FN", async () => {
    const { requestChargeRefund, listChargeRecords, account } = await load();
    const completed = listChargeRecords().find((c) => c.status === "COMPLETED")!;
    const before = account.fnBalance;
    const first = await requestChargeRefund({ chargeId: completed.id, reason: "잘못 충전했어요" });
    expect(first.status).toBe("REQUESTED");
    expect(await requestChargeRefund({ chargeId: completed.id })).toEqual(first); // retry returns the same request
    expect(account.fnBalance).toBe(before);
    expect(listChargeRecords().find((c) => c.id === completed.id)?.refund?.status).toBe("REQUESTED");
  });

  it("keeps who asked, and answers a repeat request with the decision once there is one", async () => {
    const { requestChargeRefund, listChargeRecords, account } = await load();
    const { mockRefunds } = await import("./mockRefundStore");
    const { decideRefund } = await import("@/services/admin/payments");
    const [approved, rejected] = listChargeRecords().filter((c) => c.status === "COMPLETED");
    // The two newest charges are unused (the sample history spent the older ones).
    account.fnBalance = approved.fnAmount + rejected.fnAmount;
    await requestChargeRefund({ chargeId: approved.id });
    await requestChargeRefund({ chargeId: rejected.id });
    // 전액 취소 returns the whole payment (2026-10-08 결정), stored with the request.
    const quote = { type: "FULL_CANCEL", grossFn: approved.fnAmount, feeFn: 0, netFn: approved.fnAmount, refundKrw: approved.paidAmount };
    expect(mockRefunds.requests[0]).toMatchObject({ chargeId: approved.id, memberId: "u-test", accountSince: null, quote });

    expect((await decideRefund(OP, { chargeId: approved.id, decision: "APPROVE", note: "정상 환불", expectedGrossFn: approved.fnAmount, expectedNetFn: approved.fnAmount })).status).toBe("OK");
    expect((await decideRefund(OP, { chargeId: rejected.id, decision: "REJECT", note: "이미 사용한 FN" })).status).toBe("OK");

    // The operator's approval memo stays internal; only a rejection reason reaches the member.
    expect(await requestChargeRefund({ chargeId: approved.id })).toEqual({ status: "APPROVED", requestedAt: mockRefunds.requests[0].requestedAt, decidedAt: expect.any(String), amounts: quote });
    expect(await requestChargeRefund({ chargeId: rejected.id })).toMatchObject({ status: "REJECTED", note: "이미 사용한 FN" });
    expect(account.fnBalance).toBe(rejected.fnAmount);
  });

  it("rejects cancelled / processing / unknown charges, long reasons and signed-out calls", async () => {
    const { requestChargeRefund, quoteChargeRefund, listChargeRecords } = await load();
    const notDone = listChargeRecords().find((c) => c.status !== "COMPLETED")!;
    expect((await requestChargeRefund({ chargeId: notDone.id })).status).toBe("INVALID");
    expect((await quoteChargeRefund({ chargeId: notDone.id })).status).toBe("INVALID");
    expect((await requestChargeRefund({ chargeId: "nope" })).status).toBe("INVALID");
    const done = listChargeRecords().find((c) => c.status === "COMPLETED")!;
    expect((await requestChargeRefund({ chargeId: done.id, reason: "가".repeat(201) })).status).toBe("INVALID");
    expect((await requestChargeRefund({ chargeId: done.id, expectedGrossFn: "1000", expectedNetFn: 1_000 })).status).toBe("INVALID");
    signIn(null);
    expect((await requestChargeRefund({ chargeId: done.id })).status).toBe("UNAUTHORIZED");
    expect((await quoteChargeRefund({ chargeId: done.id })).status).toBe("UNAUTHORIZED");
  });
});

/**
 * 환불 정책 기본값 (일반적인 기준, 법무 검토 전) end to end, on a fresh account (재가입, so the sample history is not
 * its own) with server dates set by fake timers. Days are October 2026, server time.
 */
describe("충전 환불 정책 기본값", () => {
  const on = (day: number, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute, 0);
  let n = 0;

  async function setup() {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(on(1, 9));
    await rejoinWithPhone("010-0000-0000", new Date());
    const { agreeChargeTerms, requestCharge } = await import("./charge");
    const { requestDonation } = await import("@/services/donations/donate");
    const { recordCredit } = await import("./mockCreditStore");
    const { mockRefunds } = await import("./mockRefundStore");
    const payments = await import("@/services/admin/payments");
    const { getWalletOverview } = await import("./walletHistory");
    const { auditEntries } = await import("@/services/admin/auditCore");
    expect((await agreeChargeTerms({ guardian: true, privacy: true, payment: true })).status).toBe("AGREED");
    const m = await load();
    return {
      ...m,
      ...payments,
      mockRefunds,
      getWalletOverview,
      auditEntries,
      /** A completed charge at `when`; returns its id. */
      async charge(fnAmount: number, when: Date) {
        vi.setSystemTime(when);
        const r = await requestCharge({ amount: { customAmount: fnAmount }, methodId: "KAKAO_PAY", idempotencyKey: key(++n) });
        if (r.status !== "COMPLETED") throw new Error(r.status);
        return `ch-${r.transactionId}`;
      },
      /** FN spent on a donation at `when`. */
      async donate(fnAmount: number, when: Date) {
        vi.setSystemTime(when);
        const r = await requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: fnAmount, message: "", voiceId: null, idempotencyKey: key(++n) });
        expect(r.status).toBe("COMPLETED");
      },
      /** Free FN (출석 보상) at `when`, credited like the attendance service does. */
      reward(fnAmount: number, when: Date) {
        vi.setSystemTime(when);
        m.account.fnBalance += fnAmount;
        recordCredit(fnAmount, "출석체크");
      },
      async quote(chargeId: string, when: Date) {
        vi.setSystemTime(when);
        const r = await m.quoteChargeRefund({ chargeId });
        if (r.status !== "QUOTE") throw new Error(r.status);
        return r.quote;
      }
    };
  }

  beforeEach(() => resetMockStores());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("cancels the whole charge without a fee within 7 days when none of its FN was used", async () => {
    const m = await setup();
    const id = await m.charge(10_000, on(1, 15));
    // 10,000 FN were paid 11,000원 (mock price): a 전액 취소 returns all of it.
    expect(await m.quote(id, on(8, 23, 59))).toEqual({ type: "FULL_CANCEL", chargeFn: 10_000, paidKrw: 11_000, usedFn: 0, withinPeriod: true, grossFn: 10_000, feeFn: 0, netFn: 10_000, refundKrw: 11_000 });
    const asked = await m.requestChargeRefund({ chargeId: id, reason: "실수로 충전", expectedGrossFn: 10_000, expectedNetFn: 10_000 });
    expect(asked).toMatchObject({ status: "REQUESTED", amounts: { type: "FULL_CANCEL", grossFn: 10_000, feeFn: 0, netFn: 10_000, refundKrw: 11_000 } });
    expect(m.mockRefunds.requests[0].quote).toEqual({ type: "FULL_CANCEL", grossFn: 10_000, feeFn: 0, netFn: 10_000, refundKrw: 11_000 });
    expect(m.account.fnBalance).toBe(10_000); // nothing moves before an operator approves
  });

  it("refunds an unused charge minus the 10% fee after 7 days", async () => {
    const m = await setup();
    const id = await m.charge(10_000, on(1, 15));
    expect(await m.quote(id, on(9, 0, 0))).toEqual({ type: "PARTIAL", chargeFn: 10_000, paidKrw: 11_000, usedFn: 0, withinPeriod: false, grossFn: 10_000, feeFn: 1_000, netFn: 9_000, refundKrw: 9_900 });
  });

  it("refunds only the unused FN, minus the fee rounded down, when some of the charge was used", async () => {
    const m = await setup();
    const id = await m.charge(10_000, on(1, 15));
    await m.donate(2_345, on(2));
    // 7,655 FN left; the fee 765.5 rounds down to 765. KRW: 6,890 ÷ 10,000 × 11,000 = 7,579.
    expect(await m.quote(id, on(3))).toEqual({ type: "PARTIAL", chargeFn: 10_000, paidKrw: 11_000, usedFn: 2_345, withinPeriod: true, grossFn: 7_655, feeFn: 765, netFn: 6_890, refundKrw: 7_579 });
  });

  it("never refunds free FN: they are spent first, and FN received after the charge was used are not refundable", async () => {
    const m = await setup();
    const a = await m.charge(10_000, on(1, 15));
    m.reward(500, on(2, 9));
    await m.donate(1_000, on(2, 10)); // 500 free FN first, then 500 of the charge
    expect(await m.quote(a, on(3))).toMatchObject({ type: "PARTIAL", usedFn: 500, grossFn: 9_500, feeFn: 950, netFn: 8_550, refundKrw: 9_405 });

    await m.donate(9_500, on(3, 10)); // the rest of the charge
    m.reward(300, on(3, 11)); // the balance is now free FN only
    expect(m.account.fnBalance).toBe(300);
    expect(await m.quote(a, on(4))).toMatchObject({ type: "NOT_REFUNDABLE", usedFn: 10_000, grossFn: 0, netFn: 0 });
    expect(await m.requestChargeRefund({ chargeId: a, expectedGrossFn: 0, expectedNetFn: 0 })).toMatchObject({ status: "NOT_REFUNDABLE", quote: { type: "NOT_REFUNDABLE" } });
    expect(m.mockRefunds.requests).toEqual([]);
  });

  it("gives a failed platform donation's held FN back as they were: the free FN stay free, later free FN too", async () => {
    const m = await setup();
    const { requestPlatformDonation } = await import("@/services/platformDonation/platformDonation");
    const { soopAdapter } = await import("@/services/platformDonation/adapters");
    const { remainingFnPlan } = await import("./refundCore");
    const a = await m.charge(20_000, on(1, 15));
    m.reward(1_000, on(2, 9));
    // 10/3 10:00 a SOOP donation whose result is unknown (PENDING): 10,000 FN held — the 1,000 free FN, then 9,000 of A.
    vi.setSystemTime(on(3, 10));
    vi.spyOn(soopAdapter, "sendDonation").mockRejectedValueOnce(new Error("ECONNRESET"));
    const sent = { platform: "SOOP", creatorId: "gameking", productId: "balloon-10", message: "", idempotencyKey: key(++n) };
    expect(await requestPlatformDonation(sent)).toMatchObject({ status: "PENDING" });
    await m.donate(2_000, on(3, 11)); // while they are held: 2,000 of A
    // 12:00 the re-check finds the platform failed it (게임왕's sends fail on the mock platform): the 10,000 FN come back.
    vi.setSystemTime(on(3, 12));
    expect(await requestPlatformDonation(sent)).toEqual({ status: "FAILED", reason: "API_ERROR" });
    m.reward(500, on(4, 9));
    expect(m.account.fnBalance).toBe(19_500);

    // A 18,000 (20,000 − 2,000 used) + 1,500 free FN. KRW: 16,200 ÷ 20,000 × 22,000 = 17,820.
    expect(await m.quote(a, on(5))).toMatchObject({ type: "PARTIAL", usedFn: 2_000, grossFn: 18_000, feeFn: 1_800, netFn: 16_200, refundKrw: 17_820 });
    expect(remainingFnPlan(on(5))).toMatchObject({ balanceFn: 19_500, lines: [{ chargeId: a, grossFn: 18_000, refundKrw: 17_820 }], forfeitFn: 1_500 });
  });

  it("counts paid FN as used oldest charge first (FIFO)", async () => {
    const m = await setup();
    const older = await m.charge(5_000, on(1, 15));
    const newer = await m.charge(3_000, on(2, 15));
    await m.donate(6_000, on(3));
    expect(await m.quote(older, on(4))).toMatchObject({ type: "NOT_REFUNDABLE", usedFn: 5_000 });
    // The share of the newer charge's own payment (3,000 FN paid 3,300원).
    expect(await m.quote(newer, on(4))).toMatchObject({ type: "PARTIAL", usedFn: 1_000, grossFn: 2_000, feeFn: 200, netFn: 1_800, paidKrw: 3_300, refundKrw: 1_980 });
  });

  it("does not file a request when the outcome changed after the member saw it", async () => {
    const m = await setup();
    const id = await m.charge(10_000, on(1, 15));
    const seen = await m.quote(id, on(2));
    await m.donate(1_000, on(2, 13)); // another tab
    vi.setSystemTime(on(2, 14));
    expect(await m.requestChargeRefund({ chargeId: id, expectedGrossFn: seen.grossFn, expectedNetFn: seen.netFn })).toEqual({
      status: "CHANGED",
      quote: { type: "PARTIAL", chargeFn: 10_000, paidKrw: 11_000, usedFn: 1_000, withinPeriod: true, grossFn: 9_000, feeFn: 900, netFn: 8_100, refundKrw: 8_910 }
    });
    expect(m.mockRefunds.requests).toEqual([]);
  });

  it("recomputes at approval: FN used since the request lower the refund, the console's old amount is refused, only the unused FN are taken back", async () => {
    const m = await setup();
    const id = await m.charge(10_000, on(1, 15));
    vi.setSystemTime(on(2));
    expect(await m.requestChargeRefund({ chargeId: id, reason: "필요 없어요", expectedGrossFn: 10_000, expectedNetFn: 10_000 })).toMatchObject({ amounts: { type: "FULL_CANCEL", netFn: 10_000 } });
    await m.donate(4_000, on(3)); // used after asking
    signIn(["ADMIN"]);
    vi.setSystemTime(on(5));
    const card = (await m.getPaymentsView())!.refunds[0];
    expect(card).toMatchObject({
      requested: { type: "FULL_CANCEL", grossFn: 10_000, feeFn: 0, netFn: 10_000, refundKrw: 11_000 },
      current: { type: "PARTIAL", grossFn: 6_000, feeFn: 600, netFn: 5_400, refundKrw: 5_940 },
      approved: null
    });

    // Approving the amount of the request is refused and says what it is now; nothing moves.
    const stale = await m.decideRefund(OP, { chargeId: id, decision: "APPROVE", note: "정상 환불", expectedGrossFn: 10_000, expectedNetFn: 10_000 });
    expect(stale).toEqual({ status: "INVALID", message: expect.stringContaining("환불 금액이 바뀌었어요") });
    expect(stale.status === "INVALID" && stale.message).toContain("회수 6,000 FN · 수수료 600 FN · 환불 5,400 FN · 5,940원");
    expect(await m.decideRefund(OP, { chargeId: id, decision: "APPROVE", note: "정상 환불" })).toMatchObject({ status: "INVALID" }); // no amount confirmed
    expect(m.account.fnBalance).toBe(6_000);

    expect(await m.decideRefund(OP, { chargeId: id, decision: "APPROVE", note: "정상 환불", expectedGrossFn: 6_000, expectedNetFn: 5_400 })).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(0); // the 6,000 unused FN, not the 10,000 charged
    // The KRW amount is recomputed with the FN at approval and stored with it: 5,400 ÷ 10,000 × 11,000 = 5,940원.
    expect((await m.getPaymentsView())!.refunds[0]).toMatchObject({ status: "APPROVED", approved: { type: "PARTIAL", grossFn: 6_000, feeFn: 600, netFn: 5_400, refundKrw: 5_940 }, current: null });
    expect(m.mockRefunds.requests[0]).toMatchObject({ quote: { refundKrw: 11_000 }, settled: { refundKrw: 5_940 } });
    expect(m.auditEntries().map((e) => e.reason)).toEqual([
      "수수료 공제 후 환불 · 회수 6,000 FN · 수수료 600 FN · 환불 5,400 FN · 5,940원 (요청 때 전액 취소 · 회수 10,000 FN · 수수료 0 FN · 환불 10,000 FN · 11,000원) · 정상 환불"
    ]);

    signIn(["SUPPORTER"]);
    expect(m.listChargeRecords().find((c) => c.id === id)!.refund).toMatchObject({
      status: "APPROVED",
      amounts: { type: "PARTIAL", grossFn: 6_000, feeFn: 600, netFn: 5_400, refundKrw: 5_940 },
      requestedAmounts: { type: "FULL_CANCEL", grossFn: 10_000, feeFn: 0, netFn: 10_000, refundKrw: 11_000 }
    });
    expect((await m.getWalletOverview({ kind: "REFUND", period: "all" }))!.entries).toContainEqual(expect.objectContaining({ id: `${id}-refund`, deltaFn: -6_000 }));
  });

  it("keeps the 청약철회 period of the request while it waits for an operator", async () => {
    const m = await setup();
    const id = await m.charge(10_000, on(1, 15));
    vi.setSystemTime(on(8, 20)); // the last day of the period
    expect(await m.requestChargeRefund({ chargeId: id, expectedGrossFn: 10_000, expectedNetFn: 10_000 })).toMatchObject({ amounts: { type: "FULL_CANCEL" } });
    signIn(["ADMIN"]);
    vi.setSystemTime(on(12)); // approved after the period: still the request's 전액 취소
    expect((await m.getPaymentsView())!.refunds[0].current).toMatchObject({ type: "FULL_CANCEL", withinPeriod: true, grossFn: 10_000, netFn: 10_000 });
    expect(await m.decideRefund(OP, { chargeId: id, decision: "APPROVE", note: "청약철회", expectedGrossFn: 10_000, expectedNetFn: 10_000 })).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(0);
  });

  it("refuses approval once every FN of the charge was used after the request; rejecting still works", async () => {
    const m = await setup();
    const id = await m.charge(2_000, on(1, 15));
    vi.setSystemTime(on(2));
    await m.requestChargeRefund({ chargeId: id, expectedGrossFn: 2_000, expectedNetFn: 2_000 });
    await m.donate(2_000, on(3));
    signIn(["ADMIN"]);
    expect((await m.getPaymentsView())!.refunds[0].current).toMatchObject({ type: "NOT_REFUNDABLE", grossFn: 0 });
    expect(await m.decideRefund(OP, { chargeId: id, decision: "APPROVE", note: "정상 환불", expectedGrossFn: 2_000, expectedNetFn: 2_000 })).toEqual({
      status: "INVALID",
      message: expect.stringContaining("환불할 FN이 없어요")
    });
    expect(m.mockRefunds.requests[0]).toMatchObject({ status: "REQUESTED" });
    expect(await m.decideRefund(OP, { chargeId: id, decision: "REJECT", note: "이미 사용한 FN" })).toEqual({ status: "OK" });
    expect(m.auditEntries().map((e) => e.reason)).toEqual(["충전 2,000 FN · 요청 전액 취소 · 회수 2,000 FN · 수수료 0 FN · 환불 2,000 FN · 2,200원 · 이미 사용한 FN"]);
  });
});
