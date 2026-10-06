import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 정산 신청 (458:4 · 473:2): server-side fee math, balance checks and idempotency. */
async function load() {
  const store = await import("./mockSettlementStore");
  const actions = await import("./settlementRequests");
  // Register the mock creator so settlement actions are allowed.
  store.mockSettlement.registration = {
    memberType: "INDIVIDUAL",
    registrant: "홍길동",
    holder: "홍길동",
    bankName: "신한은행",
    accountMasked: "*******8910",
    code: "TESTCODE",
    submittedAt: new Date().toISOString()
  };
  return { ...actions, store: store.mockSettlement };
}

describe("정산 신청", () => {
  beforeEach(() => resetMockStores());

  it("quotes the Figma sample: 90,000 FN → fee 5,940 FN, net 84,060원", async () => {
    const { quoteSettlement } = await load();
    const res = await quoteSettlement(90_000);
    expect(res).toEqual({
      status: "OK",
      quote: { amountFn: 90_000, paymentFeeRate: 0.066, paymentFeeFn: 5_940, serviceFeeRate: 0, serviceFeeFn: 0, totalFeeFn: 5_940, netKrw: 84_060 }
    });
  });

  it("rejects amounts below the minimum, above the balance, or not integers", async () => {
    const { quoteSettlement } = await load();
    expect((await quoteSettlement(39_999)).status).toBe("INVALID");
    expect((await quoteSettlement(127_501)).status).toBe("INVALID");
    expect((await quoteSettlement(50_000.5)).status).toBe("INVALID");
    expect((await quoteSettlement("90000")).status).toBe("INVALID");
    expect((await quoteSettlement(-1)).status).toBe("INVALID");
  });

  it("deducts the balance once and records a PENDING request", async () => {
    const { requestSettlement, store } = await load();
    const before = store.requests.length;
    const res = await requestSettlement({ amountFn: 90_000, idempotencyKey: key(1) });
    expect(res.status).toBe("REQUESTED");
    expect(store.availableFn).toBe(127_500 - 90_000);
    expect(store.requests).toHaveLength(before + 1);
    expect(store.requests[0]).toMatchObject({ status: "PENDING", amountFn: 90_000, feeFn: 5_940, netKrw: 84_060 });
    expect(store.requests[0].id).toMatch(/^st-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("keeps the registration of the request time on the request (466:2), whatever happens to it later", async () => {
    const { requestSettlement, store } = await load();
    const registered = { ...store.registration! };
    await requestSettlement({ amountFn: 90_000, idempotencyKey: key(8) });
    const request = store.requests[0];
    expect(request.registrationAtRequest).toEqual(registered);

    // 정보 변경: the old registration is removed and a new one (other bank, other code) takes its place.
    store.registration!.accountMasked = "******0000";
    store.registration = { ...registered, bankName: "우리은행", accountMasked: "******5678", code: "NEWCODE1" };
    expect(request.registrationAtRequest).toEqual(registered);
  });

  it("gives two requests made in the same millisecond different ids", async () => {
    const { requestSettlement, store } = await load();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-06T10:00:00.000Z"));
      const a = await requestSettlement({ amountFn: 40_000, idempotencyKey: key(10) });
      const b = await requestSettlement({ amountFn: 40_000, idempotencyKey: key(11) });
      if (a.status !== "REQUESTED" || b.status !== "REQUESTED") throw new Error("not requested");
      expect(a.requestId).not.toBe(b.requestId);
      expect(store.requests.filter((r) => r.status === "PENDING").map((r) => r.id)).toEqual([b.requestId, a.requestId]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never sends the admin review or the registration copy to the creator's page, only a 반려 사유", async () => {
    const { getSettlementApplyView, store } = await load();
    const at = new Date().toISOString();
    Object.assign(store.requests[0], { review: { at, by: "운영자A", note: "내부 메모: 확인 완료" } });
    Object.assign(store.requests[1], { status: "REJECTED", review: { at, by: "운영자B", note: "예금주 불일치" } });

    const view = await getSettlementApplyView();
    if (typeof view === "string") throw new Error(view);
    expect(view.recent).toHaveLength(5);
    expect(view.recent.some((r) => "review" in r || "registrationAtRequest" in r)).toBe(false);
    expect(view.recent[0].reviewNote).toBeUndefined();
    expect(view.recent[1].reviewNote).toBe("예금주 불일치");
    const json = JSON.stringify(view);
    for (const secret of ["운영자A", "운영자B", "내부 메모"]) expect(json).not.toContain(secret);
  });

  it("returns the first request for a retried Idempotency-Key without deducting again", async () => {
    const { requestSettlement, store } = await load();
    const first = await requestSettlement({ amountFn: 90_000, idempotencyKey: key(2) });
    const retry = await requestSettlement({ amountFn: 90_000, idempotencyKey: key(2) });
    expect(retry).toEqual(first);
    expect(store.availableFn).toBe(37_500);
    expect(store.requests.filter((r) => r.status === "PENDING")).toHaveLength(1);
  });

  it("returns CONFLICT when a key is reused for a different amount", async () => {
    const { requestSettlement, store } = await load();
    await requestSettlement({ amountFn: 90_000, idempotencyKey: key(7) });
    expect(await requestSettlement({ amountFn: 50_000, idempotencyKey: key(7) })).toEqual({ status: "CONFLICT" });
    expect(store.availableFn).toBe(37_500);
  });

  it("does not let a second key overdraw the balance", async () => {
    const { requestSettlement, store } = await load();
    await requestSettlement({ amountFn: 90_000, idempotencyKey: key(3) });
    const second = await requestSettlement({ amountFn: 90_000, idempotencyKey: key(4) });
    expect(second.status).toBe("INVALID");
    expect(store.availableFn).toBe(37_500);
  });

  it("rejects a malformed Idempotency-Key", async () => {
    const { requestSettlement } = await load();
    expect((await requestSettlement({ amountFn: 90_000, idempotencyKey: "short" })).status).toBe("INVALID");
    expect((await requestSettlement({ amountFn: 90_000 })).status).toBe("INVALID");
  });

  it("requires the Creator role and a registration", async () => {
    const { requestSettlement, quoteSettlement, store } = await load();
    signIn(["SUPPORTER"]);
    expect((await quoteSettlement(90_000)).status).toBe("UNAUTHORIZED");
    signIn(null);
    expect((await requestSettlement({ amountFn: 90_000, idempotencyKey: key(5) })).status).toBe("UNAUTHORIZED");
    signIn();
    store.registration = null;
    expect((await requestSettlement({ amountFn: 90_000, idempotencyKey: key(6) })).status).toBe("NOT_REGISTERED");
    expect(store.availableFn).toBe(127_500);
  });
});
