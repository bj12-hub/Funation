import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn, verifyMockIdentity } from "@/test/mockEnv";

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

/** Display-only registration: masked account, no real numbers. */
const REG = { memberType: "INDIVIDUAL", registrant: "홍길동", holder: "홍길동", bankName: "예시은행", accountMasked: "********1234", code: "F0L0E0X0", submittedAt: "2026-09-01T00:00:00.000Z" } as const;

function addPending(m: Awaited<ReturnType<typeof load>>, id: string, amountFn: number, registrationAtRequest: typeof REG | null = REG) {
  m.mockSettlement.availableFn -= amountFn;
  m.mockSettlement.requests.unshift({
    id,
    status: "PENDING",
    requestedAt: "2026-09-30",
    periodFrom: "2026-08-01",
    periodTo: "2026-08-31",
    amountFn,
    feeFn: 3_300,
    netKrw: amountFn - 3_300,
    payoutDate: "2026-10-31",
    registrationAtRequest: registrationAtRequest ? { ...registrationAtRequest } : undefined
  });
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
    expect(v.rows[0]).toMatchObject({ id: "st-a", status: "PENDING", registrationAtRequest: { registrant: "홍길동", accountMasked: "********1234" } });
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

  it("reviews and approves with the registration of the request time, not the one registered after 정보 변경", async () => {
    const m = await load();
    const { requestSettlement } = await import("@/services/creator/settlementRequests");
    const { resetSettlementRegistration } = await import("@/services/creator/settlementManagement");
    signIn();
    await verifyMockIdentity();
    m.mockSettlement.registration = { ...REG };
    const res = await requestSettlement({ amountFn: 50_000, idempotencyKey: key(1) });
    if (res.status !== "REQUESTED") throw new Error(res.status);
    expect(await resetSettlementRegistration()).toEqual({ status: "RESET" });
    m.mockSettlement.registration = { ...REG, bankName: "우리은행", accountMasked: "******5678", code: "NEWCODE1", submittedAt: "2026-10-01T00:00:00.000Z" };

    signIn(["ADMIN"]);
    const v = (await m.getSettlementReview({ status: "PENDING" }))!;
    expect(v.registration).toMatchObject({ bankName: "우리은행", accountMasked: "******5678", code: "NEWCODE1" });
    expect(v.rows).toHaveLength(1);
    expect(v.rows[0]).toMatchObject({ id: res.requestId, registrationAtRequest: { memberType: "개인 (대한민국 국민)", bankName: "예시은행", accountMasked: "********1234", code: "F0L0E0X0" } });
    expect(await m.decideSettlement(OP, { id: res.requestId, decision: "APPROVE", note: "신청 시점 계좌로 지급" })).toEqual({ status: "OK" });
    expect(m.mockSettlement.requests.find((r) => r.id === res.requestId)?.registrationAtRequest).toMatchObject({ accountMasked: "********1234" });
  });

  it("refuses to approve a request without its request-time registration, but it can still be rejected", async () => {
    const m = await load();
    const before = m.mockSettlement.availableFn;
    m.mockSettlement.registration = { ...REG };
    addPending(m, "st-legacy", 40_000, null);
    expect((await m.getSettlementReview())!.rows.find((r) => r.id === "st-legacy")?.registrationAtRequest).toBeNull();

    expect(await m.decideSettlement(OP, { id: "st-legacy", decision: "APPROVE", note: "승인 시도" })).toEqual({
      status: "INVALID",
      message: "신청 시점의 정산 정보(지급 계좌)가 없는 신청이라 승인할 수 없어요."
    });
    expect(m.mockSettlement.requests.find((r) => r.id === "st-legacy")).toMatchObject({ status: "PENDING", payoutDate: "2026-10-31" });
    expect(m.auditEntries()).toHaveLength(0);

    expect(await m.decideSettlement(OP, { id: "st-legacy", decision: "REJECT", note: "정산 정보 없음" })).toEqual({ status: "OK" });
    expect(m.mockSettlement.availableFn).toBe(before);
    expect(m.auditEntries().map((e) => e.action)).toEqual(["SETTLEMENT_REJECT"]);
  });

  it("cannot approve or reject a withdrawn creator's forfeited request", async () => {
    const m = await load();
    addPending(m, "st-w", 50_000);
    // 탈퇴 (services/account/withdrawal.ts): the waiting request ends as 탈퇴 소멸.
    Object.assign(m.mockSettlement.requests.find((r) => r.id === "st-w")!, { status: "FORFEITED", feeFn: 0, netKrw: 0, payoutDate: null, review: { at: new Date().toISOString(), by: "회원 탈퇴", note: "정산 대기 수익 소멸 (회원 동의)" } });
    expect((await m.getSettlementReview())!.counts).toMatchObject({ PENDING: 0, FORFEITED: 1 });
    for (const decision of ["APPROVE", "REJECT"]) {
      expect(await m.decideSettlement(OP, { id: "st-w", decision, note: "탈퇴 후 처리 시도" })).toEqual({ status: "INVALID", message: "이미 처리된 정산 신청이에요." });
    }
    expect(m.auditEntries()).toEqual([]);
  });

  it("gives every seed request a masked request-time registration", async () => {
    const m = await load();
    const v = (await m.getSettlementReview())!;
    expect(v.registration).toBeNull();
    expect(v.rows.length).toBeGreaterThan(0);
    expect(v.rows.every((r) => r.registrationAtRequest && /^\*+\d{4}$/.test(r.registrationAtRequest.accountMasked))).toBe(true);
  });
});
