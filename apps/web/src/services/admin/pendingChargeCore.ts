import type { PendingChargeOutcome, PendingChargeResult } from "./pendingChargeTypes";

/**
 * 처리 중 충전 decisions (2026-10-12 결정) — server-only store of the console's 결제 확인 / 결제 취소, not a "use server"
 * module: admin/pendingCharges.ts writes it, account/retentionPurge.ts removes a withdrawn account's with its other payment
 * records. Leaf module (no imports with side effects), so both can use it without cycles.
 *
 * Each record keeps the charge as it was while waiting (amount, transaction id): a 결제 취소 charge's record no longer has
 * them (walletHistory.ts: 0원, no transaction id), and the console still shows what was decided.
 */
export type ChargeDecision = {
  /** The console request id: a retry under it must carry the same charge, outcome and memo. */
  requestId: string;
  chargeId: string;
  outcome: PendingChargeOutcome;
  result: PendingChargeResult;
  note: string;
  operator: string;
  /** ISO time of the decision. */
  at: string;
  chargedAt: string;
  methodLabel: string;
  fnAmount: number;
  paidAmount: number;
  transactionId: string | null;
  /** The start marker of the account the charge is for (`accountSince`; the sample rows: the first account's, null). */
  account: string | null;
};

type Store = { decisions: ChargeDecision[] };

// V1: the console's decisions on 처리중 charges.
const g = globalThis as typeof globalThis & { __ssumnationMockChargeDecisionsV1?: Store };
export const chargeDecisions = (): Store => (g.__ssumnationMockChargeDecisionsV1 ??= { decisions: [] });
