import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** The operator the admin API acts for (the route layer authorises the admin app first). */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };

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
    m.mockRefunds.requests.push({ chargeId: "ch-x", requestedAt: "2026-09-30", reason: "", status: "REQUESTED" });
    signIn(["ADMIN"]);
    const d = (await m.getAdminDashboard())!;
    expect(d.donations.monthFn).toBeGreaterThanOrEqual(7_000);
    expect(d.pending.refunds).toBe(1);
    expect(d.pending.reports).toBe(0);
    expect(d.creators.total).toBeGreaterThan(0);
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
