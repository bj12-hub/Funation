"use server";

import { USE_MOCK } from "@/lib/mock";
import { getAdminSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { mockRefunds } from "@/services/wallet/mockRefundStore";
import { listChargeRecords, listDonationRecords } from "@/services/wallet/walletHistory";
import type { DonationStatus } from "@/services/wallet/walletTypes";
import { recordAudit } from "./auditCore";
import { SAMPLE_MEMBER_ID } from "./memberCore";
import { REFUND_NOTE, type AdminRefund, type DonationsView, type PaymentsView, type RefundDecisionResult } from "./paymentTypes";

/**
 * 후원 · 결제 운영 Server Actions — code-first. Routes `/admin/payments`, `/admin/donations`.
 * Admin only. A refund decision is final and logged; approval takes the FN back on the server.
 * The mock has one member with wallet data (the sample member); per-member ledgers are TBD.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin payment API is not connected yet.");
};
const owner = () => ({ memberId: SAMPLE_MEMBER_ID, memberName: mockAccount.nickname });

function refunds(): AdminRefund[] {
  const charges = new Map(listChargeRecords().map((c) => [c.id, c]));
  return [...mockRefunds.requests]
    .sort((a, b) => Number(a.status !== "REQUESTED") - Number(b.status !== "REQUESTED") || b.requestedAt.localeCompare(a.requestedAt))
    .map((r) => {
      const c = charges.get(r.chargeId);
      return {
        chargeId: r.chargeId,
        ...owner(),
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
  if (!(await getAdminSession())) return null;
  const charges = listChargeRecords()
    .map((c) => ({ ...c, ...owner() }))
    .sort((a, b) => b.chargedAt.localeCompare(a.chargedAt));
  return { charges, refunds: refunds(), balance: mockAccount.fnBalance };
}

/**
 * 환불 승인: the charged FN must still be in the balance (spent FN cannot be taken back — the real
 * rule for partially used charges is TBD). The balance change and the decision happen together.
 */
export async function decideRefund(input: unknown): Promise<RefundDecisionResult> {
  assertMock();
  const admin = await getAdminSession();
  if (!admin) return { status: "UNAUTHORIZED" };
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
  const charge = listChargeRecords().find((c) => c.id === request.chargeId);
  if (!charge || charge.status !== "COMPLETED") return { status: "INVALID", message: "완료된 충전이 아니에요." };
  if (wanted === "APPROVED") {
    if (mockAccount.fnBalance < charge.fnAmount) return { status: "INVALID", message: `보유 FN(${mockAccount.fnBalance.toLocaleString("ko-KR")})이 충전 FN보다 적어 승인할 수 없어요. 부분 환불 정책은 TBD예요.` };
    mockAccount.fnBalance -= charge.fnAmount;
  }
  request.status = wanted;
  request.decision = { at: new Date().toISOString(), by: admin.nickname, note };
  recordAudit(admin, wanted === "APPROVED" ? "REFUND_APPROVE" : "REFUND_REJECT", `refund:${request.chargeId}`, note);
  return { status: "OK" };
}

export async function getDonationsView(input: { status?: unknown } = {}): Promise<DonationsView | null> {
  assertMock();
  if (!(await getAdminSession())) return null;
  const all = listDonationRecords()
    .map((d) => ({ ...d, ...owner() }))
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
