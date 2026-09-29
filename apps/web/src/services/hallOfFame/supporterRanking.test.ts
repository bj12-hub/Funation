import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));

/** 명예의 전당 (funnation tabs): leaderboard paging per period, 실시간 windows. */
describe("hall of fame", () => {
  it("pages the leaderboard in steps of 20 and scales by period", async () => {
    const { getSupporterRanking, LEADERBOARD_STEP } = await import("./supporterRanking");
    const first = await getSupporterRanking("all");
    expect(first.supporters).toHaveLength(LEADERBOARD_STEP);
    expect(first.total).toBeGreaterThan(LEADERBOARD_STEP);
    const more = await getSupporterRanking("all", 40);
    expect(more.supporters).toHaveLength(40);
    const week = await getSupporterRanking("week");
    expect(week.supporters[0].donationAmountKrw).toBeLessThan(first.supporters[0].donationAmountKrw);
    const amounts = first.supporters.map((s) => s.donationAmountKrw);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it("ranks the recent window by amount and grows with the window", async () => {
    const { getLiveSupporterRanking, parseLiveWindow, parseHofTab } = await import("./supporterRanking");
    const short = await getLiveSupporterRanking("30m");
    const long = await getLiveSupporterRanking("6h");
    expect(short.supporters.map((s) => s.rank)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    expect(long.supporters[0].donationAmountKrw).toBeGreaterThan(short.supporters[0].donationAmountKrw);
    expect(parseLiveWindow("nope")).toBe("30m");
    expect(parseHofTab(undefined)).toBe("titles");
  });
});
