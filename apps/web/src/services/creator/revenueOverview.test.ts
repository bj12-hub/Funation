import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 수익 현황 (funnation 수익 대시보드): totals, 30-day daily and 6-month monthly trends. */
describe("revenue overview", () => {
  beforeEach(() => resetMockStores());

  it("splits this month into 수익원별 상세 that add up exactly, largest first", async () => {
    const { getRevenueOverview, splitByWeight } = await import("./creatorStudio");
    const data = (await getRevenueOverview())!;
    for (const list of [data.bySource.types, data.bySource.routes]) {
      expect(list.reduce((s, p) => s + p.amount, 0)).toBe(data.thisMonth);
      expect(list.map((p) => p.amount)).toEqual([...list.map((p) => p.amount)].sort((a, b) => b - a));
    }
    expect(data.bySource.types).toHaveLength(9);
    expect(data.bySource.routes.map((r) => r.key)).toEqual(["DIRECT", "SOOP", "FLEXTV"]);
    const odd = splitByWeight(10, [
      { key: "a", label: "A", weight: 1 },
      { key: "b", label: "B", weight: 1 },
      { key: "c", label: "C", weight: 1 }
    ]);
    expect(odd.map((p) => p.amount)).toEqual([4, 3, 3]);
    expect(splitByWeight(0, [{ key: "a", label: "A", weight: 1 }])[0].amount).toBe(0);
  });

  it("returns consistent totals and trend series", async () => {
    const { getRevenueOverview, getDashboardSummary } = await import("./creatorStudio");
    const r = (await getRevenueOverview())!;
    expect(r.daily).toHaveLength(30);
    expect(r.monthly).toHaveLength(6);
    expect(r.today.amount).toBe(r.daily[29].amount);
    expect(r.thisMonth).toBe(r.monthly[5].amount);
    expect(r.totalRevenue).toBeGreaterThan(r.monthly.reduce((s, m) => s + m.amount, 0));
    // The dashboard card uses the same lifetime total (not capped at a year).
    const s = (await getDashboardSummary())!;
    expect(s.received.total.amount).toBe(r.totalRevenue);
    expect(r.topDonors).toHaveLength(5);
  });

  it("is creator-only", async () => {
    const { getRevenueOverview } = await import("./creatorStudio");
    signIn(["SUPPORTER"]);
    expect(await getRevenueOverview()).toBeNull();
  });
});
