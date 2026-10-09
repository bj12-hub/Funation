import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, resetMockStores } from "@/test/mockEnv";

/**
 * 이용 정지 중인 회원의 FN (2026-10-08 결정), through the real session: a suspended member keeps their FN, cannot use them
 * while suspended (no session) and can again once the suspension is lifted. A 영구 정지 member's FN wait for 남은 FN 정리.
 */

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name)
  })
}));
vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));

const OP = { userId: "adm-test", nickname: "테스트 운영자" };
let n = 0;

async function load() {
  const { getSession, startSession } = await import("@/lib/session");
  const { requestDonation } = await import("@/services/donations/donate");
  const { getWalletSummary } = await import("@/services/wallet/walletHistory");
  const { mockAccount } = await import("@/services/account/mockStore");
  const members = await import("./members");
  const { SAMPLE_MEMBER_ID } = await import("./memberCore");
  await startSession({ keepSignedIn: false });
  const donate = (amount: number) => requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount, message: "", voiceId: null, idempotencyKey: key(++n) });
  const suspend = (days: 1 | 7 | 30 | null) => members.suspendMember(OP, { id: SAMPLE_MEMBER_ID, days, reason: "운영 정책 위반 (테스트)", requestId: key(++n) });
  const restore = () => members.restoreMember(OP, { id: SAMPLE_MEMBER_ID, reason: "소명 확인 후 해제" });
  return { getSession, getWalletSummary, account: mockAccount, members, SAMPLE_MEMBER_ID, donate, suspend, restore };
}

describe("이용 정지 중인 회원의 FN", () => {
  beforeEach(() => {
    resetMockStores();
    cookieJar.clear();
  });

  it("keeps the balance during a suspension, refuses to spend it, and lets the member use it again once lifted", async () => {
    const m = await load();
    expect(m.account.fnBalance).toBe(5_000);
    expect(await m.suspend(7)).toEqual({ status: "OK" });

    // Suspended: no session, so the FN cannot be used or even read by the member — but they are kept.
    expect(await m.getSession()).toBeNull();
    expect(await m.donate(1_000)).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getWalletSummary()).toBeNull();
    expect(m.account.fnBalance).toBe(5_000);
    const detail = (await m.members.getMemberDetail(m.SAMPLE_MEMBER_ID))!;
    expect(detail.member).toMatchObject({ status: "SUSPENDED", fnBalance: 5_000 });
    expect(detail.fnSettlement).toBeNull(); // a suspension for a period is not settled

    // Lifted: the same FN are usable again.
    expect(await m.restore()).toEqual({ status: "OK" });
    expect(await m.getSession()).not.toBeNull();
    expect(await m.getWalletSummary()).toMatchObject({ balance: 5_000, available: 5_000 });
    expect(await m.donate(1_000)).toMatchObject({ status: "COMPLETED", balance: 4_000 });
    expect(m.account.fnBalance).toBe(4_000);
  });

  it("keeps a 영구 정지 member's FN until 남은 FN 정리, which refunds the paid FN with their KRW share", async () => {
    const m = await load();
    expect(await m.suspend(null)).toEqual({ status: "OK" });
    expect(await m.getSession()).toBeNull();
    expect(await m.donate(1_000)).toEqual({ status: "UNAUTHORIZED" });
    expect(m.account.fnBalance).toBe(5_000);
    // The sample history: 5,000 FN of the newest charge (30,000 FN paid 33,000원) are left — 4,500 FN → 4,950원.
    const plan = (await m.members.getMemberDetail(m.SAMPLE_MEMBER_ID))!.fnSettlement!;
    expect(plan).toMatchObject({
      status: "READY",
      balanceFn: 5_000,
      lines: [{ chargeFn: 30_000, paidKrw: 33_000, type: "PARTIAL", grossFn: 5_000, feeFn: 500, netFn: 4_500, refundKrw: 4_950 }],
      total: { grossFn: 5_000, feeFn: 500, netFn: 4_500, refundKrw: 4_950 },
      forfeitFn: 0
    });

    // Lifting a 영구 정지 before any 정리 gives the member their FN back as they were.
    expect(await m.restore()).toEqual({ status: "OK" });
    expect(await m.donate(1_000)).toMatchObject({ status: "COMPLETED", balance: 4_000 });
  });

  /**
   * The sample history does not add up to the sample balance: its charges and donations leave 521,500 FN, the balance is
   * 5,000. Those 516,500 FN left through spends no record shows, before anything happened in the running mock — they
   * must never use FN the member receives now.
   */
  it("keeps free FN received after the sample history's unexplained shortfall free: forfeited, never refunded as paid FN", async () => {
    const m = await load();
    const { quoteChargeRefund } = await import("@/services/wallet/refund");
    const { resolvePendingDonation } = await import("./pendingDonations");
    const events = await import("./events");
    const ch2 = { type: "PARTIAL", chargeFn: 30_000, paidKrw: 33_000, grossFn: 15_000, feeFn: 1_500, netFn: 13_500, refundKrw: 14_850 };

    // The sample FlexTV donation still 확인 중 is decided 실패: its 10,000 held FN come back (to where they came from).
    expect(await resolvePendingDonation(OP, { transactionId: "TXN-SEED-B12", outcome: "FAILED", note: "플랫폼 확인 결과 실패", requestId: key(++n) })).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(15_000);
    expect(await quoteChargeRefund({ chargeId: "ch2" })).toMatchObject({ status: "QUOTE", quote: ch2 });

    // An ended event pays every participant 1,000 free FN.
    expect(await events.saveEventReward(OP, { id: "ev-attendance", kind: "FREE_FN", amountFn: 1_000 })).toEqual({ status: "OK" });
    expect(await events.payEventReward(OP, { id: "ev-attendance", requestId: key(++n) })).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(16_000);
    // The refund popup: still 15,000 FN of the newest charge — the 1,000 free FN are not a charge's.
    expect(await quoteChargeRefund({ chargeId: "ch2" })).toMatchObject({ status: "QUOTE", quote: ch2 });

    // 남은 FN 정리: the same refund, and the 1,000 free FN forfeited.
    expect(await m.suspend(null)).toEqual({ status: "OK" });
    expect((await m.members.getMemberDetail(m.SAMPLE_MEMBER_ID))!.fnSettlement).toMatchObject({
      status: "READY",
      balanceFn: 16_000,
      lines: [{ chargeId: "ch2", ...ch2 }],
      total: { grossFn: 15_000, feeFn: 1_500, netFn: 13_500, refundKrw: 14_850 },
      forfeitFn: 1_000
    });
  });
});
