import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("is creator-only", async () => {
    const { getDashboardSummary } = await import("./creatorStudio");
    signIn(["SUPPORTER"]);
    expect(await getDashboardSummary()).toBeNull();
  });
});
