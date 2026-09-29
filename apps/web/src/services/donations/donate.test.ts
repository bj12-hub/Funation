import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** Donation Core (creator room, 610:138 · 613:*): one debit path for every donation type. */
async function load(balance = 50_000) {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const { requestDonation } = await import("./donate");
  mockAccount.fnBalance = balance;
  return { requestDonation, account: mockAccount, wallet: mockWallet };
}

const base = { creatorId: "c1", hideProfile: false };
const text = (amount: number, n = 1) => ({ ...base, type: "TEXT", amount, message: "화이팅", voiceId: null, idempotencyKey: key(n) });

describe("Donation Core", () => {
  beforeEach(() => resetMockStores());

  it("debits a text donation and records it in FN 후원내역", async () => {
    const { requestDonation, account, wallet } = await load();
    const res = await requestDonation(text(1_000));
    expect(res).toMatchObject({ status: "COMPLETED", fnAmount: 1_000, balance: 49_000 });
    expect(account.fnBalance).toBe(49_000);
    expect(wallet.donations[0]).toMatchObject({ creatorId: "c1", fnAmount: 1_000, status: "COMPLETED" });
  });

  it("uses the server catalog price for signatures, not a client amount", async () => {
    const { requestDonation, account } = await load();
    const res = await requestDonation({ ...base, type: "SIGNATURE", signatureId: "sig-zero2", message: "", amount: 1, idempotencyKey: key(2) });
    expect(res).toMatchObject({ status: "COMPLETED", fnAmount: 10_002 });
    expect(account.fnBalance).toBe(50_000 - 10_002);
  });

  it("enforces the minimum amount and rejects non-integer amounts", async () => {
    const { requestDonation, account } = await load();
    expect((await requestDonation(text(999, 3))).status).toBe("INVALID");
    expect((await requestDonation(text(1_000.5, 4))).status).toBe("INVALID");
    expect(account.fnBalance).toBe(50_000);
  });

  it("returns INSUFFICIENT_FN without debiting", async () => {
    const { requestDonation, account } = await load(500);
    expect(await requestDonation(text(1_000, 5))).toEqual({ status: "INSUFFICIENT_FN", balance: 500, required: 1_000 });
    expect(account.fnBalance).toBe(500);
  });

  it("is idempotent per key and rejects a different request under the same key", async () => {
    const { requestDonation, account, wallet } = await load();
    const first = await requestDonation(text(2_000, 6));
    expect(await requestDonation(text(2_000, 6))).toEqual(first);
    expect(await requestDonation(text(3_000, 6))).toEqual({ status: "CONFLICT" });
    expect(account.fnBalance).toBe(48_000);
    expect(wallet.donations).toHaveLength(1);
  });

  it("requires a session and an existing creator", async () => {
    const { requestDonation, account } = await load();
    expect((await requestDonation({ ...text(1_000, 7), creatorId: "nope" })).status).toBe("NOT_FOUND");
    signIn(null);
    expect((await requestDonation(text(1_000, 8))).status).toBe("UNAUTHORIZED");
    expect(account.fnBalance).toBe(50_000);
  });
});
