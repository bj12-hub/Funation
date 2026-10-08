import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** The operator the admin API acts for (the route layer authorises the admin app first). */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };
/** A stored refund request's computed refund (환불 정책 기본값). */
const QUOTE = { type: "FULL_CANCEL" as const, grossFn: 10_000, feeFn: 0, netFn: 10_000 };

/** 관리자 콘솔: Admin role only, server-computed totals, append-only audit log. */
async function load() {
  const admin = await import("./admin");
  const audit = await import("./auditCore");
  const { requestDonation } = await import("@/services/donations/donate");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockRefunds } = await import("@/services/wallet/mockRefundStore");
  return { ...admin, ...audit, requestDonation, mockAccount, mockRefunds };
}

describe("admin console", () => {
  beforeEach(() => resetMockStores());


  it("computes the dashboard on the server from completed records", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    m.mockAccount.fnBalance = 100_000;
    await m.requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: 7_000, message: "", voiceId: null, idempotencyKey: key(1) });
    m.mockRefunds.requests.push({ chargeId: "ch-x", memberId: "u-test", accountSince: null, requestedAt: "2026-09-30", reason: "", status: "REQUESTED", quote: QUOTE });
    signIn(["ADMIN"]);
    const d = (await m.getAdminDashboard())!;
    expect(d.donations.monthFn).toBeGreaterThanOrEqual(7_000);
    expect(d.pending.refunds).toBe(1);
    expect(d.pending.reports).toBe(0);
    expect(d.creators.total).toBeGreaterThan(0);
  });

  it("leaves a withdrawn account's waiting refund out of 처리 대기 and counts it as 처리 불가(탈퇴) (2026-10-08 결정)", async () => {
    const m = await load();
    const { decideRefund, getPaymentsView } = await import("./payments");
    const { withdrawalStore } = await import("@/services/account/withdrawalCore");
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    const request = (chargeId: string, accountSince: string | null, requestedAt: string) =>
      m.mockRefunds.requests.push({ chargeId, memberId: "u-test", accountSince, requestedAt, reason: "", status: "REQUESTED", quote: QUOTE });
    request("ch2", null, "2026-10-01T00:00:00.000Z");
    signIn(["ADMIN"]);
    expect((await m.getAdminDashboard())!.pending).toMatchObject({ refunds: 1, refundsBlocked: 0 });

    // The account withdrew (a request that slipped in during the 탈퇴), and a new account in the slot files its own.
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    expect((await m.getAdminDashboard())!.pending).toMatchObject({ refunds: 0, refundsBlocked: 1 });
    const { startNewAccount } = await import("@/services/account/rejoin");
    startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" });
    request("ch-new", withdrawalStore().accountSince, "2026-09-01T00:00:00.000Z");
    expect((await m.getAdminDashboard())!.pending).toMatchObject({ refunds: 1, refundsBlocked: 1 });

    // 처리 대기 first (even when older), then 처리 불가(탈퇴); deciding the blocked one is still refused.
    expect((await getPaymentsView())!.refunds.map((r) => [r.chargeId, r.memberWithdrawn])).toEqual([
      ["ch-new", false],
      ["ch2", true]
    ]);
    expect(await decideRefund({ userId: "adm-1", nickname: "운영자" }, { chargeId: "ch2", decision: "REJECT", note: "탈퇴 회원" })).toMatchObject({ status: "INVALID" });
  });

  it("counts every creator on the dashboard, also a suspended one (as 크리에이터 관리 lists them)", async () => {
    const m = await load();
    const { listAdminCreators, suspendMember } = await import("./members");
    const { creatorMemberId } = await import("./memberCore");
    signIn(["ADMIN"]);
    const all = (await listAdminCreators())!;
    expect((await m.getAdminDashboard())!.creators).toEqual({ total: all.length, live: all.filter((c) => c.isLive).length });
    expect(await suspendMember(OP, { id: creatorMemberId("c1"), days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(2) })).toEqual({ status: "OK" });
    expect((await m.getAdminDashboard())!.creators).toEqual({ total: all.length, live: all.filter((c) => c.isLive).length });
  });

  it("records the admin app's sign-in and sign-out in the audit log, newest first", async () => {
    const m = await load();
    expect(await m.recordSessionEvent(OP, "SIGN_IN")).toEqual({ status: "OK" });
    expect(await m.recordSessionEvent(OP, "SIGN_OUT")).toEqual({ status: "OK" });
    expect((await m.recordSessionEvent(OP, "HACK")).status).toBe("INVALID");
    const log = (await m.listAuditLog())!;
    expect(log.items.map((e) => e.action)).toEqual(["ADMIN_SIGN_OUT", "ADMIN_SIGN_IN"]);
    expect(log.total).toBe(2);
    for (let i = 0; i < 40; i++) m.recordAudit({ userId: "a", nickname: "a" }, "CONTENT_UPDATE", `notice:${i}`);
    expect((await m.listAuditLog())!).toMatchObject({ hasMore: true, total: 42 });
    expect((await m.listAuditLog({ show: 100 }))!.items).toHaveLength(42);
  });
});
