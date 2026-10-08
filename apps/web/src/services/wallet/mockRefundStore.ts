/**
 * Development-only FN charge refund requests (code-first). The member files a request; an operator approves (FN is
 * taken back on the server) or rejects it in the admin console. The amounts follow the 환불 정책 기본값 (일반적인 기준,
 * 법무 검토 전 — `refundPolicy.ts`); KRW payout via the payment provider is TBD.
 */

import type { HoldEvent } from "@/services/admin/holdCore";
import { sameRefund, type RefundAmounts } from "./refundPolicy";
import type { ChargeRefund, RefundStatus } from "./walletTypes";

export type { RefundStatus };
export type MockRefundRequest = {
  chargeId: string;
  /** Who asked: the member id and the start marker of their account (`accountSince`, null for the first one). */
  memberId: string;
  accountSince: string | null;
  requestedAt: string;
  reason: string;
  status: RefundStatus;
  /** The refund computed when the member asked (type, FN taken back, fee, net) — what the member saw. */
  quote: RefundAmounts;
  /** What approval refunded: recomputed in the approval step, so it differs from `quote` when FN were used meanwhile. */
  settled?: RefundAmounts;
  decision?: { at: string; by: string; note: string };
  /**
   * The FN taken back on approval (`settled.grossFn`) — the wallet record of that balance change (docs/domains/wallet.md).
   * `at` is local "YYYY-MM-DD HH:mm:ss" like the other wallet records.
   */
  debit?: { fnAmount: number; at: string; by: string };
  /**
   * 보류 / 보류 해제 (관리자 콘솔, 2026-10-08 결정), oldest first: an operator flag on a waiting request that stops 승인 ·
   * 거절 while the last event is a 보류. The status stays REQUESTED and the member keeps seeing 심사 중.
   */
  holds?: HoldEvent[];
};

// V3: requests keep the computed refund (`quote`) and the approved one (`settled`); V4: and their `holds`.
const g = globalThis as typeof globalThis & { __ssumnationMockRefundsV4?: { requests: MockRefundRequest[] } };

export const mockRefunds = (g.__ssumnationMockRefundsV4 ??= { requests: [] });

const amounts = (a: RefundAmounts): RefundAmounts => ({ type: a.type, grossFn: a.grossFn, feeFn: a.feeFn, netFn: a.netFn });

/** What the member sees of a request (the decision memo only when it was rejected). */
export function refundView(r: MockRefundRequest): ChargeRefund {
  const changed = r.settled && !sameRefund(r.settled, r.quote);
  return {
    status: r.status,
    requestedAt: r.requestedAt,
    ...(r.decision ? { decidedAt: r.decision.at } : {}),
    ...(r.status === "REJECTED" && r.decision ? { note: r.decision.note } : {}),
    amounts: amounts(r.settled ?? r.quote),
    ...(changed ? { requestedAmounts: amounts(r.quote) } : {})
  };
}
