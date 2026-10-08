import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => vi.useRealTimers());

  it("credits once per day and records the credit", async () => {
    // A day with no 15/30-day reward: on the 15th or 30th the auto-paid reward is a second credit.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T10:00:00"));
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

  it("pays the 15- and 30-day rewards the moment they are reached, once, with a wallet record (2026-10-08 결정)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T10:00:00")); // the sample month: the 1st–14th checked
    const { checkIn, claimAttendanceReward, getAttendance, account, credits } = await load();
    const before = (await getAttendance())!;
    expect(before.rewards.map((r) => [r.days, r.status])).toEqual([[3, "CLAIMED"], [7, "CLAIMED"], [15, "LOCKED"], [30, "LOCKED"]]);
    const result = await checkIn();
    expect(result).toMatchObject({ status: "CHECKED_IN", reward: 50, balance: 550, autoPaid: [{ days: 15, fnAmount: 500, status: "CLAIMED" }] });
    expect(credits.credits.map((c) => [c.reason, c.fnAmount])).toEqual([["출석 15일 보상", 500], ["출석체크", 50]]);
    // Nothing to claim, and no second payment.
    expect(await claimAttendanceReward(15)).toEqual({ status: "NOT_CLAIMABLE" });
    expect(await claimAttendanceReward(30)).toEqual({ status: "NOT_CLAIMABLE" });
    expect((await getAttendance())!.rewards.find((r) => r.days === 15)).toMatchObject({ auto: true, status: "CLAIMED" });
    expect(account.fnBalance).toBe(550);
  });

  describe("재가입", () => {
    /** Withdraws the sample account and signs up again at the current (fake) time with this phone. */
    async function rejoin(phone: string) {
      const { recordWithdrawal } = await import("@/services/account/withdrawalCore");
      const { startNewAccount } = await import("@/services/account/rejoin");
      recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
      expect(startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone })).toBe(true);
    }

    it("starts without the withdrawn account's progress or rewards, and today counts once per person", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-20T10:00:00")); // the 15-day reward reached, the 30-day one not
      const { checkIn, claimAttendanceReward, getAttendance, account } = await load();
      expect((await checkIn()).status).toBe("CHECKED_IN");
      vi.setSystemTime(new Date("2026-10-20T10:00:30"));
      await rejoin("010-1234-5678"); // the same person (same verified phone)
      const fresh = (await getAttendance())!;
      expect(fresh).toMatchObject({ checkedDays: [], total: 0, streak: 0, checkedInToday: true });
      expect(fresh.rewards.map((r) => r.status)).toEqual(["LOCKED", "LOCKED", "LOCKED", "LOCKED"]);
      expect(await claimAttendanceReward(3)).toEqual({ status: "NOT_CLAIMABLE" });
      expect(await claimAttendanceReward(15)).toEqual({ status: "NOT_CLAIMABLE" });
      expect((await checkIn()).status).toBe("ALREADY_CHECKED_IN");
      expect(account.fnBalance).toBe(0);
      // The withdrawn account's credit from the same minute is not in the new account's wallet.
      const { getWalletOverview } = await import("@/services/wallet/walletHistory");
      expect((await getWalletOverview({ period: "all" }))!.entries).toEqual([]);
      // The next day the new account checks in for itself.
      vi.setSystemTime(new Date("2026-10-21T09:00:00"));
      expect(await checkIn()).toMatchObject({ status: "CHECKED_IN", balance: 50, autoPaid: [] });
      expect((await getAttendance())!).toMatchObject({ checkedDays: [21], total: 1 });
    });

    it("lets a different person who signs up the same day check in", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-20T10:00:00"));
      const { checkIn, getAttendance } = await load();
      expect((await checkIn()).status).toBe("CHECKED_IN");
      await rejoin("010-0000-0000");
      expect((await getAttendance())!.checkedInToday).toBe(false);
      expect(await checkIn()).toMatchObject({ status: "CHECKED_IN", balance: 50 });
    });
  });

  it("requires a session", async () => {
    const { checkIn, account, credits } = await load();
    signIn(null);
    expect((await checkIn()).status).toBe("UNAUTHORIZED");
    expect(account.fnBalance).toBe(0);
    expect(credits.credits).toHaveLength(0);
  });
});
