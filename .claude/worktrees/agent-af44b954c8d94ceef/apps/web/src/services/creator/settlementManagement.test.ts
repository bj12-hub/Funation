import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 정산 관리: creators only, after registration; history filtered by 신청일 on the server; 정보 변경 resets registration. */
async function load(registered = true) {
  const m = await import("./settlementManagement");
  const { mockSettlement } = await import("./mockSettlementStore");
  // Display-only registration: masked account, no real numbers.
  if (registered) {
    mockSettlement.registration = {
      memberType: "INDIVIDUAL",
      registrant: "홍길동",
      holder: "홍길동",
      bankName: "예시은행",
      accountMasked: "********1234",
      code: "F0L0E0X0",
      submittedAt: "2026-09-01"
    } as typeof mockSettlement.registration;
  }
  return { ...m, store: mockSettlement };
}

describe("정산 관리", () => {
  beforeEach(() => resetMockStores());

  it("is for registered creators only", async () => {
    const m = await load(false);
    expect(await m.getSettlementManageView({})).toBe("NOT_REGISTERED");
    expect(await m.resetSettlementRegistration()).toEqual({ status: "NOT_REGISTERED" });
    signIn(["SUPPORTER"]);
    expect(await m.getSettlementManageView({})).toBe("UNAUTHORIZED");
    expect(await m.resetSettlementRegistration()).toEqual({ status: "UNAUTHORIZED" });
  });

  it("filters by request date, swaps a reversed range and shows review notes only for rejections", async () => {
    const m = await load();
    const year = await m.getSettlementManageView({});
    if (typeof year === "string") throw new Error(year);
    expect(year).toMatchObject({ period: "year", page: 1, accountMasked: "********1234" });
    expect(year.items.length).toBeGreaterThan(0);
    expect(year.items.every((r) => r.requestedAt >= year.from && r.requestedAt <= year.to)).toBe(true);
    expect(year.items.filter((r) => r.status !== "REJECTED").every((r) => r.reviewNote === undefined)).toBe(true);
    expect(year.items.some((r) => "review" in r || "registrationAtRequest" in r)).toBe(false);

    const custom = await m.getSettlementManageView({ period: "custom", from: "2099-01-01", to: "2000-01-01", page: 99 });
    if (typeof custom === "string") throw new Error(custom);
    expect([custom.from, custom.to, custom.page]).toEqual(["2000-01-01", "2099-01-01", 1]);
    expect(custom.items).toHaveLength(Math.min(10, m.store.requests.length));
    const bad = await m.getSettlementManageView({ period: "custom", from: "2026-13-40", to: "nope" });
    expect(typeof bad !== "string" && bad.from <= bad.to).toBe(true);
  });

  it("정보 변경 removes the registration but keeps past requests with their request-time registration", async () => {
    const m = await load();
    const before = m.store.requests.length;
    const copies = m.store.requests.map((r) => r.registrationAtRequest);
    expect(copies.every(Boolean)).toBe(true);
    expect(await m.resetSettlementRegistration()).toEqual({ status: "RESET" });
    expect(m.store.registration).toBeNull();
    expect(m.store.requests).toHaveLength(before);
    expect(m.store.requests.map((r) => r.registrationAtRequest)).toEqual(copies);
    expect(await m.getSettlementManageView({})).toBe("NOT_REGISTERED");
  });
});
