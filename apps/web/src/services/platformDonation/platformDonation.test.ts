import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

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
});
