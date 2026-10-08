import { beforeEach, describe, expect, it, vi } from "vitest";
import { toDateString } from "@/lib/period";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 대시보드 요약 (funnation cards): received tallies, settlement totals, top donors. */
describe("dashboard summary", () => {
  beforeEach(() => resetMockStores());

  it("tallies received donations by window and totals settlement from the records", async () => {
    const { getDashboardSummary } = await import("./creatorStudio");
    const { mockSettlement } = await import("./mockSettlementStore");
    const s = (await getDashboardSummary())!;
    const { today, week, month, total } = s.received;
    expect(today.amount).toBeGreaterThan(0);
    expect(week.amount).toBeGreaterThanOrEqual(today.amount);
    expect(total.amount).toBeGreaterThanOrEqual(month.amount);
    expect(total.amount).toBeGreaterThanOrEqual(week.amount);

    const approved = mockSettlement.requests.filter((r) => r.status === "APPROVED").reduce((a, r) => a + r.amountFn, 0);
    const pending = mockSettlement.requests.filter((r) => r.status === "PENDING").reduce((a, r) => a + r.amountFn, 0);
    expect(s.settlement).toEqual({ availableFn: mockSettlement.availableFn, earnedFn: mockSettlement.availableFn + pending + approved, withdrawnFn: approved });
    expect(s.topDonors.map((d) => d.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("counts 누적 from the records, never from the editable 데뷔일", async () => {
    const { getDashboardSummary, getRevenueOverview } = await import("./creatorStudio");
    const { mockCreator } = await import("./mockCreatorStore");
    const total = (await getDashboardSummary())!.received.total.amount;
    const overall = (await getRevenueOverview())!.totalRevenue;
    for (const debut of [toDateString(new Date()), "2099-01-01", "1000-01-01"]) {
      mockCreator.debutDate = debut;
      const s = (await getDashboardSummary())!.received;
      expect(s.total.amount).toBe(total);
      expect(s.total.amount).toBeGreaterThanOrEqual(s.week.amount);
      expect((await getRevenueOverview())!.totalRevenue).toBe(overall);
    }
  });

  it("counts 이번 주 from Monday and 이번 달 from the 1st (달력 기준)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2026, 9, 8, 12)); // Thursday
      const { getCreatorDashboard, getDashboardSummary } = await import("./creatorStudio");
      const sum = async (from: string, to: string) => (await getCreatorDashboard({ preset: "range", from, to }))!.stats.revenue;
      const { week, month } = (await getDashboardSummary())!.received;
      expect(week.amount).toBe(await sum("2026-10-05", "2026-10-08"));
      expect(month.amount).toBe(await sum("2026-10-01", "2026-10-08"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("is creator-only", async () => {
    const { getDashboardSummary } = await import("./creatorStudio");
    signIn(["SUPPORTER"]);
    expect(await getDashboardSummary()).toBeNull();
  });
});
