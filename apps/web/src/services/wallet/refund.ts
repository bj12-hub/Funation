"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockRefunds } from "./mockRefundStore";
import { listChargeRecords } from "./walletHistory";
import { REFUND_REASON_MAX, type RefundRequestResult } from "./walletTypes";

/**
 * FN 충전 환불 요청 — code-first (no Figma frame). Records a request for a completed charge; nothing
 * is refunded here. The refund policy (period, partially used charges, fees, minors), the payment
 * provider's cancel API and the admin review are TBD (CLAUDE.md §14). One request per charge, so a
 * retried submit returns the existing request.
 */
export async function requestChargeRefund(input: unknown): Promise<RefundRequestResult> {
  if (!USE_MOCK) throw new Error("Refund API is not connected yet.");
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { chargeId?: unknown; reason?: unknown };
  const reason = typeof v.reason === "string" ? v.reason.trim() : "";
  if (reason.length > REFUND_REASON_MAX) return { status: "INVALID", message: `사유는 ${REFUND_REASON_MAX}자 이내로 입력해 주세요.` };

  const charge = listChargeRecords().find((c) => c.id === v.chargeId);
  if (!charge) return { status: "INVALID", message: "충전 내역을 찾을 수 없어요." };
  const existing = mockRefunds.requests.find((r) => r.chargeId === charge.id);
  if (existing) return { status: "REQUESTED", requestedAt: existing.requestedAt };
  if (charge.status !== "COMPLETED") return { status: "INVALID", message: "완료된 충전만 환불을 요청할 수 있어요." };

  const requestedAt = new Date().toISOString();
  // Reserve before the delay so a double submit cannot create two requests.
  mockRefunds.requests.push({ chargeId: charge.id, requestedAt, reason, status: "REQUESTED" });
  await mockDelay(400);
  // TODO: the backend checks the refund policy, holds the refundable FN and queues an admin review.
  return { status: "REQUESTED", requestedAt };
}
