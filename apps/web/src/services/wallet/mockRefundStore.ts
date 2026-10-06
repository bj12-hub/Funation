/**
 * Development-only FN charge refund requests (code-first). The member files a request; an operator
 * approves (FN is taken back on the server) or rejects it in the admin console. KRW payout via the
 * payment provider and the refund policy itself are TBD.
 */

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
  decision?: { at: string; by: string; note: string };
  /**
   * The FN taken back on approval — the wallet record of that balance change (docs/domains/wallet.md).
   * `at` is local "YYYY-MM-DD HH:mm:ss" like the other wallet records.
   */
  debit?: { fnAmount: number; at: string; by: string };
};

const g = globalThis as typeof globalThis & { __funationMockRefundsV2?: { requests: MockRefundRequest[] } };

export const mockRefunds = (g.__funationMockRefundsV2 ??= { requests: [] });

/** What the member sees of a request (the decision memo only when it was rejected). */
export function refundView(r: MockRefundRequest): ChargeRefund {
  return {
    status: r.status,
    requestedAt: r.requestedAt,
    ...(r.decision ? { decidedAt: r.decision.at } : {}),
    ...(r.status === "REJECTED" && r.decision ? { note: r.decision.note } : {})
  };
}
