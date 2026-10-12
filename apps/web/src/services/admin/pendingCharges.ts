import { USE_MOCK } from "@/lib/mock";
import { purgeExpired } from "@/services/account/retentionPurge";
import { confirmChargePayment } from "@/services/wallet/chargeCore";
import { listAccountChargeRecords } from "@/services/wallet/walletHistory";
import { CHARGE_STATUS_LABEL, type ChargeRecord } from "@/services/wallet/walletTypes";
import type { AdminActor } from "./adminTypes";
import { recordAudit } from "./auditCore";
import { slotAccountLabel } from "./memberCore";
import { chargeDecisions, type ChargeDecision } from "./pendingChargeCore";
import { CHARGE_RESOLVE_NOTE, type PendingChargeResolveResult, type PendingChargeResult, type PendingChargeRow, type PendingChargesView } from "./pendingChargeTypes";

/**
 * 처리 중 충전 API logic (2026-10-12 결정) — called by `/api/admin/pending-charges/*`. Admin app screen
 * `/payments/pending`. An FN 충전 still 처리중 (PROCESSING) waits for the payment provider's confirmation, which the mock
 * never gives by itself (no webhook or status lookup — TBD until a provider is connected), and keeps its member from
 * withdrawing (2026-10-10 결정). An operator checks with the provider and decides it with a required memo:
 *
 * - 결제 확인 credits the charge's FN to the account that made it while that account still holds the slot, active; for an
 *   account that has withdrawn nothing is credited and 결제 · 환불 lists it as 완료 · FN 미지급 (탈퇴) — what happens to
 *   the KRW paid is TBD (no refund rule here).
 * - 결제 취소 credits nothing; the member's 충전 내역 shows the charge as 취소 (not refundable).
 *
 * Both go through `wallet/chargeCore.ts` `confirmChargePayment`, run once per charge and once per console request id
 * (a retry must carry the same charge, outcome and memo), are audited (`PENDING_CHARGE_RESOLVE`), and check and write in
 * one synchronous step (nothing awaits).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin pending charge API is not connected yet.");
};
const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;
const OUTCOME_LABEL = { COMPLETED: "결제 확인", CANCELLED: "결제 취소" } as const;
const EFFECT: Record<PendingChargeResult, string> = { CREDITED: "FN 지급", NOT_CREDITED: "FN 미지급 (탈퇴)", CANCELLED: "미지급" };
const number = (n: number) => n.toLocaleString("ko-KR");

/** Whose a charge is, by the account it belongs to (the console shows a withdrawn one's original nickname, marked). */
const owner = (account: string | null) => {
  const a = slotAccountLabel(account);
  return { memberId: a.memberId, memberName: a.name, memberWithdrawn: a.withdrawn };
};

const waitingRow = (c: ChargeRecord & { account: string | null }): PendingChargeRow => ({
  chargeId: c.id,
  chargedAt: c.chargedAt,
  methodLabel: c.methodLabel,
  fnAmount: c.fnAmount,
  paidAmount: c.paidAmount,
  transactionId: c.transactionId,
  ...owner(c.account),
  resolution: null
});

const resolvedRow = (d: ChargeDecision): PendingChargeRow => ({
  chargeId: d.chargeId,
  chargedAt: d.chargedAt,
  methodLabel: d.methodLabel,
  fnAmount: d.fnAmount,
  paidAmount: d.paidAmount,
  transactionId: d.transactionId,
  ...owner(d.account),
  resolution: { outcome: d.outcome, result: d.result, at: d.at, operator: d.operator, note: d.note }
});

/** Every account's 처리중 charges, also those of an account that has withdrawn since. */
const processing = () => listAccountChargeRecords().filter((c) => c.status === "PROCESSING");

/** The list: 확인 필요 (oldest first) and the decisions made here (newest first). */
export async function getPendingCharges(): Promise<PendingChargesView> {
  assertMock();
  purgeExpired(); // a withdrawn account's payment records past their date are not shown (account/retentionPolicy.ts)
  const waiting = processing().sort((a, b) => a.chargedAt.localeCompare(b.chargedAt));
  const resolved = [...chargeDecisions().decisions].sort((a, b) => b.at.localeCompare(a.at));
  return { waiting: waiting.map(waitingRow), resolved: resolved.map(resolvedRow) };
}

/** For the dashboard's 처리 대기: charges waiting for an operator. */
export const pendingChargeCount = () => processing().length;

/**
 * 결제 확인 / 결제 취소: `{ chargeId, outcome: "COMPLETED" | "CANCELLED", note, requestId }` for a charge still 처리중.
 * Refused once it is decided. The same console request id with the same charge, outcome and memo answers what the
 * decision did, without a second change or log entry; anything else under that id is refused.
 */
export async function resolvePendingCharge(admin: AdminActor, input: unknown): Promise<PendingChargeResolveResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const note = typeof v.note === "string" ? v.note.trim() : "";
  const store = chargeDecisions();
  const done = store.decisions.find((d) => d.requestId === v.requestId);
  // A retry is the same charge, outcome and memo; anything else under that id was never decided.
  if (done) {
    const same = done.chargeId === v.chargeId && done.outcome === v.outcome && done.note === note;
    return same ? { status: "OK", result: done.result } : { status: "INVALID", message: "잘못된 요청입니다." };
  }
  // From here nothing awaits: the checks, the 결제 확인 and the record are one step.
  const charge = typeof v.chargeId === "string" ? listAccountChargeRecords().find((c) => c.id === v.chargeId) : undefined;
  if (!charge) return { status: "NOT_FOUND" };
  if (v.outcome !== "COMPLETED" && v.outcome !== "CANCELLED") return { status: "INVALID", message: "결제 확인 또는 결제 취소를 골라 주세요." };
  if (note.length < CHARGE_RESOLVE_NOTE.min || note.length > CHARGE_RESOLVE_NOTE.max) {
    return { status: "INVALID", message: `처리 메모를 ${CHARGE_RESOLVE_NOTE.min}~${CHARGE_RESOLVE_NOTE.max}자로 입력해 주세요.` };
  }
  if (charge.status !== "PROCESSING") return { status: "INVALID", message: `이미 처리된 충전이에요 (${CHARGE_STATUS_LABEL[charge.status]}).` };
  const now = new Date();
  const result = confirmChargePayment(charge.id, v.outcome, now);
  // Only the sample's charges can be 처리중 in the mock, and they were just checked: these do not happen.
  if (result === "NOT_FOUND") return { status: "NOT_FOUND" };
  if (result === "NOT_PROCESSING") return { status: "INVALID", message: "이미 처리된 충전이에요." };
  store.decisions.push({
    requestId: v.requestId,
    chargeId: charge.id,
    outcome: v.outcome,
    result,
    note,
    operator: admin.nickname,
    at: now.toISOString(),
    chargedAt: charge.chargedAt,
    methodLabel: charge.methodLabel,
    fnAmount: charge.fnAmount,
    paidAmount: charge.paidAmount,
    transactionId: charge.transactionId,
    account: charge.account
  });
  recordAudit(
    admin,
    "PENDING_CHARGE_RESOLVE",
    `charge:${charge.id}`,
    `${OUTCOME_LABEL[v.outcome]} · ${charge.methodLabel} ${number(charge.fnAmount)} FN · ${number(charge.paidAmount)}원 · 거래번호 ${charge.transactionId ?? "없음"} · ${EFFECT[result]} · ${note}`
  );
  return { status: "OK", result };
}
