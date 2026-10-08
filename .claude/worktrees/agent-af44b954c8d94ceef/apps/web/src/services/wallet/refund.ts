"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { accountSince } from "@/services/account/withdrawalCore";
import { mockRefunds, refundView } from "./mockRefundStore";
import { chargeRefundQuote } from "./refundCore";
import { refundAmounts } from "./refundPolicy";
import { listChargeRecords } from "./walletHistory";
import { REFUND_REASON_MAX, type RefundQuoteResult, type RefundRequestResult } from "./walletTypes";

/**
 * FN 충전 환불 요청 — code-first (no Figma frame). The amounts follow the 환불 정책 기본값 (일반적인 기준, 법무 검토 전 —
 * `refundPolicy.ts`): 청약철회 전액 취소, otherwise the charge's unused paid FN minus the fee, never used or free FN.
 * Everything is computed here; the browser only shows it. One request per charge, so a retried submit returns the
 * existing request as it is now (requested, approved or rejected). The payment provider's cancel API is TBD.
 */

type Input = { chargeId?: unknown; reason?: unknown; expectedGrossFn?: unknown; expectedNetFn?: unknown };
const read = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Input;
const isAmount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/** The outcome the member sees before asking (전액 취소 / 수수료 공제 후 환불 / 환불 불가). */
export async function quoteChargeRefund(input: unknown): Promise<RefundQuoteResult> {
  if (!USE_MOCK) throw new Error("Refund API is not connected yet.");
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(200);
  // Read after the delay: the quote reflects the wallet as it is when it is answered.
  const v = read(input);
  const charge = listChargeRecords().find((c) => c.id === v.chargeId);
  if (!charge) return { status: "INVALID", message: "충전 내역을 찾을 수 없어요." };
  const existing = mockRefunds.requests.find((r) => r.chargeId === charge.id);
  if (existing) return refundView(existing);
  if (charge.status !== "COMPLETED") return { status: "INVALID", message: "완료된 충전만 환불을 요청할 수 있어요." };
  return { status: "QUOTE", quote: chargeRefundQuote(charge, new Date()) };
}

/**
 * Files the request with the refund computed now. `expectedGrossFn` / `expectedNetFn`: the outcome the member saw —
 * when FN were used since, nothing is filed and the new outcome comes back (CHANGED).
 */
export async function requestChargeRefund(input: unknown): Promise<RefundRequestResult> {
  if (!USE_MOCK) throw new Error("Refund API is not connected yet.");
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const v = read(input);
  const reason = typeof v.reason === "string" ? v.reason.trim() : "";
  if (reason.length > REFUND_REASON_MAX) return { status: "INVALID", message: `사유는 ${REFUND_REASON_MAX}자 이내로 입력해 주세요.` };
  const expected = v.expectedGrossFn === undefined && v.expectedNetFn === undefined ? null : { grossFn: v.expectedGrossFn, netFn: v.expectedNetFn };
  if (expected && (!isAmount(expected.grossFn) || !isAmount(expected.netFn))) return { status: "INVALID", message: "환불 금액을 다시 확인해 주세요." };

  // From here to the reservation nothing awaits: the policy check and the stored amounts see the same wallet.
  const charge = listChargeRecords().find((c) => c.id === v.chargeId);
  if (!charge) return { status: "INVALID", message: "충전 내역을 찾을 수 없어요." };
  const existing = mockRefunds.requests.find((r) => r.chargeId === charge.id);
  if (existing) return refundView(existing);
  if (charge.status !== "COMPLETED") return { status: "INVALID", message: "완료된 충전만 환불을 요청할 수 있어요." };

  const now = new Date();
  const quote = chargeRefundQuote(charge, now);
  const amounts = refundAmounts(quote);
  if (!amounts) return { status: "NOT_REFUNDABLE", quote };
  if (expected && (expected.grossFn !== amounts.grossFn || expected.netFn !== amounts.netFn)) return { status: "CHANGED", quote };

  // Reserve before the delay so a double submit cannot create two requests.
  // The owner is kept with the request: after a 탈퇴 · 재가입 the admin console must not attribute it to the new account.
  const request = { chargeId: charge.id, memberId: session.userId, accountSince: accountSince(), requestedAt: now.toISOString(), reason, status: "REQUESTED" as const, quote: amounts };
  mockRefunds.requests.push(request);
  await mockDelay(400);
  // TODO: the backend holds the refundable FN and queues the admin review (target: 접수 후 3영업일 이내 처리).
  return refundView(request);
}
