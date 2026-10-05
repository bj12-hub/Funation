import { USE_MOCK } from "@/lib/mock";
import { mockCreator } from "@/services/creator/mockCreatorStore";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { memberTypeLabel, type SettlementStatus } from "@/services/creator/settlementTypes";
import type { AdminActor } from "./adminTypes";
import { recordAudit } from "./auditCore";
import { SETTLEMENT_NOTE, type AdminSettlementView, type SettlementDecisionResult } from "./settlementTypes";

/**
 * 정산 심사 API logic — code-first (called by `/api/admin/*`). Admin app screens `/admin/settlements` (`?status=`). Admin only.
 * Approve keeps the scheduled payout; reject cancels it and releases the held earnings back to the
 * creator's available balance. Decisions are final and written to the audit log. The mock has one
 * settling creator (the studio channel); the real payout / bank transfer is TBD.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin settlement API is not connected yet.");
};
const STATUSES: SettlementStatus[] = ["PENDING", "APPROVED", "REJECTED", "FORFEITED"];

export async function getSettlementReview(input: { status?: unknown } = {}): Promise<AdminSettlementView | null> {
  assertMock();
  const all = mockSettlement.requests;
  const counts = Object.fromEntries(STATUSES.map((s) => [s, all.filter((r) => r.status === s).length])) as AdminSettlementView["counts"];
  const filtered = STATUSES.includes(input.status as SettlementStatus) ? all.filter((r) => r.status === input.status) : all;
  const reg = mockSettlement.registration;
  return {
    rows: [...filtered]
      .sort((a, b) => Number(a.status !== "PENDING") - Number(b.status !== "PENDING") || b.requestedAt.localeCompare(a.requestedAt))
      .map((r) => ({ id: r.id, creatorName: mockCreator.channelName, status: r.status, requestedAt: r.requestedAt, periodFrom: r.periodFrom, periodTo: r.periodTo, amountFn: r.amountFn, feeFn: r.feeFn, netKrw: r.netKrw, payoutDate: r.payoutDate, review: r.review ?? null })),
    counts,
    registration: reg ? { memberType: memberTypeLabel(reg.memberType), registrant: reg.registrant, holder: reg.holder, bankName: reg.bankName, accountMasked: reg.accountMasked, code: reg.code, submittedAt: reg.submittedAt } : null,
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
  if (request.status !== "PENDING") return request.status === wanted ? { status: "OK" } : { status: "INVALID", message: "이미 처리된 정산 신청이에요." };
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
