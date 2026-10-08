import { toDateString } from "@/lib/period";
import { USE_MOCK } from "@/lib/mock";
import { mockAccount } from "@/services/account/mockStore";
import { accountSince, isWithdrawn } from "@/services/account/withdrawalCore";
import { purgeExpired } from "@/services/account/retentionPurge";
import { mockRefunds, type MockRefundRequest } from "@/services/wallet/mockRefundStore";
import { findChargeRecord, listAccountChargeRecords, listAccountDonationRecords, listChargeRecords } from "@/services/wallet/walletHistory";
import type { DonationStatus } from "@/services/wallet/walletTypes";
import type { AdminActor } from "./adminTypes";
import { recordAudit } from "./auditCore";
import { SAMPLE_MEMBER_ID, slotAccountLabel } from "./memberCore";
import { REFUND_NOTE, type AdminChargeRow, type AdminDonationRow, type AdminRefund, type DonationsView, type PaymentsView, type RefundDecisionResult } from "./paymentTypes";

/**
 * 후원 · 결제 운영 API logic — code-first (called by `/api/admin/*`). Admin app screens `/admin/payments`, `/admin/donations`.
 * Admin only. A refund decision is final and logged; approval takes the FN back on the server.
 * The mock has one member with wallet data (the sample member); per-member ledgers are TBD.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin payment API is not connected yet.");
};
/**
 * Whose a wallet record is, by the start marker of the account it belongs to: the account holding the slot now, or a
 * withdrawn one a 재가입 moved aside (`…-wN`). A withdrawn account shows its original nickname, marked withdrawn
 * (2026-10-08 결정 — the console shows 탈퇴 with a badge, never "탈퇴한 회원").
 */
const owner = (account: string | null) => {
  const a = slotAccountLabel(account);
  return { memberId: a.memberId, memberName: a.name, memberWithdrawn: a.withdrawn };
};

/**
 * Whether a refund request was filed by the account that holds the mock slot now (and has not withdrawn).
 * The mock reuses one member id after a 재가입, so the account start marker stored with the request decides.
 */
const fromCurrentAccount = (r: MockRefundRequest) => r.accountSince === accountSince() && !isWithdrawn();

/**
 * 처리 대기 (2026-10-08 결정 D4b): requests an operator can decide now. A waiting request of an account that has since
 * withdrawn is 처리 불가(탈퇴) — left out of the 처리 대기 counts, listed apart, and still refused by `decideRefund`.
 */
export function refundQueue(): { waiting: number; blocked: number } {
  const open = mockRefunds.requests.filter((r) => r.status === "REQUESTED");
  const waiting = open.filter(fromCurrentAccount).length;
  return { waiting, blocked: open.length - waiting };
}

/** Order: 처리 대기, then 처리 불가(탈퇴), then decided requests; newest first within each. */
const queueRank = (r: MockRefundRequest) => (r.status !== "REQUESTED" ? 2 : fromCurrentAccount(r) ? 0 : 1);

function refunds(): AdminRefund[] {
  return [...mockRefunds.requests]
    .sort((a, b) => queueRank(a) - queueRank(b) || b.requestedAt.localeCompare(a.requestedAt))
    .map((r) => {
      const c = findChargeRecord(r.chargeId);
      const who = slotAccountLabel(r.accountSince);
      return {
        chargeId: r.chargeId,
        // The slot's id belongs to a new account after a 재가입: a withdrawn account's request points to its `…-wN`.
        memberId: r.memberId === SAMPLE_MEMBER_ID ? who.memberId : r.memberId,
        memberName: who.name,
        // Same account test as `fromCurrentAccount`: such a request is shown with a 탈퇴 badge and cannot be decided.
        memberWithdrawn: !fromCurrentAccount(r),
        requestedAt: r.requestedAt,
        reason: r.reason,
        status: r.status,
        decision: r.decision ?? null,
        charge: c ? { chargedAt: c.chargedAt, fnAmount: c.fnAmount, paidAmount: c.paidAmount, methodLabel: c.methodLabel, transactionId: c.transactionId } : null
      };
    });
}

export async function getPaymentsView(): Promise<PaymentsView | null> {
  assertMock();
  purgeExpired(); // records past their retention date are not shown (account/retentionPolicy.ts)
  // Every account's charges: a withdrawn account's stay in the console (audit trail) under its own `…-wN` member.
  const charges = listAccountChargeRecords()
    .map(
      (c): AdminChargeRow => ({
        id: c.id,
        chargedAt: c.chargedAt,
        methodLabel: c.methodLabel,
        fnAmount: c.fnAmount,
        paidAmount: c.paidAmount,
        status: c.status,
        transactionId: c.transactionId,
        refund: c.refund ? { status: c.refund.status, requestedAt: c.refund.requestedAt } : null,
        ...owner(c.account)
      })
    )
    .sort((a, b) => b.chargedAt.localeCompare(a.chargedAt));
  return { charges, refunds: refunds(), balance: mockAccount.fnBalance };
}

