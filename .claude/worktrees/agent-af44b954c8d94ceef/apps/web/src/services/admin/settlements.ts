import { USE_MOCK } from "@/lib/mock";
import { purgeExpired } from "@/services/account/retentionPurge";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { mockSettlement, type MockSettlementRegistration, type MockSettlementRequest } from "@/services/creator/mockSettlementStore";
import { memberTypeLabel, type SettlementStatus } from "@/services/creator/settlementTypes";
import type { AdminActor } from "./adminTypes";
import { recordAudit } from "./auditCore";
import { slotAccountLabel } from "./memberCore";
import { SETTLEMENT_NOTE, SETTLEMENT_REFERENCE, type AdminSettlementRegistration, type AdminSettlementView, type SettlementDecisionResult } from "./settlementTypes";

/**
 * 정산 심사 API logic — code-first (called by `/api/admin/*`). Admin app screens `/admin/settlements` (`?status=`). Admin only.
 * Approve keeps the scheduled payout; reject cancels it and releases the held earnings back to the
 * creator's available balance; 지급 완료 records the transfer of an approved request (APPROVED → PAID, 2026-10-08 결정).
 * Decisions are final and written to the audit log. Each request is
 * reviewed with the registration copied when it was made (466:2), not the current one; a request
 * without that copy cannot be approved. The mock has one settling creator (the studio channel); the
 * real payout / bank transfer is TBD.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin settlement API is not connected yet.");
};
const STATUSES: SettlementStatus[] = ["PENDING", "APPROVED", "PAID", "REJECTED", "FORFEITED"];
const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;
/** A transfer reference: letters, digits and hyphens (the provider's real format is TBD). */
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
/** Digits (and hyphens) only, 10 or more digits: shaped like a bank account number, which must not be stored or shown. */
const looksLikeAccountNumber = (s: string) => /^[\d-]+$/.test(s) && s.replace(/-/g, "").length >= 10;

/** Masked fields only — the mock never holds full ID or account numbers. */
const toAdminRegistration = (reg: MockSettlementRegistration): AdminSettlementRegistration => ({
  memberType: memberTypeLabel(reg.memberType),
  registrant: reg.registrant,
  holder: reg.holder,
  bankName: reg.bankName,
  accountMasked: reg.accountMasked,
  code: reg.code,
  submittedAt: reg.submittedAt
});

/**
 * Who made a request, as the console names them: the studio channel while its account is active; a withdrawn account
 * (the slot's own while withdrawn, or `…-wN` after a 재가입 moved its requests to `pastRequests`) by its original
 * nickname, marked withdrawn (2026-10-08 결정).
 */
const requester = (r: MockSettlementRequest) => {
  const who = slotAccountLabel(r.account ?? null);
  return who.withdrawn ? { creatorName: who.name, creatorWithdrawn: true } : { creatorName: mockCreator.channelName, creatorWithdrawn: false };
};

export async function getSettlementReview(input: { status?: unknown } = {}): Promise<AdminSettlementView | null> {
  assertMock();
  purgeExpired(); // a withdrawn account's requests go at the end of its 대금결제 기록 retention (account/retentionPolicy.ts)
  // Requests of a withdrawn account (moved at 재가입) stay listed for the record.
  const all = [...mockSettlement.requests, ...(mockSettlement.pastRequests ?? [])];
  const counts = Object.fromEntries(STATUSES.map((s) => [s, all.filter((r) => r.status === s).length])) as AdminSettlementView["counts"];
  const filtered = STATUSES.includes(input.status as SettlementStatus) ? all.filter((r) => r.status === input.status) : all;
  const reg = mockSettlement.registration;
  return {
    rows: [...filtered]
      .sort((a, b) => Number(a.status !== "PENDING") - Number(b.status !== "PENDING") || b.requestedAt.localeCompare(a.requestedAt))
      .map((r) => ({
        id: r.id,
        ...requester(r),
        status: r.status,
        requestedAt: r.requestedAt,
        periodFrom: r.periodFrom,
        periodTo: r.periodTo,
        amountFn: r.amountFn,
        feeFn: r.feeFn,
        netKrw: r.netKrw,
        payoutDate: r.payoutDate,
        registrationAtRequest: r.registrationAtRequest ? toAdminRegistration(r.registrationAtRequest) : null,
        review: r.review ?? null,
        // The console's own request id stays on the server.
        payment: r.payment ? { at: r.payment.at, by: r.payment.by, reference: r.payment.reference } : null
      })),
    counts,
    registration: reg ? toAdminRegistration(reg) : null,
    availableFn: mockSettlement.availableFn
  };
}

