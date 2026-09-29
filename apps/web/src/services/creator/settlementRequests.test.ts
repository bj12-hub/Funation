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
