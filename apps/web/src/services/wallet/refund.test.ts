import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 환불 요청 (code-first): records a request only — no FN moves, one request per charge. */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestChargeRefund } = await import("./refund");
  const { listChargeRecords } = await import("./walletHistory");
  return { requestChargeRefund, listChargeRecords, account: mockAccount };
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
    await requestChargeRefund({ chargeId: approved.id });
    await requestChargeRefund({ chargeId: rejected.id });
    expect(mockRefunds.requests[0]).toMatchObject({ chargeId: approved.id, memberId: "u-test", accountSince: null });

    account.fnBalance = approved.fnAmount;
    const op = { userId: "adm-test", nickname: "테스트 운영자" };
    expect((await decideRefund(op, { chargeId: approved.id, decision: "APPROVE", note: "정상 환불" })).status).toBe("OK");
    expect((await decideRefund(op, { chargeId: rejected.id, decision: "REJECT", note: "이미 사용한 FN" })).status).toBe("OK");

    // The operator's approval memo stays internal; only a rejection reason reaches the member.
    expect(await requestChargeRefund({ chargeId: approved.id })).toEqual({ status: "APPROVED", requestedAt: mockRefunds.requests[0].requestedAt, decidedAt: expect.any(String) });
    expect(await requestChargeRefund({ chargeId: rejected.id })).toMatchObject({ status: "REJECTED", note: "이미 사용한 FN" });
    expect(account.fnBalance).toBe(0);
  });

  it("rejects cancelled / processing / unknown charges, long reasons and signed-out calls", async () => {
    const { requestChargeRefund, listChargeRecords } = await load();
    const notDone = listChargeRecords().find((c) => c.status !== "COMPLETED")!;
    expect((await requestChargeRefund({ chargeId: notDone.id })).status).toBe("INVALID");
    expect((await requestChargeRefund({ chargeId: "nope" })).status).toBe("INVALID");
    const done = listChargeRecords().find((c) => c.status === "COMPLETED")!;
    expect((await requestChargeRefund({ chargeId: done.id, reason: "가".repeat(201) })).status).toBe("INVALID");
    signIn(null);
    expect((await requestChargeRefund({ chargeId: done.id })).status).toBe("UNAUTHORIZED");
  });
});
