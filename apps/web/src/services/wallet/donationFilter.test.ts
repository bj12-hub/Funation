import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseDonationFilter } from "@/features/wallet/historyParams";
import { mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

const wide = { preset: "range" as const, from: "2000-01-01", to: "2099-12-31" };

/** FN 후원내역 + funnation filters: search, min/max, sort, filtered total. */
describe("donation history filters", () => {
  beforeEach(() => resetMockStores());

  it("filters by text and amount, sorts, and sums the filtered rows", async () => {
    const { getDonationHistory } = await import("./walletHistory");
    const all = (await getDonationHistory({ period: wide, category: "basic", all: true }))!;
    expect(all.totalFn).toBe(all.items.reduce((s, d) => s + d.fnAmount, 0));
    const dates = all.items.map((d) => d.donatedAt);
    expect(dates).toEqual([...dates].sort().reverse());

    const oldest = (await getDonationHistory({ period: wide, category: "basic", all: true, filter: { sort: "oldest" } }))!;
    expect(oldest.items.map((d) => d.donatedAt)).toEqual([...dates].sort());

    const name = all.items[0].creatorName;
    const byName = (await getDonationHistory({ period: wide, category: "basic", all: true, filter: { q: name.toUpperCase() } }))!;
    expect(byName.items.length).toBeGreaterThan(0);
    expect(byName.items.every((d) => d.creatorName.toLowerCase().includes(name.toLowerCase()) || d.message.toLowerCase().includes(name.toLowerCase()))).toBe(true);

    const min = Math.min(...all.items.map((d) => d.fnAmount)) + 1;
    const ranged = (await getDonationHistory({ period: wide, category: "basic", all: true, filter: { min } }))!;
    expect(ranged.items.every((d) => d.fnAmount >= min)).toBe(true);
    expect(ranged.totalCount).toBeLessThan(all.totalCount);
  });

  it("drops invalid filter params", () => {
    expect(parseDonationFilter({ q: "  침착맨 ", min: "1000", max: "-5", sort: "weird" })).toEqual({ q: "침착맨", min: 1000, max: undefined, sort: undefined });
    expect(parseDonationFilter({ sort: "oldest", min: "1.5" })).toEqual({ q: undefined, min: undefined, max: undefined, sort: "oldest" });
  });
});