export async function decideSettlement(admin: AdminActor, input: unknown): Promise<SettlementDecisionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const request = mockSettlement.requests.find((r) => r.id === v.id);
  if (!request) return { status: "NOT_FOUND" };
  if (v.decision !== "APPROVE" && v.decision !== "REJECT") return { status: "INVALID", message: "처리 방법을 골라 주세요." };
  const note = typeof v.note === "string" ? v.note.trim() : "";
  if (note.length < SETTLEMENT_NOTE.min || note.length > SETTLEMENT_NOTE.max) return { status: "INVALID", message: `처리 메모를 ${SETTLEMENT_NOTE.min}~${SETTLEMENT_NOTE.max}자로 입력해 주세요.` };
  const wanted: SettlementStatus = v.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  // Retrying the same decision is harmless (an approved request that was paid since was approved too).
  const same = request.status === wanted || (wanted === "APPROVED" && request.status === "PAID");
  if (request.status !== "PENDING") return same ? { status: "OK" } : { status: "INVALID", message: "이미 처리된 정산 신청이에요." };
  // Approval pays out to the account of the request, never to whatever is registered now.
  if (wanted === "APPROVED" && !request.registrationAtRequest) return { status: "INVALID", message: "신청 시점의 정산 정보(지급 계좌)가 없는 신청이라 승인할 수 없어요." };
  if (wanted === "REJECTED") {
    // Release the hold: the requested earnings become requestable again (one step with the status change).
    mockSettlement.availableFn += request.amountFn;
    request.feeFn = 0;
    request.netKrw = 0;
    request.payoutDate = null;
  }
  request.status = wanted;
  request.review = { at: new Date().toISOString(), by: admin.nickname, note };
  recordAudit(admin, wanted === "APPROVED" ? "SETTLEMENT_APPROVE" : "SETTLEMENT_REJECT", `settlement:${request.id}`, note);
  return { status: "OK" };
}

/**
 * 지급 완료 (2026-10-08 결정): the operator records the transfer of an APPROVED request with its transfer reference. Only
 * from 승인 — never a 탈퇴 소멸 request or one of a creator who withdrew. One console request id per intended payment: the
 * same id again answers OK without a second change or log entry. 지급 수단 · 일정 · 이체 연동 are TBD; nothing is sent
 * from here. The reference is the transfer's own id, never an account number, and the answer echoes neither.
 */
export async function paySettlement(admin: AdminActor, input: unknown): Promise<SettlementDecisionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const all = [...mockSettlement.requests, ...(mockSettlement.pastRequests ?? [])];
  const done = all.find((r) => r.payment?.requestId === v.requestId);
  if (done) return done.id === v.id ? { status: "OK" } : { status: "INVALID", message: "잘못된 요청입니다." };
  const request = all.find((r) => r.id === v.id);
  if (!request) return { status: "NOT_FOUND" };
  const reference = typeof v.reference === "string" ? v.reference.trim() : "";
  if (reference.length < SETTLEMENT_REFERENCE.min || reference.length > SETTLEMENT_REFERENCE.max || !REFERENCE.test(reference)) {
    return { status: "INVALID", message: `이체 참조번호를 영문 · 숫자 · - ${SETTLEMENT_REFERENCE.min}~${SETTLEMENT_REFERENCE.max}자로 입력해 주세요.` };
  }
  if (looksLikeAccountNumber(reference)) return { status: "INVALID", message: "계좌번호처럼 보여요. 계좌번호 대신 이체 참조번호를 입력해 주세요." };
  if (request.status === "FORFEITED") return { status: "INVALID", message: "탈퇴로 소멸된 정산이라 지급할 수 없어요." };
  if (requester(request).creatorWithdrawn) return { status: "INVALID", message: "탈퇴한 크리에이터의 정산이라 지급 완료로 처리할 수 없어요." };
  if (request.status === "PAID") return { status: "INVALID", message: "이미 지급 완료된 정산이에요." };
  if (request.status !== "APPROVED") return { status: "INVALID", message: "승인된 정산만 지급 완료로 처리할 수 있어요." };
  request.status = "PAID";
  request.payment = { at: new Date().toISOString(), by: admin.nickname, reference, requestId: v.requestId };
  recordAudit(admin, "SETTLEMENT_PAY", `settlement:${request.id}`, `이체 참조 ${reference}`);
  return { status: "OK" };
}
