import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** The operator the admin API acts for (the route layer authorises the admin app first). */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };

/** 정산 심사: final, audited decisions; reject releases the held earnings. */
async function load() {
  const s = await import("./settlements");
  const { mockSettlement } = await import("@/services/creator/mockSettlementStore");
  const { auditEntries } = await import("./auditCore");
  return { ...s, mockSettlement, auditEntries };
}

function addPending(m: Awaited<ReturnType<typeof load>>, id: string, amountFn: number) {
  m.mockSettlement.availableFn -= amountFn;
  m.mockSettlement.requests.unshift({ id, status: "PENDING", requestedAt: "2026-09-30", periodFrom: "2026-08-01", periodTo: "2026-08-31", amountFn, feeFn: 3_300, netKrw: amountFn - 3_300, payoutDate: "2026-10-31" });
}

describe("admin settlements", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["ADMIN"]);
  });

  it("approves a pending request once and keeps the payout schedule", async () => {
    const m = await load();
    addPending(m, "st-a", 50_000);
    const v = (await m.getSettlementReview())!;
    expect(v.counts.PENDING).toBe(1);
    expect(v.rows[0]).toMatchObject({ id: "st-a", status: "PENDING" });
    expect((await m.decideSettlement(OP, { id: "st-a", decision: "APPROVE", note: "" })).status).toBe("INVALID");
    expect(await m.decideSettlement(OP, { id: "st-a", decision: "APPROVE", note: "서류 확인 완료" })).toEqual({ status: "OK" });
    expect(await m.decideSettlement(OP, { id: "st-a", decision: "APPROVE", note: "서류 확인 완료" })).toEqual({ status: "OK" });
    expect((await m.decideSettlement(OP, { id: "st-a", decision: "REJECT", note: "뒤집기" })).status).toBe("INVALID");
    const r = m.mockSettlement.requests.find((x) => x.id === "st-a")!;
    expect(r).toMatchObject({ status: "APPROVED", payoutDate: "2026-10-31", review: { note: "서류 확인 완료" } });
    expect(m.auditEntries().map((e) => e.action)).toEqual(["SETTLEMENT_APPROVE"]);
  });

  it("rejects, zeroes the payout and returns the amount to the available balance", async () => {
    const m = await load();
    const before = m.mockSettlement.availableFn;
    addPending(m, "st-b", 40_000);
    expect(m.mockSettlement.availableFn).toBe(before - 40_000);
    expect(await m.decideSettlement(OP, { id: "st-b", decision: "REJECT", note: "계좌 정보 불일치" })).toEqual({ status: "OK" });
    expect(m.mockSettlement.availableFn).toBe(before);
    expect(m.mockSettlement.requests.find((x) => x.id === "st-b")).toMatchObject({ status: "REJECTED", feeFn: 0, netKrw: 0, payoutDate: null });
    expect((await m.getSettlementReview({ status: "REJECTED" }))!.rows.every((x) => x.status === "REJECTED")).toBe(true);
    expect(await m.decideSettlement(OP, { id: "nope", decision: "REJECT", note: "없음" })).toEqual({ status: "NOT_FOUND" });
  });

});
