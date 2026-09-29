import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 출석체크 (583:4): one credit per day, and every credit leaves a wallet record. */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockCredits } = await import("@/services/wallet/mockCreditStore");
  const actions = await import("./attendance");
  mockAccount.fnBalance = 0;
  return { ...actions, account: mockAccount, credits: mockCredits };
}

describe("출석체크", () => {
  beforeEach(() => resetMockStores());

  it("credits once per day and records the credit", async () => {
    const { checkIn, account, credits } = await load();
    const first = await checkIn();
    expect(first.status).toBe("CHECKED_IN");
    const credited = account.fnBalance;
    expect(credited).toBeGreaterThan(0);
    expect(credits.credits[0]).toMatchObject({ fnAmount: credited, reason: "출석체크" });
    expect((await checkIn()).status).toBe("ALREADY_CHECKED_IN");
    expect(account.fnBalance).toBe(credited);
    expect(credits.credits).toHaveLength(1);
  });

  it("requires a session", async () => {
    const { checkIn, account, credits } = await load();
    signIn(null);
    expect((await checkIn()).status).toBe("UNAUTHORIZED");
    expect(account.fnBalance).toBe(0);
    expect(credits.credits).toHaveLength(0);
  });
});
