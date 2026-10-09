import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, signIn, signInAs } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** SOOP · FlexTV 머니 후원 (817:*): server-side pricing, balance, idempotency and failure reversal. */
async function load(balance = 100_000) {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockPlatform } = await import("./mockPlatformStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const actions = await import("./platformDonation");
  mockAccount.fnBalance = balance;
  return { ...actions, account: mockAccount, platform: mockPlatform, wallet: mockWallet };
}

const soop = (over: Record<string, unknown> = {}) => ({
  platform: "SOOP",
  creatorId: "kim_stream",
  productId: "balloon-30",
  message: "응원해요",
  idempotencyKey: key(1),
  ...over
});

describe("플랫폼 후원", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.restoreAllMocks());

  it("charges the catalog price and records Transaction + External Transaction IDs", async () => {
    const { requestPlatformDonation, account, platform, wallet } = await load();
    const res = await requestPlatformDonation(soop());
    expect(res.status).toBe("COMPLETED");
    if (res.status !== "COMPLETED") return;
    expect(res.fnAmount).toBe(30_000);
    expect(res.balance).toBe(70_000);
    expect(account.fnBalance).toBe(70_000);
    expect(res.transactionId).toMatch(/^TXN-/);
    expect(res.externalTransactionId).toMatch(/^SP-/);
    expect(platform.transactions[0]).toMatchObject({ transactionId: res.transactionId, status: "COMPLETED", fnAmount: 30_000 });
    expect(wallet.donations[0]).toMatchObject({ id: res.transactionId, fnAmount: 30_000, creatorId: "soop:kim_stream" });
  });

  it("ignores any price sent by the client", async () => {
    const { requestPlatformDonation, account } = await load();
    const res = await requestPlatformDonation(soop({ priceFn: 1, amountFn: 1, customFn: 1 }));
    expect(res.status).toBe("COMPLETED");
    expect(account.fnBalance).toBe(70_000);
  });

  it("returns INSUFFICIENT_FN without debiting", async () => {
    const { requestPlatformDonation, account } = await load(5_000);
    expect(await requestPlatformDonation(soop())).toEqual({ status: "INSUFFICIENT_FN", balance: 5_000, required: 30_000 });
    expect(account.fnBalance).toBe(5_000);
  });

  it("debits once for a retried Idempotency-Key and flags a changed payload as CONFLICT", async () => {
    const { requestPlatformDonation, account, platform } = await load();
    const first = await requestPlatformDonation(soop());
    const retry = await requestPlatformDonation(soop());
    expect(retry).toEqual(first);
    expect(account.fnBalance).toBe(70_000);
    expect(platform.transactions.filter((t) => t.creatorId === "kim_stream" && t.status === "COMPLETED" && !t.transactionId.startsWith("TXN-SEED"))).toHaveLength(1);
    expect((await requestPlatformDonation(soop({ productId: "balloon-100" }))).status).toBe("CONFLICT");
    expect(account.fnBalance).toBe(70_000);
  });

  it("reports IN_PROGRESS while the same key is still running", async () => {
    const { requestPlatformDonation, account } = await load();
    const [a, b] = await Promise.all([requestPlatformDonation(soop()), requestPlatformDonation(soop())]);
    expect([a.status, b.status].sort()).toEqual(["COMPLETED", "IN_PROGRESS"]);
    expect(account.fnBalance).toBe(70_000);
  });

  it("reverses the debit when the platform rejects the donation", async () => {
    // 게임왕 (SOOP) and 하트요정 (FlexTV) are dev-only mocks whose platform call fails.
    const { requestPlatformDonation, account, platform } = await load();
    const res = await requestPlatformDonation(soop({ creatorId: "gameking", productId: "balloon-10" }));
    expect(res).toEqual({ status: "FAILED", reason: "API_ERROR" });
    expect(account.fnBalance).toBe(100_000);
    expect(platform.transactions[0]).toMatchObject({ creatorId: "gameking", status: "FAILED" });
  });

  it("dates the wallet record at the hold, not at completion: FN credited while the platform answers stay free", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const at = (h: number, m: number, s: number) => new Date(2026, 9, 9, h, m, s);
      // A fresh account (재가입), so its ledger is only what happens here: a 30,000 FN charge at 11:00.
      vi.setSystemTime(at(11, 0, 0));
      await rejoinWithPhone("010-0000-0000", new Date());
      const { requestPlatformDonation, account, platform, wallet } = await load(0);
      const { agreeChargeTerms, requestCharge } = await import("@/services/wallet/charge");
      const { recordCredit } = await import("@/services/wallet/mockCreditStore");
      const { unusedPaidFnByCharge } = await import("@/services/wallet/refundCore");
      const { soopAdapter } = await import("./adapters");
      expect((await agreeChargeTerms({ guardian: true, privacy: true, payment: true })).status).toBe("AGREED");
      const charged = await requestCharge({ amount: { customAmount: 30_000 }, methodId: "KAKAO_PAY", idempotencyKey: key(90) });
      if (charged.status !== "COMPLETED") throw new Error(charged.status);

      // The platform answers 5 s after the hold; 1,000 free FN (출석 보상) come in meanwhile.
      vi.spyOn(soopAdapter, "sendDonation").mockImplementationOnce(async () => {
        vi.setSystemTime(at(12, 1, 0));
        account.fnBalance += 1_000;
        recordCredit(1_000, "출석체크");
        vi.setSystemTime(at(12, 1, 3));
        return { ok: true, externalTransactionId: "SP-TEST-000001" };
      });
      vi.setSystemTime(at(12, 0, 58));
      const res = await requestPlatformDonation(soop({ productId: "balloon-10" }));
      if (res.status !== "COMPLETED") throw new Error(res.status);

      // 후원 내역 keeps the 완료 time; the FN 후원내역 row is dated when the FN were debited.
      expect(platform.transactions[0]).toMatchObject({ transactionId: res.transactionId, createdAt: "2026-10-09 12:00", completedAt: "2026-10-09 12:01" });
      expect(wallet.donations.find((d) => d.id === res.transactionId)).toMatchObject({ donatedAt: "2026-10-09 12:00:58", status: "COMPLETED", fnAmount: 10_000 });
      // The 10,000 FN left the charge before the free FN came: 20,000 of it unused, the 1,000 free FN still free.
      expect(account.fnBalance).toBe(21_000);
      expect([...unusedPaidFnByCharge()]).toEqual([[`ch-${charged.transactionId}`, 20_000]]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the hold and answers PENDING when the platform call throws after the debit", async () => {
    const { requestPlatformDonation, account, platform } = await load();
    const { soopAdapter } = await import("./adapters");
    const send = vi.spyOn(soopAdapter, "sendDonation").mockRejectedValueOnce(new Error("ECONNRESET"));
    const res = await requestPlatformDonation(soop({ productId: "balloon-10" }));
    expect(res.status).toBe("PENDING");
    if (res.status !== "PENDING") return;
    // The platform may have received it, so the FN stays held until the result is known (pendingCore.ts).
    expect(account.fnBalance).toBe(90_000);
    expect(platform.transactions[0]).toMatchObject({ transactionId: res.transactionId, status: "PROCESSING" });
    // A retry with the same key re-checks the platform; with no result yet it gets the same answer and never re-sends.
    vi.spyOn(soopAdapter, "lookupDonation").mockResolvedValue({ status: "UNKNOWN" });
    expect(await requestPlatformDonation(soop({ productId: "balloon-10" }))).toEqual(res);
    expect(send).toHaveBeenCalledTimes(1);
    expect(account.fnBalance).toBe(90_000);
  });

  it("answers PENDING when the platform does not answer in time", async () => {
    const { requestPlatformDonation, account } = await load();
    const { soopAdapter } = await import("./adapters");
    vi.spyOn(soopAdapter, "sendDonation").mockReturnValueOnce(new Promise(() => {}));
    vi.useFakeTimers();
    try {
      const pending = requestPlatformDonation(soop());
      await vi.advanceTimersByTimeAsync(60_000);
      expect((await pending).status).toBe("PENDING");
    } finally {
      vi.useRealTimers();
    }
    expect(account.fnBalance).toBe(70_000);
  });

  it("finishes the key without debiting when the platform fails before the hold", async () => {
    const { requestPlatformDonation, account } = await load();
    const { soopAdapter } = await import("./adapters");
    vi.spyOn(soopAdapter, "getCreator").mockRejectedValueOnce(new Error("ECONNRESET"));
    expect(await requestPlatformDonation(soop())).toEqual({ status: "FAILED", reason: "API_ERROR" });
    expect(account.fnBalance).toBe(100_000);
    // Not stuck IN_PROGRESS: the same key answers with the stored result.
    expect(await requestPlatformDonation(soop())).toEqual({ status: "FAILED", reason: "API_ERROR" });
  });

  it("validates the FlexTV custom amount on the server", async () => {
    const { requestPlatformDonation, account } = await load();
    const flex = (customFn: unknown, n: number) =>
      requestPlatformDonation({ platform: "FLEXTV", creatorId: "flexman_live", productId: "custom", customFn, message: "", idempotencyKey: key(n) });
    expect((await flex(999, 2)).status).toBe("INVALID");
    expect((await flex(1_000_001, 3)).status).toBe("INVALID");
    expect((await flex(12.5, 4)).status).toBe("INVALID");
    const ok = await flex(12_345, 5);
    expect(ok.status).toBe("COMPLETED");
    expect(account.fnBalance).toBe(100_000 - 12_345);
  });

  it("rejects unknown products, long messages and signed-out calls", async () => {
    const { requestPlatformDonation, account } = await load();
    expect(await requestPlatformDonation(soop({ productId: "balloon-7", idempotencyKey: key(6) }))).toEqual({ status: "FAILED", reason: "UNAVAILABLE" });
    expect((await requestPlatformDonation(soop({ message: "가".repeat(101), idempotencyKey: key(7) }))).status).toBe("INVALID");
    // Inherited object keys are not platforms.
    for (const [i, platform] of ["__proto__", "constructor", "toString"].entries()) {
      expect(await requestPlatformDonation(soop({ platform, idempotencyKey: key(20 + i) }))).toEqual({ status: "INVALID" });
    }
    signIn(null);
    expect((await requestPlatformDonation(soop({ idempotencyKey: key(8) }))).status).toBe("UNAUTHORIZED");
    expect(account.fnBalance).toBe(100_000);
  });

  it("quotes the balance after the donation from the server", async () => {
    const { quotePlatformDonation } = await load(25_000);
    expect(await quotePlatformDonation({ platform: "SOOP", creatorId: "kim_stream", productId: "balloon-30" })).toEqual({
      status: "OK",
      priceFn: 30_000,
      balance: 25_000,
      afterFn: -5_000,
      sufficient: false,
      productLabel: "별풍선 30개"
    });
  });

  it("keeps retry keys per member: another member's same key is a donation of their own, the same member's a retry", async () => {
    const { requestPlatformDonation, account, platform } = await load();
    signInAs("u-a");
    const first = await requestPlatformDonation(soop());
    if (first.status !== "COMPLETED") throw new Error(first.status);
    // Another member, same key: with another request it is no conflict, with the same one not the first member's result.
    signInAs("u-b");
    expect(await requestPlatformDonation(soop({ productId: "balloon-10" }))).toMatchObject({ status: "COMPLETED", fnAmount: 10_000 });
    signInAs("u-c");
    const same = await requestPlatformDonation(soop());
    expect(same).toMatchObject({ status: "COMPLETED", fnAmount: 30_000 });
    expect(same.status === "COMPLETED" && same.transactionId).not.toBe(first.transactionId);
    // The first member's retry gets the first result; another request under the key still conflicts.
    signInAs("u-a");
    expect(await requestPlatformDonation(soop())).toEqual(first);
    expect(await requestPlatformDonation(soop({ productId: "balloon-10" }))).toEqual({ status: "CONFLICT" });
    expect(platform.transactions.filter((t) => t.status === "COMPLETED" && t.requestKey)).toHaveLength(3);
    expect(account.fnBalance).toBe(100_000 - 30_000 - 10_000 - 30_000);
  });

  it("gives the platform a key of its own, derived from the member and the member's key", async () => {
    const { requestPlatformDonation, platform } = await load();
    const { soopAdapter } = await import("./adapters");
    const { platformKeyFor } = await import("./platformKey");
    const send = vi.spyOn(soopAdapter, "sendDonation");
    signInAs("u-a");
    await requestPlatformDonation(soop());
    signInAs("u-b");
    await requestPlatformDonation(soop());
    const [a, b] = send.mock.calls.map(([req]) => req.idempotencyKey);
    // Never the member's own key; the same for the same member and key; another for another member.
    expect(a).not.toBe(key(1));
    expect(a).toMatch(/^pk-[0-9a-f]{40}$/);
    expect(a).toBe(platformKeyFor("u-a", key(1)));
    expect(b).toBe(platformKeyFor("u-b", key(1)));
    expect(a).not.toBe(b);
    expect(a).not.toContain("u-a");
    // Stored with the transaction, so a status lookup asks by the key the platform was given.
    expect(platform.transactions.slice(0, 2).map((t) => t.platformKey)).toEqual([b, a]);
  });

  it("lists only this account's 최근 후원 creators after a 재가입", async () => {
    const { requestPlatformDonation, getPlatformHome, account } = await load();
    const recent = async () => (await getPlatformHome("SOOP"))!.recent.map((c) => c.id);
    expect(await recent()).toEqual(["kim_stream", "gameking"]); // the sample history
    expect((await requestPlatformDonation(soop())).status).toBe("COMPLETED");

    // A second later the slot holds a new account (the mock's 재가입 keeps the user id).
    await rejoinWithPhone("010-0000-0000", new Date(Date.now() + 1_000));
    expect(await recent()).toEqual([]);
    account.fnBalance = 100_000;
    expect((await requestPlatformDonation(soop({ idempotencyKey: key(2) }))).status).toBe("COMPLETED");
    expect(await recent()).toEqual(["kim_stream"]);
  });
});
