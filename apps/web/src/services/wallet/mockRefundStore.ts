/**
 * Development-only FN charge refund requests (code-first). A request only records the member's
 * intent; no FN or KRW moves until the refund policy and an admin review exist (TBD).
 */

export type MockRefundRequest = { chargeId: string; requestedAt: string; reason: string; status: "REQUESTED" };

const g = globalThis as typeof globalThis & { __funationMockRefundsV1?: { requests: MockRefundRequest[] } };

export const mockRefunds = (g.__funationMockRefundsV1 ??= { requests: [] });
