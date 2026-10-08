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

describe("지급 완료 (2026-10-08 결정)", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["ADMIN"]);
  });

  async function approved(m: Awaited<ReturnType<typeof load>>, id = "st-p") {
    addPending(m, id, 50_000);
    expect(await m.decideSettlement(OP, { id, decision: "APPROVE", note: "서류 확인 완료" })).toEqual({ status: "OK" });
    return id;
  }

  it("records the transfer of an approved request once, with one audit entry", async () => {
    const m = await load();
    const id = await approved(m);
    const pay = { id, reference: "TRF-20261008-0001", requestId: key(1) };
    expect(await m.paySettlement(OP, pay)).toEqual({ status: "OK" });
    expect(await m.paySettlement(OP, pay)).toEqual({ status: "OK" });
    expect(m.mockSettlement.requests.find((r) => r.id === id)).toMatchObject({ status: "PAID", payoutDate: "2026-10-31", payment: { by: OP.nickname, reference: "TRF-20261008-0001" } });
    expect(m.auditEntries().map((e) => [e.action, e.target, e.reason])).toEqual([
      ["SETTLEMENT_PAY", `settlement:${id}`, "이체 참조 TRF-20261008-0001"],
      ["SETTLEMENT_APPROVE", `settlement:${id}`, "서류 확인 완료"]
    ]);
    // Another request id for the same payment, or the same id for another request, is refused.
    expect(await m.paySettlement(OP, { ...pay, requestId: key(2) })).toEqual({ status: "INVALID", message: "이미 지급 완료된 정산이에요." });
    expect(await m.paySettlement(OP, { ...pay, id: "st-seed-1" })).toMatchObject({ status: "INVALID" });
    // A retried approval of a paid request is the approval it was.
    expect(await m.decideSettlement(OP, { id, decision: "APPROVE", note: "서류 확인 완료" })).toEqual({ status: "OK" });
    expect(await m.decideSettlement(OP, { id, decision: "REJECT", note: "뒤집기" })).toMatchObject({ status: "INVALID" });

    const rows = (await m.getSettlementReview({ status: "PAID" }))!.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].payment).toEqual({ at: expect.any(String), by: OP.nickname, reference: "TRF-20261008-0001" });
    expect((await m.getSettlementReview())!.counts.PAID).toBe(1);
  });

  it("refuses 지급 완료 from any state but 승인, and for a withdrawn creator", async () => {
    const m = await load();
    const ref = (n: number) => ({ reference: "TRF-0001", requestId: key(n) });
    addPending(m, "st-pending", 40_000);
    expect(await m.paySettlement(OP, { id: "st-pending", ...ref(1) })).toEqual({ status: "INVALID", message: "승인된 정산만 지급 완료로 처리할 수 있어요." });
    await m.decideSettlement(OP, { id: "st-pending", decision: "REJECT", note: "계좌 불일치" });
    expect(await m.paySettlement(OP, { id: "st-pending", ...ref(2) })).toEqual({ status: "INVALID", message: "승인된 정산만 지급 완료로 처리할 수 있어요." });
    addPending(m, "st-forfeit", 40_000);
    m.mockSettlement.requests.find((r) => r.id === "st-forfeit")!.status = "FORFEITED";
    expect(await m.paySettlement(OP, { id: "st-forfeit", ...ref(3) })).toEqual({ status: "INVALID", message: "탈퇴로 소멸된 정산이라 지급할 수 없어요." });
    expect(await m.paySettlement(OP, { id: "nope", ...ref(4) })).toEqual({ status: "NOT_FOUND" });

    // Approved, then the creator withdrew: before a 재가입 and after it (the request moved to the withdrawn account).
    const id = await approved(m);
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    const refused = { status: "INVALID", message: "탈퇴한 크리에이터의 정산이라 지급 완료로 처리할 수 없어요." };
    expect(await m.paySettlement(OP, { id, ...ref(5) })).toEqual(refused);
    const { startNewAccount } = await import("@/services/account/rejoin");
    startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" });
    expect(await m.paySettlement(OP, { id, ...ref(6) })).toEqual(refused);
    expect(m.auditEntries().filter((e) => e.action === "SETTLEMENT_PAY")).toEqual([]);
  });

  it("validates the request id and the transfer reference, never an account number", async () => {
    const m = await load();
    const id = await approved(m);
    const pay = (reference: unknown, requestId: unknown = key(9)) => m.paySettlement(OP, { id, reference, requestId });
    expect(await pay("TRF-0001", "short")).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    for (const bad of ["", "abc", "x".repeat(41), "TRF 0001", "이체번호1234", 1234, "-TRF1"]) {
      expect((await pay(bad)).status).toBe("INVALID");
    }
    for (const account of ["1234567890", "110-123-456789", "3333-01-1234567"]) {
      expect(await pay(account)).toEqual({ status: "INVALID", message: "계좌번호처럼 보여요. 계좌번호 대신 이체 참조번호를 입력해 주세요." });
    }
    expect(m.mockSettlement.requests.find((r) => r.id === id)!.status).toBe("APPROVED");
    // Fewer than 10 digits, or letters in it: a transfer reference.
    expect(await pay("2026-1008-7")).toEqual({ status: "OK" });
  });

  it("shows the creator 지급 완료 with the paid date in 정산 관리, without the transfer reference", async () => {
    const m = await load();
    const id = await approved(m);
    await m.paySettlement(OP, { id, reference: "TRF-0001", requestId: key(1) });
    const { toHistoryItem } = await import("@/services/creator/mockSettlementStore");
    const { SETTLEMENT_STATUS_LABEL } = await import("@/services/creator/settlementTypes");
    const item = toHistoryItem(m.mockSettlement.requests.find((r) => r.id === id)!);
    const today = new Date();
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(item).toMatchObject({ status: "PAID", paidAt: ymd });
    expect(JSON.stringify(item)).not.toContain("TRF-0001");
    expect(SETTLEMENT_STATUS_LABEL[item.status]).toBe("지급 완료");
    expect(toHistoryItem(m.mockSettlement.requests.find((r) => r.status === "APPROVED")!).paidAt).toBeUndefined();
  });
});
