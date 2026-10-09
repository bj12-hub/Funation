import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, signIn, signInAs } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

const SAMPLE_MEMBER_ID = "u-hongGD123"; // services/admin/memberCore.ts

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
      // Inherited object keys are not payment methods.
      { ...custom(6, 5_000), methodId: "__proto__" },
      { ...custom(7, 5_000), methodId: "constructor" },
      { ...custom(8, 5_000), methodId: "toString" },
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

  it("keeps retry keys per member: another member's same key is a charge of their own, the same member's a retry", async () => {
    const m = await load();
    await m.agreeChargeTerms(ALL_AGREED);
    signInAs("u-a");
    const first = await m.requestCharge(custom(1, 5_000));
    if (first.status !== "COMPLETED") throw new Error(first.status);
    // Other members send the same key — one with another request, one with the same: neither gets a conflict or the
    // first member's result.
    signInAs("u-b");
    expect(await m.requestCharge(custom(1, 3_000))).toMatchObject({ status: "COMPLETED", fnAmount: 3_000 });
    signInAs("u-c");
    const same = await m.requestCharge(custom(1, 5_000));
    expect(same).toMatchObject({ status: "COMPLETED", fnAmount: 5_000 });
    expect(same.status === "COMPLETED" && same.transactionId).not.toBe(first.transactionId);
    // The first member's retry still gets the first result, and changing the request under it still conflicts.
    signInAs("u-a");
    expect(await m.requestCharge(custom(1, 5_000))).toEqual(first);
    expect(await m.requestCharge(custom(1, 3_000))).toEqual({ status: "CONFLICT" });
    expect(m.wallet.charges).toHaveLength(3);
  });

  it("starts a 재가입 account without the withdrawn account's retry keys", async () => {
    const m = await load();
    await m.agreeChargeTerms(ALL_AGREED);
    signInAs(SAMPLE_MEMBER_ID); // the slot's member id, as lib/session gives it
    const before = await m.requestCharge(custom(1, 5_000));
    if (before.status !== "COMPLETED") throw new Error(before.status);
    await rejoinWithPhone("010-0000-0000", new Date(Date.now() + 1_000));
    await m.agreeChargeTerms(ALL_AGREED); // the new account agrees again
    // The same key is the new account's own: a new charge, not the withdrawn account's result.
    const after = await m.requestCharge(custom(1, 5_000));
    expect(after).toMatchObject({ status: "COMPLETED", fnAmount: 5_000, balance: 5_000 });
    expect(after.status === "COMPLETED" && after.transactionId).not.toBe(before.transactionId);
    // The withdrawn account's key went with it, to its own id.
    expect(Object.keys(m.wallet.idempotency).sort()).toEqual([`${SAMPLE_MEMBER_ID}-w1:${key(1)}`, `${SAMPLE_MEMBER_ID}:${key(1)}`].sort());
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
