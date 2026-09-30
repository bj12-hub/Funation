import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** The operator the admin API acts for (the route layer authorises the admin app first). */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };

/** 후원 · 결제 운영: final, logged refund decisions; approval takes back FN on the server. */
async function load() {
  const payments = await import("./payments");
  const { requestChargeRefund } = await import("@/services/wallet/refund");
  const { listChargeRecords } = await import("@/services/wallet/walletHistory");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { auditEntries } = await import("./auditCore");
  return { ...payments, requestChargeRefund, listChargeRecords, mockAccount, auditEntries };
}

async function fileRefund(m: Awaited<ReturnType<typeof load>>) {
  signIn(["SUPPORTER"]);
  const charge = m.listChargeRecords().find((c) => c.status === "COMPLETED")!;
  expect((await m.requestChargeRefund({ chargeId: charge.id, reason: "실수로 충전했어요" })).status).toBe("REQUESTED");
  signIn(["ADMIN"]);
  return charge;
}

describe("admin payments", () => {
  beforeEach(() => resetMockStores());

  it("approves once, takes the FN back and shows the result to the member", async () => {
    const m = await load();
    const charge = await fileRefund(m);
    m.mockAccount.fnBalance = charge.fnAmount + 1_000;
    expect((await m.getPaymentsView())!.refunds[0]).toMatchObject({ chargeId: charge.id, status: "REQUESTED" });
    expect((await m.decideRefund(OP, { chargeId: charge.id, decision: "APPROVE", note: "" })).status).toBe("INVALID");
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "APPROVE", note: "정상 환불" })).toEqual({ status: "OK" });
    expect(m.mockAccount.fnBalance).toBe(1_000);
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "APPROVE", note: "정상 환불" })).toEqual({ status: "OK" });
    expect(m.mockAccount.fnBalance).toBe(1_000);
    expect((await m.decideRefund(OP, { chargeId: charge.id, decision: "REJECT", note: "뒤집기" })).status).toBe("INVALID");
    expect(m.listChargeRecords().find((c) => c.id === charge.id)!.refund).toMatchObject({ status: "APPROVED" });
    expect(m.auditEntries().map((e) => e.action)).toEqual(["REFUND_APPROVE"]);
  });

  it("refuses to approve when the FN was already spent, and rejects with a note", async () => {
    const m = await load();
    const charge = await fileRefund(m);
    m.mockAccount.fnBalance = charge.fnAmount - 1;
    expect((await m.decideRefund(OP, { chargeId: charge.id, decision: "APPROVE", note: "환불 시도" })).status).toBe("INVALID");
    expect(m.mockAccount.fnBalance).toBe(charge.fnAmount - 1);
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "REJECT", note: "이미 사용한 FN" })).toEqual({ status: "OK" });
    expect(m.listChargeRecords().find((c) => c.id === charge.id)!.refund).toMatchObject({ status: "REJECTED", note: "이미 사용한 FN" });
    expect(await m.decideRefund(OP, { chargeId: "nope", decision: "REJECT", note: "없음" })).toEqual({ status: "NOT_FOUND" });
  });

  it("summarises donations by status and type", async () => {
    const m = await load();
    signIn(["ADMIN"]);
    const v = (await m.getDonationsView())!;
    const total = Object.values(v.byStatus).reduce((s, x) => s + x.count, 0);
    expect(total).toBe(v.rows.length);
    expect(v.byType.reduce((s, t) => s + t.count, 0)).toBe(v.byStatus.COMPLETED.count);
    expect((await m.getDonationsView({ status: "REFUNDED" }))!.rows.every((d) => d.status === "REFUNDED")).toBe(true);
  });
});
