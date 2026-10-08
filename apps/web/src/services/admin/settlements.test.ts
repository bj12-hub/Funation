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

  it("refuses 지급 완료 from any state but 승인, and pays a withdrawn creator's approved request (2026-10-08 결정)", async () => {
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

    // Approved, then the creator withdrew: what was approved is still paid — before a 재가입 and after it (the request
    // moved to the withdrawn account). The console keeps the original nickname with the 탈퇴 badge.
    const id = await approved(m);
    const later = await approved(m, "st-p2");
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    expect(await m.paySettlement(OP, { id, ...ref(5) })).toEqual({ status: "OK" });
    const { startNewAccount } = await import("@/services/account/rejoin");
    startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" });
    expect(m.mockSettlement.pastRequests?.map((r) => r.id)).toContain(later);
    expect(await m.paySettlement(OP, { id: later, ...ref(6) })).toEqual({ status: "OK" });
    expect(m.auditEntries().filter((e) => e.action === "SETTLEMENT_PAY").map((e) => e.target)).toEqual([`settlement:${later}`, `settlement:${id}`]);
    const paid = (await m.getSettlementReview({ status: "PAID" }))!.rows;
    expect(paid.map((r) => [r.id, r.creatorName, r.creatorWithdrawn])).toEqual(
      expect.arrayContaining([
        [id, "홍길동", true],
        [later, "홍길동", true]
      ])
    );
    // 탈퇴 소멸 stays unpayable.
    expect(await m.paySettlement(OP, { id: "st-forfeit", ...ref(7) })).toEqual({ status: "INVALID", message: "탈퇴로 소멸된 정산이라 지급할 수 없어요." });
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

describe("보류 · 보류 해제 (2026-10-08 결정)", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["ADMIN"]);
  });

  const hold = (m: Awaited<ReturnType<typeof load>>, id: string, n: number, note = "입금 경로 확인 필요") => m.holdSettlement(OP, { id, action: "HOLD", note, requestId: key(n) });
  const release = (m: Awaited<ReturnType<typeof load>>, id: string, n: number, note = "확인 완료") => m.holdSettlement(OP, { id, action: "RELEASE", note, requestId: key(n) });
  const BLOCKED = { status: "INVALID", message: "보류 중인 정산이라 승인 · 반려할 수 없어요. 보류를 해제한 뒤 처리해 주세요." };

  it("stops 승인 and 반려 of a 심사 대기 request while it is held, and 보류 해제 puts it back as it was", async () => {
    const m = await load();
    addPending(m, "st-h", 50_000);
    const available = m.mockSettlement.availableFn;
    expect(await hold(m, "st-h", 1)).toEqual({ status: "OK" });
    expect(m.mockSettlement.requests.find((r) => r.id === "st-h")).toMatchObject({ status: "PENDING", payoutDate: "2026-10-31", feeFn: 3_300 });

    expect(await m.decideSettlement(OP, { id: "st-h", decision: "APPROVE", note: "서류 확인 완료" })).toEqual(BLOCKED);
    expect(await m.decideSettlement(OP, { id: "st-h", decision: "REJECT", note: "계좌 불일치" })).toEqual(BLOCKED);
    expect(m.mockSettlement.availableFn).toBe(available);
    expect(m.mockSettlement.requests.find((r) => r.id === "st-h")).toMatchObject({ status: "PENDING", payoutDate: "2026-10-31" });

    expect(await release(m, "st-h", 2)).toEqual({ status: "OK" });
    expect(m.mockSettlement.requests.find((r) => r.id === "st-h")).toMatchObject({ status: "PENDING", payoutDate: "2026-10-31", feeFn: 3_300, netKrw: 46_700 });
    expect(await m.decideSettlement(OP, { id: "st-h", decision: "APPROVE", note: "서류 확인 완료" })).toEqual({ status: "OK" });
    expect(m.auditEntries().map((e) => e.action)).toEqual(["SETTLEMENT_APPROVE", "SETTLEMENT_RELEASE", "SETTLEMENT_HOLD"]);
  });

  it("stops 지급 완료 of a held 승인 request until 보류 해제", async () => {
    const m = await load();
    const pay = (n: number) => m.paySettlement(OP, { id: "st-seed-1", reference: "TRF-0001", requestId: key(n) });
    expect(await hold(m, "st-seed-1", 1)).toEqual({ status: "OK" });
    expect(await pay(2)).toEqual({ status: "INVALID", message: "보류 중인 정산이라 지급 완료로 처리할 수 없어요. 보류를 해제한 뒤 처리해 주세요." });
    expect(m.mockSettlement.requests.find((r) => r.id === "st-seed-1")).toMatchObject({ status: "APPROVED" });
    expect(m.mockSettlement.requests.find((r) => r.id === "st-seed-1")!.payment).toBeUndefined();
    // A retried approval of a held, already approved request is still the approval it was (nothing changes).
    expect(await m.decideSettlement(OP, { id: "st-seed-1", decision: "APPROVE", note: "재시도" })).toEqual({ status: "OK" });
    expect(await release(m, "st-seed-1", 3)).toEqual({ status: "OK" });
    expect(await pay(4)).toEqual({ status: "OK" });
    expect(m.mockSettlement.requests.find((r) => r.id === "st-seed-1")).toMatchObject({ status: "PAID" });
  });

  it("is idempotent by request id, needs a memo and writes one audit entry per change", async () => {
    const m = await load();
    addPending(m, "st-h", 50_000);
    expect(await hold(m, "st-h", 1, "")).toEqual({ status: "INVALID", message: "보류 메모를 2~200자로 입력해 주세요." });
    expect(await hold(m, "st-h", 1, "x".repeat(201))).toMatchObject({ status: "INVALID" });
    expect(await m.holdSettlement(OP, { id: "st-h", action: "HOLD", note: "확인 필요", requestId: "short" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await m.holdSettlement(OP, { id: "st-h", action: "PAUSE", note: "확인 필요", requestId: key(1) })).toEqual({ status: "INVALID", message: "보류 또는 보류 해제를 골라 주세요." });
    expect(await hold(m, "nope", 1)).toEqual({ status: "NOT_FOUND" });
    expect(m.auditEntries()).toEqual([]);

    expect(await hold(m, "st-h", 1)).toEqual({ status: "OK" });
    expect(await hold(m, "st-h", 1)).toEqual({ status: "OK" }); // a retry
    expect(await hold(m, "st-h", 2)).toEqual({ status: "INVALID", message: "이미 보류 중인 정산이에요." });
    // The same request id for another request or the other action is not a retry.
    expect(await hold(m, "st-seed-1", 1)).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await release(m, "st-h", 1)).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });

    expect(await release(m, "st-h", 3, "")).toEqual({ status: "INVALID", message: "보류 해제 메모를 2~200자로 입력해 주세요." });
    expect(await release(m, "st-h", 3)).toEqual({ status: "OK" });
    expect(await release(m, "st-h", 3)).toEqual({ status: "OK" }); // a retry
    expect(await release(m, "st-h", 4)).toEqual({ status: "INVALID", message: "보류 중인 정산이 아니에요." });
    // A late retry of the first hold does not hold it again.
    expect(await hold(m, "st-h", 1)).toEqual({ status: "OK" });
    expect((await m.getSettlementReview())!.held).toBe(0);

    expect(m.auditEntries().map((e) => [e.action, e.actorName, e.target, e.reason])).toEqual([
      ["SETTLEMENT_RELEASE", OP.nickname, "settlement:st-h", "확인 완료"],
      ["SETTLEMENT_HOLD", OP.nickname, "settlement:st-h", "입금 경로 확인 필요"]
    ]);
  });

  it("holds only 심사 대기 and 승인 requests", async () => {
    const m = await load();
    addPending(m, "st-done", 40_000);
    await m.decideSettlement(OP, { id: "st-done", decision: "REJECT", note: "계좌 불일치" });
    addPending(m, "st-forfeit", 40_000);
    m.mockSettlement.requests.find((r) => r.id === "st-forfeit")!.status = "FORFEITED";
    await m.paySettlement(OP, { id: "st-seed-2", reference: "TRF-0002", requestId: key(9) });
    const refused = { status: "INVALID", message: "심사 대기 · 승인 상태의 정산만 보류할 수 있어요." };
    expect(await hold(m, "st-done", 1)).toEqual(refused);
    expect(await hold(m, "st-forfeit", 2)).toEqual(refused);
    expect(await hold(m, "st-seed-2", 3)).toEqual(refused);
    expect(m.auditEntries().filter((e) => e.action === "SETTLEMENT_HOLD")).toEqual([]);
  });

  it("counts held requests apart from 심사 대기 · 승인 and the dashboard's 처리 대기, with a 보류 tab", async () => {
    const m = await load();
    const { getAdminDashboard } = await import("./admin");
    addPending(m, "st-h", 50_000);
    addPending(m, "st-open", 30_000);
    let v = (await m.getSettlementReview())!;
    expect(v.counts).toMatchObject({ PENDING: 2, APPROVED: 5, REJECTED: 1 });
    expect(v.held).toBe(0);
    expect((await getAdminDashboard())!.pending).toMatchObject({ settlements: 2, settlementsHeld: 0 });

    await hold(m, "st-h", 1);
    await hold(m, "st-seed-1", 2);
    v = (await m.getSettlementReview())!;
    expect(v.counts).toMatchObject({ PENDING: 1, APPROVED: 4, PAID: 0, REJECTED: 1, FORFEITED: 0 });
    expect(v.held).toBe(2);
    // Every request is in exactly one tab; 전체 lists 심사 대기 first, then 보류, then the rest.
    expect(Object.values(v.counts).reduce((a, b) => a + b, 0) + v.held).toBe(v.rows.length);
    expect(v.rows.slice(0, 3).map((r) => [r.id, r.hold?.note ?? null])).toEqual([
      ["st-open", null],
      ["st-h", "입금 경로 확인 필요"],
      ["st-seed-1", "입금 경로 확인 필요"]
    ]);
    expect(v.rows.find((r) => r.id === "st-h")!.hold).toEqual({ at: expect.any(String), by: OP.nickname, note: "입금 경로 확인 필요" });
    expect((await m.getSettlementReview({ status: "HELD" }))!.rows.map((r) => r.id)).toEqual(["st-h", "st-seed-1"]);
    expect((await m.getSettlementReview({ status: "PENDING" }))!.rows.map((r) => r.id)).toEqual(["st-open"]);
    expect((await m.getSettlementReview({ status: "APPROVED" }))!.rows.map((r) => r.id)).not.toContain("st-seed-1");
    expect((await getAdminDashboard())!.pending).toMatchObject({ settlements: 1, settlementsHeld: 2 });

    await release(m, "st-h", 3);
    expect((await getAdminDashboard())!.pending).toMatchObject({ settlements: 2, settlementsHeld: 1 });
  });

  it("keeps the hold and its memo off the creator's screens (they keep showing 승인대기 · 승인)", async () => {
    const m = await load();
    m.mockSettlement.registration = { ...REG };
    addPending(m, "st-h", 50_000);
    await hold(m, "st-h", 1, "운영자만 보는 보류 메모");
    await hold(m, "st-seed-1", 2, "운영자만 보는 보류 메모");
    signIn();
    const { getSettlementManageView } = await import("@/services/creator/settlementManagement");
    const view = await getSettlementManageView({ period: "custom", from: "2020-01-01", to: "2030-12-31" });
    if (typeof view === "string") throw new Error(view);
    expect(view.items.find((i) => i.id === "st-h")).toMatchObject({ status: "PENDING" });
    expect(view.items.find((i) => i.id === "st-seed-1")).toMatchObject({ status: "APPROVED" });
    expect(JSON.stringify(view)).not.toContain("운영자만 보는 보류 메모");
    expect(JSON.stringify(view)).not.toContain("hold");
  });
});

