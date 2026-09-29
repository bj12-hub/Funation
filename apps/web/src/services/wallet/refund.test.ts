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
