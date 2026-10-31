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

  it("exports the 조회 기간's history as CSV, with what the table shows only (2026-11-01)", async () => {
    const m = await load();
    const view = await m.getSettlementManageView({});
    if (typeof view === "string") throw new Error(view);
    const res = await m.exportSettlementHistoryCsv({});
    if (res.status !== "OK") throw new Error(res.status);
    const lines = res.csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toBe("상태,신청일,정산 기간 시작,정산 기간 끝,신청 금액(FN),수수료(FN),정산 금액(원),지급 예정일,지급 완료일,거절 사유");
    const inYear = m.store.requests.filter((r) => r.requestedAt >= view.from && r.requestedAt <= view.to);
    expect(res.rows).toBe(inYear.length);
    expect(lines).toHaveLength(inYear.length + 1);
    expect(res.filename).toBe(`ssumnation-settlements-${view.from}_${view.to}.csv`);
    // No registration, account or operator data in the file.
    expect(res.csv).not.toContain("********1234");
    expect(res.csv).not.toContain("홍길동");
    // A rejected one: no fee or amount, its 거절 사유 (a formula-looking one neutralised).
    const r = inYear[0];
    Object.assign(r, { status: "REJECTED", review: { at: "2026-10-01T00:00:00.000Z", by: "운영자", note: "=계좌 불일치" } });
    const again = await m.exportSettlementHistoryCsv({});
    if (again.status !== "OK") throw new Error(again.status);
    expect(again.csv).toContain(`거절,${r.requestedAt},${r.periodFrom},${r.periodTo},${r.amountFn},,,`);
    expect(again.csv).toContain("'=계좌 불일치");
    // A range with nothing in it: the header only.
    const none = await m.exportSettlementHistoryCsv({ period: "custom", from: "2000-01-01", to: "2000-01-31" });
    expect(none).toMatchObject({ status: "OK", rows: 0 });

    signIn(["SUPPORTER"]);
    expect(await m.exportSettlementHistoryCsv({})).toEqual({ status: "UNAUTHORIZED" });
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
