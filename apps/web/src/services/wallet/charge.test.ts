import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** FN 충전: server-owned amounts, terms first, one outcome per Idempotency-Key, no balance change on failure. */
async function load() {
  const charge = await import("./charge");
  const { mockWallet } = await import("./mockWalletStore");
  const { mockAccount } = await import("@/services/account/mockStore");
  return { ...charge, wallet: mockWallet, account: mockAccount };
}

const ALL_AGREED = { guardian: true, privacy: true, payment: true, marketing: false };
const custom = (n: number, amount: number, methodId = "KAKAO_PAY") => ({ amount: { customAmount: amount }, methodId, idempotencyKey: key(n) });

describe("FN 충전", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("needs a session and the required terms before charging", async () => {
    const m = await load();
    expect(await m.requestCharge(custom(1, 5_000))).toEqual({ status: "TERMS_REQUIRED" });
    expect(await m.agreeChargeTerms({ ...ALL_AGREED, payment: false })).toEqual({ status: "INVALID" });
    expect(await m.agreeChargeTerms(ALL_AGREED)).toEqual({ status: "AGREED" });
    expect((await m.getChargeOptions())!.termsAgreed).toBe(true);
    signIn(null);
    expect(await m.requestCharge(custom(2, 5_000))).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getChargeOptions()).toBeNull();
    expect(await m.quoteCharge(5_000)).toBeNull();
  });

  it("decides amounts and prices on the server and rejects anything else", async () => {
    const m = await load();
    await m.agreeChargeTerms(ALL_AGREED);
    expect(await m.quoteCharge(999)).toMatchObject({ status: "INVALID", minAmount: 1_000 });
    expect(await m.quoteCharge(1_500.5)).toMatchObject({ status: "INVALID" });
    expect(await m.quoteCharge(5_000)).toEqual({ status: "OK", fnAmount: 5_000, price: 5_500 });
    for (const bad of [
      custom(1, 500),
      { ...custom(2, 5_000), methodId: "BITCOIN" },
      { ...custom(3, 5_000), idempotencyKey: "short" },
      { amount: { packageId: "fn-12345" }, methodId: "CARD", idempotencyKey: key(4) },
      { amount: { customAmount: "5000" }, methodId: "CARD", idempotencyKey: key(5) }
    ]) {
      expect(await m.requestCharge(bad)).toEqual({ status: "INVALID" });
    }
    expect(m.account.fnBalance).toBe(5_000);
  });

  it("charges once per key: a retry returns the first result and a changed request conflicts", async () => {
    const m = await load();
    await m.agreeChargeTerms(ALL_AGREED);
    const first = await m.requestCharge({ amount: { packageId: "fn-30000" }, methodId: "CARD", idempotencyKey: key(1) });
    expect(first).toMatchObject({ status: "COMPLETED", fnAmount: 30_000, price: 33_000, balance: 35_000 });
    expect(await m.requestCharge({ amount: { packageId: "fn-30000" }, methodId: "CARD", idempotencyKey: key(1) })).toEqual(first);
    expect(await m.requestCharge({ amount: { packageId: "fn-50000" }, methodId: "CARD", idempotencyKey: key(1) })).toEqual({ status: "CONFLICT" });
    // A double click sends the same key twice at once: still one charge.
    const [a, b] = await Promise.all([m.requestCharge(custom(2, 2_000)), m.requestCharge(custom(2, 2_000))]);
    expect([a.status, b.status].sort()).toEqual(["COMPLETED", "IN_PROGRESS"].sort());
    expect(m.account.fnBalance).toBe(37_000);
    expect(m.wallet.charges).toHaveLength(2);
  });

  it("leaves the balance alone when the payment fails, and the same key keeps that outcome", async () => {
    const m = await load();
    await m.agreeChargeTerms(ALL_AGREED);
    expect(await m.requestCharge(custom(1, 5_000, "PHONE"))).toEqual({ status: "FAILED", code: "SYSTEM-TEMP-500" });
    expect(await m.requestCharge(custom(1, 5_000, "PHONE"))).toEqual({ status: "FAILED", code: "SYSTEM-TEMP-500" });
    expect(m.account.fnBalance).toBe(5_000);
    expect(m.wallet.charges).toHaveLength(0);
  });

  it("gives every charge its own transaction id, even 100 seconds apart", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T10:00:00"));
    const m = await load();
    await m.agreeChargeTerms(ALL_AGREED);
    const a = await m.requestCharge(custom(1, 1_000));
    vi.setSystemTime(new Date("2026-10-03T10:01:40"));
    const b = await m.requestCharge(custom(2, 1_000));
    if (a.status !== "COMPLETED" || b.status !== "COMPLETED") throw new Error("charge failed");
    expect(a.transactionId).toBe("TXN-20261003-00001");
    expect(b.transactionId).toBe("TXN-20261003-00002");
    expect(new Set(m.wallet.charges.map((c) => c.id)).size).toBe(2);
  });
});
