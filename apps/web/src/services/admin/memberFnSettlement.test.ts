import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, signIn } from "@/test/mockEnv";
import type { MemberFnSettlement } from "./memberTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** The operator the admin API acts for (the route layer authorises the admin app first). */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };
const NOTE = "회원 요청 (1:1 문의)";
const HELD = "보류 중인 환불 요청이 있어 남은 FN을 정리할 수 없어요. 결제 · 환불에서 보류를 해제하고 그 요청을 먼저 처리해 주세요.";
const WAITING = "심사 대기 중인 환불 요청이 있어 남은 FN을 정리할 수 없어요. 결제 · 환불에서 그 요청을 먼저 승인 · 거절해 주세요.";

/**
 * 남은 FN 정리 (2026-10-08 결정): a 영구 정지 member cannot sign in, so on request an operator refunds the remaining paid FN
 * per charge under the 환불 정책 기본값 and the free FN are forfeited. Runs on a fresh account (재가입, so the sample
 * history is not its own) with server dates set by fake timers; days are October 2026, server time.
 */
describe("남은 FN 정리 (영구 정지)", () => {
  const on = (day: number, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute, 0);
  let n = 0;

  async function setup() {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(on(1, 9));
    await rejoinWithPhone("010-0000-0000", new Date());
    const { agreeChargeTerms, requestCharge } = await import("@/services/wallet/charge");
    const { requestDonation } = await import("@/services/donations/donate");
    const { recordCredit } = await import("@/services/wallet/mockCreditStore");
    const { mockFnSettlements } = await import("@/services/wallet/mockFnSettlementStore");
    const { requestChargeRefund } = await import("@/services/wallet/refund");
    const { unusedPaidFnByCharge } = await import("@/services/wallet/refundCore");
    const { getWalletOverview, listChargeRecords } = await import("@/services/wallet/walletHistory");
    const { mockAccount } = await import("@/services/account/mockStore");
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    const { purgeExpired } = await import("@/services/account/retentionPurge");
    const members = await import("./members");
    const payments = await import("./payments");
    const core = await import("./memberCore");
    const { auditEntries } = await import("./auditCore");
    expect((await agreeChargeTerms({ guardian: true, privacy: true, payment: true })).status).toBe("AGREED");

    const card = async (when: Date) => {
      vi.setSystemTime(when);
      return (await members.getMemberDetail(core.SAMPLE_MEMBER_ID))!.fnSettlement;
    };
    return {
      ...members,
      ...payments,
      ...core,
      account: mockAccount,
      mockFnSettlements,
      requestChargeRefund,
      unusedPaidFnByCharge,
      getWalletOverview,
      listChargeRecords,
      recordWithdrawal,
      purgeExpired,
      auditEntries,
      card,
      /** A completed charge at `when`; returns its id. */
      async charge(fnAmount: number, when: Date) {
        vi.setSystemTime(when);
        const r = await requestCharge({ amount: { customAmount: fnAmount }, methodId: "KAKAO_PAY", idempotencyKey: key(++n) });
        if (r.status !== "COMPLETED") throw new Error(r.status);
        return `ch-${r.transactionId}`;
      },
      async donate(fnAmount: number, when: Date) {
        vi.setSystemTime(when);
        const r = await requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: fnAmount, message: "", voiceId: null, idempotencyKey: key(++n) });
        expect(r.status).toBe("COMPLETED");
      },
      /** Free FN (출석 보상) at `when`, credited like the attendance service does. */
      reward(fnAmount: number, when: Date) {
        vi.setSystemTime(when);
        mockAccount.fnBalance += fnAmount;
        recordCredit(fnAmount, "출석체크");
      },
      /** 이용 정지 of the slot member: `days` null = 영구 정지. */
      async suspend(days: 1 | 7 | 30 | null, when: Date) {
        vi.setSystemTime(when);
        expect(await members.suspendMember(OP, { id: core.SAMPLE_MEMBER_ID, days, reason: "결제 도용 확인 (테스트)", requestId: key(++n) })).toEqual({ status: "OK" });
      },
      /** 남은 FN 정리 at `when` with the totals of `seen` (the card the console showed), or of the card at `when`. */
      async settle(when: Date, requestId: string, seen?: MemberFnSettlement | null) {
        const plan = seen === undefined ? await card(when) : seen;
        vi.setSystemTime(when);
        return members.settleMemberFn(OP, {
          id: core.SAMPLE_MEMBER_ID,
          note: NOTE,
          requestId,
          expectedGrossFn: plan?.total.grossFn,
          expectedNetFn: plan?.total.netFn,
          expectedRefundKrw: plan?.total.refundKrw,
          expectedForfeitFn: plan?.forfeitFn
        });
      }
    };
  }

  /**
   * 10/1 charge A 10,000 FN (11,000원) · 10/2 500 free FN · 10/3 a 3,000 FN donation (the 500 free FN, then 2,500 of A) ·
   * 10/5 charge B 5,000 FN (5,500원) · 10/6 300 free FN. Balance 12,800 FN: A 7,500 + B 5,000 paid, 300 free.
   */
  async function history() {
    const m = await setup();
    const a = await m.charge(10_000, on(1, 15));
    m.reward(500, on(2, 9));
    await m.donate(3_000, on(3, 10));
    const b = await m.charge(5_000, on(5, 15));
    m.reward(300, on(6, 9));
    expect(m.account.fnBalance).toBe(12_800);
    signIn(["ADMIN"]);
    return { m, a, b };
  }
  const settledTotals = (m: Awaited<ReturnType<typeof setup>>) => m.auditEntries().filter((e) => e.action === "MEMBER_FN_SETTLE");

  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("keeps the FN of a member suspended for a period: no 정리 is offered or processed", async () => {
    const { m } = await history();
    await m.suspend(30, on(8));
    expect(m.account.fnBalance).toBe(12_800);
    expect(await m.card(on(8))).toBeNull();
    // Even with the amounts a 영구 정지 card would show, a member suspended for a period is not settled.
    const shown: MemberFnSettlement = { status: "READY", blocked: null, balanceFn: 12_800, lines: [], total: { grossFn: 12_500, feeFn: 750, netFn: 11_750, refundKrw: 12_925 }, forfeitFn: 300, history: [] };
    expect(await m.settle(on(8), key(900), shown)).toEqual({ status: "INVALID", message: "영구 정지된 회원만 남은 FN을 정리할 수 있어요." });
    expect(m.account.fnBalance).toBe(12_800);
    expect(settledTotals(m)).toEqual([]);
  });

  it("computes the 정리 per charge under the refund policy: FIFO, 전액 취소 within the period, free FN forfeited", async () => {
    const { m, a, b } = await history();
    await m.suspend(null, on(8));
    expect(m.account.fnBalance).toBe(12_800); // the suspension itself takes nothing
    expect(await m.card(on(8))).toEqual({
      status: "READY",
      blocked: null,
      balanceFn: 12_800,
      lines: [
        // A: 2,500 of it were used, so 수수료 공제 후 환불 — 6,750 ÷ 10,000 × 11,000원 = 7,425원.
        { chargeId: a, chargedAt: expect.any(String), methodLabel: "카카오페이", chargeFn: 10_000, paidKrw: 11_000, type: "PARTIAL", grossFn: 7_500, feeFn: 750, netFn: 6_750, refundKrw: 7_425 },
        // B: unused and still within 7 days of payment — 전액 취소, the whole 5,500원.
        { chargeId: b, chargedAt: expect.any(String), methodLabel: "카카오페이", chargeFn: 5_000, paidKrw: 5_500, type: "FULL_CANCEL", grossFn: 5_000, feeFn: 0, netFn: 5_000, refundKrw: 5_500 }
      ],
      total: { grossFn: 12_500, feeFn: 750, netFn: 11_750, refundKrw: 12_925 },
      forfeitFn: 300,
      history: []
    });
    // After B's 청약철회 period it is a 수수료 공제 후 환불 too: 4,500 FN → 4,950원.
    expect((await m.card(on(13)))!.lines[1]).toMatchObject({ chargeId: b, type: "PARTIAL", grossFn: 5_000, feeFn: 500, netFn: 4_500, refundKrw: 4_950 });
  });

  it("refunds each charge into the wallet history, forfeits the free FN, zeroes the balance and writes MEMBER_FN_SETTLE", async () => {
    const { m, a, b } = await history();
    await m.suspend(null, on(8));
    expect(await m.settle(on(8, 13), key(901))).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(0);
    expect(m.mockFnSettlements.settlements).toEqual([
      expect.objectContaining({
        requestId: key(901),
        memberId: m.SAMPLE_MEMBER_ID,
        by: OP.nickname,
        note: NOTE,
        balanceFn: 12_800,
        forfeitFn: 300,
        lines: [expect.objectContaining({ chargeId: a, grossFn: 7_500, refundKrw: 7_425 }), expect.objectContaining({ chargeId: b, grossFn: 5_000, refundKrw: 5_500 })]
      })
    ]);
    expect(m.auditEntries().map((e) => [e.action, e.target, e.reason])).toEqual([
      ["MEMBER_FN_SETTLE", `member:${m.SAMPLE_MEMBER_ID}`, `환불 2건 · 회수 12,500 FN · 수수료 750 FN · 환불 11,750 FN · 12,925원 · 무상 FN 소멸 300 FN · ${NOTE}`],
      ["MEMBER_SUSPEND", `member:${m.SAMPLE_MEMBER_ID}`, "영구 · 결제 도용 확인 (테스트)"]
    ]);
    // Nothing of either charge is unused any more, and the card has nothing left (with the 정리 in its 이력).
    expect([...m.unusedPaidFnByCharge().values()]).toEqual([0, 0]);
    expect(await m.card(on(8, 14))).toMatchObject({ status: "EMPTY", balanceFn: 0, lines: [], forfeitFn: 0, history: [{ by: OP.nickname, note: NOTE, forfeitFn: 300 }] });
    expect((await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.audit.map((e) => e.action)).toEqual(["MEMBER_FN_SETTLE", "MEMBER_SUSPEND"]);

    // The wallet records (what the member sees if the suspension is ever lifted): a 환불 row per charge, one 소멸 row.
    signIn(["SUPPORTER"]);
    const rows = (await m.getWalletOverview({ period: "all" }))!.entries;
    expect(rows.filter((e) => e.description.endsWith("남은 FN 정리")).map((e) => [e.kind, e.description, e.deltaFn, e.statusLabel])).toEqual([
      ["REFUND", "충전 환불 · 카카오페이 · 남은 FN 정리", -7_500, "환불완료"],
      ["REFUND", "충전 환불 · 카카오페이 · 남은 FN 정리", -5_000, "환불완료"],
      ["FORFEIT", "무상 FN 소멸 · 남은 FN 정리", -300, "소멸"]
    ]);
    expect(rows.filter((e) => e.id === a || e.id === b).map((e) => e.statusLabel)).toEqual(["환불완료", "환불완료"]);
    expect(rows.reduce((sum, e) => sum + e.deltaFn, 0)).toBe(0); // every balance change has its row
    expect((await m.getWalletOverview({ kind: "REFUND", period: "all" }))!.entries).toHaveLength(2);
    expect(m.listChargeRecords().find((c) => c.id === a)!.refund).toMatchObject({ status: "APPROVED", amounts: { type: "PARTIAL", grossFn: 7_500, netFn: 6_750, refundKrw: 7_425 } });
  });

  it("processes one 정리 per request id: a retry answers OK without a second change or log entry", async () => {
    const { m } = await history();
    await m.suspend(null, on(8));
    const seen = await m.card(on(8, 13));
    expect(await Promise.all([m.settle(on(8, 13), key(902), seen), m.settle(on(8, 13), key(902), seen)])).toEqual([{ status: "OK" }, { status: "OK" }]);
    expect(await m.settle(on(8, 14), key(902), seen)).toEqual({ status: "OK" }); // a later retry
    // The same request id with another memo or other amounts is not that 정리: refused, nothing more is written.
    const replay = (over: Record<string, unknown>) =>
      m.settleMemberFn(OP, {
        id: m.SAMPLE_MEMBER_ID,
        note: NOTE,
        requestId: key(902),
        expectedGrossFn: seen!.total.grossFn,
        expectedNetFn: seen!.total.netFn,
        expectedRefundKrw: seen!.total.refundKrw,
        expectedForfeitFn: seen!.forfeitFn,
        ...over
      });
    expect(await replay({ note: ` ${NOTE} ` })).toEqual({ status: "OK" }); // the memo as stored (trimmed)
    expect(await replay({ note: "다른 메모로 다시 정리" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await replay({ expectedGrossFn: 0 })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await replay({ expectedRefundKrw: seen!.total.refundKrw + 1 })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await replay({ expectedForfeitFn: undefined })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(m.mockFnSettlements.settlements).toHaveLength(1);
    expect(m.mockFnSettlements.settlements[0].note).toBe(NOTE);
    expect(settledTotals(m)).toHaveLength(1);
    expect(m.account.fnBalance).toBe(0);
    // A new request finds nothing left; the same id for another member is not this 정리.
    expect(await m.settle(on(8, 15), key(903), seen)).toEqual({ status: "INVALID", message: "정리할 FN이 없어요." });
    expect(await m.settleMemberFn(OP, { id: "u-s001", note: NOTE, requestId: key(902), expectedGrossFn: 0, expectedNetFn: 0, expectedRefundKrw: 0, expectedForfeitFn: 0 })).toEqual({
      status: "INVALID",
      message: "잘못된 요청입니다."
    });
    expect(m.mockFnSettlements.settlements).toHaveLength(1);
  });

  it("refuses amounts that changed since the console showed them (a 청약철회 period ended), writing nothing", async () => {
    const { m } = await history();
    await m.suspend(null, on(8));
    const seen = await m.card(on(12, 23));
    expect(seen!.total).toEqual({ grossFn: 12_500, feeFn: 750, netFn: 11_750, refundKrw: 12_925 });
    const late = await m.settle(on(13, 0, 1), key(904), seen);
    expect(late).toEqual({ status: "INVALID", message: expect.stringContaining("정리할 금액이 바뀌었어요") });
    // B is now a 수수료 공제 후 환불: 7,425원 + 4,950원.
    expect(late.status === "INVALID" && late.message).toContain("환불 2건 · 회수 12,500 FN · 수수료 1,250 FN · 환불 11,250 FN · 12,375원 · 무상 FN 소멸 300 FN");
    expect(m.account.fnBalance).toBe(12_800);
    expect(settledTotals(m)).toEqual([]);
    expect(await m.settle(on(13, 0, 2), key(905))).toEqual({ status: "OK" }); // with the amounts shown now
    expect(m.mockFnSettlements.settlements[0].lines.map((l) => [l.type, l.refundKrw])).toEqual([
      ["PARTIAL", 7_425],
      ["PARTIAL", 4_950]
    ]);
  });

  it("waits for the member's refund requests: blocked while one is on 보류 or waiting, with a clear message", async () => {
    const { m, b } = await history();
    signIn(["SUPPORTER"]);
    vi.setSystemTime(on(7));
    expect((await m.requestChargeRefund({ chargeId: b, reason: "실수로 충전" })).status).toBe("REQUESTED");
    signIn(["ADMIN"]);
    await m.suspend(null, on(8));
    expect(await m.holdRefund(OP, { chargeId: b, action: "HOLD", note: "결제 도용 확인 중", requestId: key(906) })).toEqual({ status: "OK" });

    expect(await m.card(on(8))).toMatchObject({ status: "BLOCKED", blocked: HELD, total: { grossFn: 12_500 } });
    expect(await m.settle(on(8), key(907))).toEqual({ status: "INVALID", message: HELD });
    expect(await m.holdRefund(OP, { chargeId: b, action: "RELEASE", note: "확인 완료", requestId: key(908) })).toEqual({ status: "OK" });
    expect(await m.card(on(8))).toMatchObject({ status: "BLOCKED", blocked: WAITING });
    expect(await m.settle(on(8), key(909))).toEqual({ status: "INVALID", message: WAITING });
    expect(m.account.fnBalance).toBe(12_800);
    expect(settledTotals(m)).toEqual([]);

    // Once the request is decided (approved: B's 5,000 FN back as a 전액 취소), the rest can be settled.
    expect(await m.decideRefund(OP, { chargeId: b, decision: "APPROVE", note: "정상 환불", expectedGrossFn: 5_000, expectedNetFn: 5_000 })).toEqual({ status: "OK" });
    expect(await m.card(on(8))).toMatchObject({ status: "READY", blocked: null, balanceFn: 7_800, lines: [{ type: "PARTIAL", grossFn: 7_500, refundKrw: 7_425 }], forfeitFn: 300 });
    expect(await m.settle(on(8), key(910))).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(0);
  });

  it("refuses a member who is not 영구 정지, a bad request id, memo or amounts, a member without a wallet ledger and an unknown one", async () => {
    const { m } = await history();
    const ok = { id: m.SAMPLE_MEMBER_ID, note: NOTE, requestId: key(911), expectedGrossFn: 12_500, expectedNetFn: 11_750, expectedRefundKrw: 12_925, expectedForfeitFn: 300 };
    vi.setSystemTime(on(8));
    expect(await m.settleMemberFn(OP, ok)).toEqual({ status: "INVALID", message: "영구 정지된 회원만 남은 FN을 정리할 수 있어요." });
    await m.suspend(null, on(8));
    expect(await m.settleMemberFn(OP, { ...ok, requestId: "short" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await m.settleMemberFn(OP, { ...ok, note: " " })).toEqual({ status: "INVALID", message: "처리 메모를 2~200자로 입력해 주세요." });
    expect(await m.settleMemberFn(OP, { ...ok, expectedForfeitFn: undefined })).toEqual({ status: "INVALID", message: "정리할 금액을 확인해 주세요. 화면을 새로 고친 뒤 다시 처리해 주세요." });
    expect(await m.settleMemberFn(OP, { ...ok, expectedNetFn: 1.5 })).toMatchObject({ status: "INVALID" });
    expect(await m.settleMemberFn(OP, { ...ok, id: "nope" })).toEqual({ status: "NOT_FOUND" });

    // A generated member has a balance but no wallet ledger in the mock: shown as such, never settled.
    expect(await m.suspendMember(OP, { id: "u-s002", days: null, reason: "결제 도용 확인 (테스트)", requestId: key(912) })).toEqual({ status: "OK" });
    expect((await m.getMemberDetail("u-s002"))!.fnSettlement).toMatchObject({ status: "NO_LEDGER", lines: [] });
    expect(await m.settleMemberFn(OP, { ...ok, id: "u-s002", requestId: key(913) })).toEqual({ status: "INVALID", message: expect.stringContaining("지갑 기록이 없어") });

    expect(m.account.fnBalance).toBe(12_800);
    expect(settledTotals(m)).toEqual([]);
    expect(await m.settleMemberFn(OP, ok)).toEqual({ status: "OK" });
  });

  it("lets a 영구 정지 be lifted before any 정리: the FN are the member's again", async () => {
    const { m } = await history();
    await m.suspend(null, on(8));
    expect(await m.restoreMember(OP, { id: m.SAMPLE_MEMBER_ID, reason: "소명 확인 후 해제" })).toEqual({ status: "OK" });
    expect(await m.card(on(9))).toBeNull();
    expect(m.account.fnBalance).toBe(12_800);
    expect(await m.settle(on(9), key(915), null)).toMatchObject({ status: "INVALID" });
  });

  it("goes with the account's payment records once their retention ends", async () => {
    const { m } = await history();
    await m.suspend(null, on(8));
    expect(await m.settle(on(8), key(914))).toEqual({ status: "OK" });
    m.recordWithdrawal({ at: on(9).toISOString(), requestId: "w-test-0000000001", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    m.purgeExpired(new Date(2031, 9, 8));
    expect(m.mockFnSettlements.settlements).toHaveLength(1); // 5 years (기본값) are not over yet
    m.purgeExpired(new Date(2031, 9, 10));
    expect(m.mockFnSettlements.settlements).toEqual([]);
  });
});
