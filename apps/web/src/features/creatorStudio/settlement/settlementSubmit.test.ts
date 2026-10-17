import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, verifyMockIdentity } from "@/test/mockEnv";
import { SUBMIT_UNKNOWN_MESSAGE, afterSubmit, askServer } from "./settlementSubmit";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 정산 신청 확인 → 확인: a lost answer keeps the quote and the Idempotency-Key, so a retry never makes a second request. */
describe("정산 신청 확인 — 확인", () => {
  beforeEach(() => resetMockStores());

  it("turns a call that throws into UNKNOWN and stays on the confirm step (same quote and key)", async () => {
    const answer = await askServer(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(answer).toEqual({ status: "UNKNOWN" });
    expect(afterSubmit(answer)).toEqual({ step: "confirm", error: SUBMIT_UNKNOWN_MESSAGE });
  });

  it("completes, goes back to the amount, or leaves the page for the other answers", () => {
    const quote = { amountFn: 50_000, paymentFeeRate: 0.066, paymentFeeFn: 3_300, serviceFeeRate: 0, serviceFeeFn: 0, totalFeeFn: 3_300, netKrw: 46_700 };
    expect(afterSubmit({ status: "REQUESTED", requestId: "st-1", quote })).toEqual({ step: "complete", quote });
    expect(afterSubmit({ status: "INVALID", message: "신청 가능 FN보다 많이 신청할 수 없어요." })).toEqual({ step: "request", error: "신청 가능 FN보다 많이 신청할 수 없어요." });
    expect(afterSubmit({ status: "CONFLICT" })).toMatchObject({ step: "request" });
    expect(afterSubmit({ status: "IDENTITY_REQUIRED" })).toEqual({ leave: "IDENTITY_REQUIRED" });
    expect(afterSubmit({ status: "UNAUTHORIZED" })).toEqual({ leave: "UNAUTHORIZED" });
  });

  it("asks again with the same key after the answer was lost: one request, one deduction", async () => {
    const { requestSettlement } = await import("@/services/creator/settlementRequests");
    const { mockSettlement } = await import("@/services/creator/mockSettlementStore");
    await verifyMockIdentity();
    mockSettlement.registration = { memberType: "INDIVIDUAL", registrant: "홍길동", holder: "홍길동", bankName: "예시은행", accountMasked: "********1234", code: "F0L0E0X0", submittedAt: "2026-09-01T00:00:00.000Z" };
    const before = mockSettlement.availableFn;
    const send = () => requestSettlement({ amountFn: 50_000, idempotencyKey: key(7) });

    // The server made the request, but its answer never reached the browser.
    const lost = await askServer(async () => {
      await send();
      throw new TypeError("Failed to fetch");
    });
    expect(afterSubmit(lost)).toMatchObject({ step: "confirm" });

    const retried = afterSubmit(await askServer(send));
    expect(retried).toMatchObject({ step: "complete", quote: { amountFn: 50_000 } });
    expect(mockSettlement.requests.filter((r) => r.status === "PENDING")).toHaveLength(1);
    expect(mockSettlement.availableFn).toBe(before - 50_000);
  });
});
