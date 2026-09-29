import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 내 랭킹 (code-first): the member's totals come from their completed donations. */
describe("내 랭킹", () => {
  beforeEach(() => resetMockStores());

  it("places the member among the sample field and per creator", async () => {
    const { mockAccount } = await import("@/services/account/mockStore");
    const { mockWallet } = await import("@/services/wallet/mockWalletStore");
    vi.spyOn(await import("@/services/wallet/walletHistory"), "listDonationRecords").mockImplementation(() => mockWallet.donations);
    const { requestDonation } = await import("@/services/donations/donate");
    const { getMyRanking } = await import("./ranking");
    mockAccount.fnBalance = 10_000_000;

    let view = (await getMyRanking("all"))!;
    expect(view).toMatchObject({ myTotalFn: 0, myRank: null, topPercent: null });

    await requestDonation({ creatorId: "c4", hideProfile: false, type: "TEXT", amount: 3_000_000, message: "", voiceId: null, idempotencyKey: key(1) });
    view = (await getMyRanking("all"))!;
    expect(view.myTotalFn).toBe(3_000_000);
    expect(view.myRank).toBe(1);
    expect(view.board[0]).toMatchObject({ me: true, rank: 1 });
    expect(view.creators[0]).toMatchObject({ creatorId: "c4", myRank: 1 });
    expect((await getMyRanking("month"))!.myTotalFn).toBe(3_000_000);
  });

  it("requires a session", async () => {
    const { getMyRanking } = await import("./ranking");
    signIn(null);
    expect(await getMyRanking("all")).toBeNull();
  });
});