describe("이용 정지 중인 크리에이터의 정산 (2026-10-08 결정)", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["ADMIN"]);
  });

  it("reviews and pays a suspended creator's requests as usual", async () => {
    const m = await load();
    const { SAMPLE_MEMBER_ID, isMemberSuspended } = await import("./memberCore");
    const { suspendMember } = await import("./members");
    addPending(m, "st-a", 50_000);
    addPending(m, "st-b", 40_000);
    const available = m.mockSettlement.availableFn;
    expect(await suspendMember(OP, { id: SAMPLE_MEMBER_ID, days: 30, reason: "운영정책 위반 확인", requestId: key(1) })).toEqual({ status: "OK" });
    expect(isMemberSuspended(SAMPLE_MEMBER_ID)).toBe(true);

    expect((await m.getSettlementReview())!.counts.PENDING).toBe(2);
    expect(await m.decideSettlement(OP, { id: "st-a", decision: "APPROVE", note: "서류 확인 완료" })).toEqual({ status: "OK" });
    expect(await m.decideSettlement(OP, { id: "st-b", decision: "REJECT", note: "계좌 불일치" })).toEqual({ status: "OK" });
    expect(m.mockSettlement.availableFn).toBe(available + 40_000);
    expect(await m.paySettlement(OP, { id: "st-a", reference: "TRF-0001", requestId: key(2) })).toEqual({ status: "OK" });
    expect(m.mockSettlement.requests.find((r) => r.id === "st-a")).toMatchObject({ status: "PAID" });
    // 보류 still works the same for a suspended creator.
    expect(await m.holdSettlement(OP, { id: "st-seed-1", action: "HOLD", note: "정지 사유와 함께 확인", requestId: key(3) })).toEqual({ status: "OK" });
    expect(m.auditEntries().map((e) => e.action)).toEqual(["SETTLEMENT_HOLD", "SETTLEMENT_PAY", "SETTLEMENT_REJECT", "SETTLEMENT_APPROVE", "MEMBER_SUSPEND"]);
  });
});