/**
 * 환불 승인: the charged FN must still be in the balance (spent FN cannot be taken back — the real
 * rule for partially used charges is TBD). The balance change, its wallet record and the decision
 * happen together. A withdrawn member's request is not decided here: what a 탈퇴 does to a pending
 * refund is TBD, and approving it would take the FN from whoever holds the account slot now.
 */
export async function decideRefund(admin: AdminActor, input: unknown): Promise<RefundDecisionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const request = mockRefunds.requests.find((r) => r.chargeId === v.chargeId);
  if (!request) return { status: "NOT_FOUND" };
  if (v.decision !== "APPROVE" && v.decision !== "REJECT") return { status: "INVALID", message: "처리 방법을 골라 주세요." };
  const note = typeof v.note === "string" ? v.note.trim() : "";
  if (note.length < REFUND_NOTE.min || note.length > REFUND_NOTE.max) return { status: "INVALID", message: `처리 메모를 ${REFUND_NOTE.min}~${REFUND_NOTE.max}자로 입력해 주세요.` };
  const wanted = v.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  if (request.status !== "REQUESTED") {
    // Retrying the same decision is harmless; a different one is refused (decisions are final).
    return request.status === wanted ? { status: "OK" } : { status: "INVALID", message: "이미 처리된 환불 요청이에요." };
  }
  if (!fromCurrentAccount(request)) return { status: "INVALID", message: "탈퇴한 회원의 환불 요청이라 승인 · 거절할 수 없어요. (처리 중인 환불이 있으면 탈퇴할 수 없어서, 이전 기록에만 있어요.)" };
  const charge = listChargeRecords().find((c) => c.id === request.chargeId);
  if (!charge || charge.status !== "COMPLETED") return { status: "INVALID", message: "완료된 충전이 아니에요." };
  const now = new Date();
  const fn = `${charge.fnAmount.toLocaleString("ko-KR")} FN`;
  if (wanted === "APPROVED") {
    if (mockAccount.fnBalance < charge.fnAmount) return { status: "INVALID", message: `보유 FN(${mockAccount.fnBalance.toLocaleString("ko-KR")})이 충전 FN보다 적어 승인할 수 없어요. 부분 환불 정책은 TBD예요.` };
    mockAccount.fnBalance -= charge.fnAmount;
    // Every balance change leaves a wallet record: the member's FN Wallet lists it as 환불 (−).
    request.debit = { fnAmount: charge.fnAmount, at: `${toDateString(now)} ${now.toTimeString().slice(0, 8)}`, by: admin.nickname };
  }
  request.status = wanted;
  request.decision = { at: now.toISOString(), by: admin.nickname, note };
  recordAudit(admin, wanted === "APPROVED" ? "REFUND_APPROVE" : "REFUND_REJECT", `refund:${request.chargeId}`, `${wanted === "APPROVED" ? `${fn} 회수` : `충전 ${fn}`} · ${note}`);
  return { status: "OK" };
}

export async function getDonationsView(input: { status?: unknown } = {}): Promise<DonationsView | null> {
  assertMock();
  purgeExpired();
  // Field by field: the supporter's message and profile settings are not the console's to show.
  const all = listAccountDonationRecords()
    .map((d): AdminDonationRow => ({ id: d.id, donatedAt: d.donatedAt, creatorName: d.creatorName, fnAmount: d.fnAmount, typeLabel: d.typeLabel, status: d.status, ...owner(d.account) }))
    .sort((a, b) => b.donatedAt.localeCompare(a.donatedAt));
  const statuses: DonationStatus[] = ["COMPLETED", "PROCESSING", "FAILED", "REFUNDING", "REFUNDED"];
  const byStatus = Object.fromEntries(statuses.map((s) => [s, { count: 0, fn: 0 }])) as DonationsView["byStatus"];
  const types = new Map<string, { count: number; fn: number }>();
  for (const d of all) {
    byStatus[d.status].count++;
    byStatus[d.status].fn += d.fnAmount;
    if (d.status === "COMPLETED") {
      const t = types.get(d.typeLabel) ?? { count: 0, fn: 0 };
      t.count++;
      t.fn += d.fnAmount;
      types.set(d.typeLabel, t);
    }
  }
  const rows = statuses.includes(input.status as DonationStatus) ? all.filter((d) => d.status === input.status) : all;
  return { rows, byStatus, byType: [...types].map(([typeLabel, t]) => ({ typeLabel, ...t })).sort((a, b) => b.fn - a.fn) };
}
