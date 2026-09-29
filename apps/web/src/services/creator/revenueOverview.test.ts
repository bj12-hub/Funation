import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 수익 현황 (funnation 수익 대시보드): totals, 30-day daily and 6-month monthly trends. */
describe("revenue overview", () => {
  beforeEach(() => resetMockStores());

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
