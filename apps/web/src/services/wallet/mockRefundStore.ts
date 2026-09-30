/**
 * Development-only FN charge refund requests (code-first). The member files a request; an operator
 * approves (FN is taken back on the server) or rejects it in the admin console. KRW payout via the
 * payment provider and the refund policy itself are TBD.
 */

export type RefundStatus = "REQUESTED" | "APPROVED" | "REJECTED";
export type MockRefundRequest = {
  chargeId: string;
  requestedAt: string;
  reason: string;
  status: RefundStatus;
  decision?: { at: string; by: string; note: string };
};

const g = globalThis as typeof globalThis & { __funationMockRefundsV1?: { requests: MockRefundRequest[] } };

export const mockRefunds = (g.__funationMockRefundsV1 ??= { requests: [] });
