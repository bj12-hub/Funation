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
  const { listChargeRecords, getWalletOverview } = await import("@/services/wallet/walletHistory");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { withdrawalStore } = await import("@/services/account/withdrawalCore");
  const { startNewAccount } = await import("@/services/account/rejoin");
  const { auditEntries } = await import("./auditCore");
  const csvRoute = await import("@/app/api/wallet/charges/route");
  return { ...payments, requestChargeRefund, listChargeRecords, getWalletOverview, mockAccount, withdrawalStore, startNewAccount, auditEntries, chargesCsv: csvRoute.GET };
}

const withdraw = (m: Awaited<ReturnType<typeof load>>) => {
  m.withdrawalStore().withdrawal = { at: new Date().toISOString(), requestId: "test-withdrawal-0001", forfeitedFn: m.mockAccount.fnBalance, forfeitedEarningsFn: 0, nickname: m.mockAccount.nickname, funationId: "hongGD123" };
  m.mockAccount.fnBalance = 0;
};

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
    expect(m.auditEntries().map((e) => [e.action, e.reason])).toEqual([["REFUND_APPROVE", `${charge.fnAmount.toLocaleString("ko-KR")} FN 회수 · 정상 환불`]]);
  });

  it("leaves a wallet record of the FN taken back, also in the charges CSV", async () => {
    const m = await load();
    const charge = await fileRefund(m);
    m.mockAccount.fnBalance = charge.fnAmount;
    expect((await m.decideRefund(OP, { chargeId: charge.id, decision: "APPROVE", note: "정상 환불" })).status).toBe("OK");
    signIn(["SUPPORTER"]);
    const refunds = (await m.getWalletOverview({ kind: "REFUND", period: "all" }))!.entries;
    expect(refunds).toContainEqual(expect.objectContaining({ id: `${charge.id}-refund`, kind: "REFUND", deltaFn: -charge.fnAmount, statusLabel: "환불완료", tone: "refund" }));
    // Like a refunded donation: the charge row itself shows 환불완료, and the two rows add up to zero.
    const chargeRow = (await m.getWalletOverview({ kind: "CHARGE", period: "all" }))!.entries.find((e) => e.id === charge.id)!;
    expect(chargeRow).toMatchObject({ statusLabel: "환불완료", tone: "refund", deltaFn: charge.fnAmount });
    expect(chargeRow.deltaFn + refunds.find((e) => e.id === `${charge.id}-refund`)!.deltaFn).toBe(0);

    const { NextRequest } = await import("next/server");
    const csv = await (await m.chargesCsv(new NextRequest("http://localhost/api/wallet/charges?period=year"))).text();
    expect(csv).toContain("환불 상태");
    expect(csv.split(/\r?\n/).find((line) => line.includes(charge.transactionId!))).toContain("환불 완료");
  });

  it("labels a withdrawn member's request and does not decide it", async () => {
    const m = await load();
    const charge = await fileRefund(m);
    expect((await m.getPaymentsView())!.refunds[0]).toMatchObject({ memberName: "홍길동", memberWithdrawn: false });

    // 탈퇴: the request is no longer the slot's current member's.
    withdraw(m);
    expect((await m.getPaymentsView())!.refunds[0]).toMatchObject({ chargeId: charge.id, memberName: "탈퇴한 회원", memberWithdrawn: true, status: "REQUESTED" });
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "REJECT", note: "탈퇴 회원" })).toMatchObject({ status: "INVALID" });

    // 재가입: a new account holds the slot; the old request still belongs to the withdrawn one.
    m.startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" });
    m.mockAccount.fnBalance = charge.fnAmount;
    const view = (await m.getPaymentsView())!.refunds[0];
    expect(view).toMatchObject({ memberName: "탈퇴한 회원", memberWithdrawn: true, charge: { fnAmount: charge.fnAmount } });
    expect(await m.decideRefund(OP, { chargeId: charge.id, decision: "APPROVE", note: "환불 시도" })).toMatchObject({ status: "INVALID" });
    expect(m.mockAccount.fnBalance).toBe(charge.fnAmount);
    expect(m.auditEntries()).toEqual([]);
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
