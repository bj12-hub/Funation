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

  it("leaves donations sent as 익명 out of every ranking (2026-10-08 결정)", async () => {
    const { rankSupporters, getSupporterRanking, getLiveSupporterRanking } = await import("./supporterRanking");
    const profile = (id: string) => ({ supporterId: id, nickname: id, avatarUrl: "", tier: "BRONZE" as const });
    const profiles = new Map(["a", "b", "c"].map((id) => [id, profile(id)]));
    const ranked = rankSupporters(
      [
        { supporterId: "a", amountKrw: 1_000, hideProfile: false },
        { supporterId: "b", amountKrw: 900, hideProfile: false },
        { supporterId: "b", amountKrw: 50_000, hideProfile: true },
        { supporterId: "c", amountKrw: 99_000, hideProfile: true }
      ],
      profiles
    );
    expect(ranked.map((r) => [r.rank, r.supporterId, r.donationAmountKrw])).toEqual([[1, "a", 1_000], [2, "b", 900]]);
    // The mock field has hidden donations for 즐거운소리 (s9) and 서포터30 (s30): their rows show the named ones only.
    const board = await getSupporterRanking("month", 40);
    expect(board.supporters.find((s) => s.supporterId === "s9")).toMatchObject({ rank: 9, donationAmountKrw: 1_950_000 });
    expect(board.supporters.find((s) => s.supporterId === "s30")?.rank).toBe(30);
    const live = await getLiveSupporterRanking("6h"); // the window that includes s9
    expect(live.supporters.find((s) => s.supporterId === "s9")?.donationAmountKrw).toBe(Math.round((1_950_000 * 0.055 * (1 - 8 * 0.04)) / 1000) * 1000);
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
