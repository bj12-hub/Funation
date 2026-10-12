/**
 * 처리 중 충전 (2026-10-12 결정) — client-safe types of the console list `/payments/pending` (admin app). FN 충전 still
 * 처리중 (PROCESSING): the payment provider's confirmation has not come. An operator checks with the provider and decides
 * 결제 확인 (the FN are credited) or 결제 취소 (nothing is credited). How the provider confirms a payment (webhook · status
 * lookup) is TBD until it is connected.
 */

/** COMPLETED = 결제 확인 (FN 지급); CANCELLED = 결제 취소 (미지급). */
export type PendingChargeOutcome = "COMPLETED" | "CANCELLED";

/**
 * What a decision did. CREDITED: the FN went to the account that made the charge. NOT_CREDITED: 결제 확인, but that
 * account had withdrawn, so nothing was credited (완료 · FN 미지급 (탈퇴), 2026-10-10 결정 — what happens to the KRW paid
 * is TBD). CANCELLED: 결제 취소, nothing credited.
 */
export type PendingChargeResult = "CREDITED" | "NOT_CREDITED" | "CANCELLED";

export type PendingChargeRow = {
  chargeId: string;
  /** When the member asked for it: the site's zone-less Korea-time stamp "YYYY-MM-DD HH:mm:ss". */
  chargedAt: string;
  methodLabel: string;
  fnAmount: number;
  /** KRW of the payment the charge waits for (as it was while waiting, also once 결제 취소 recorded it as 0). */
  paidAmount: number;
  /** As it was while waiting (a 결제 취소 charge no longer has one in the member's history). */
  transactionId: string | null;
  /** Whose: the original nickname, marked when that account has withdrawn (also after a 재가입, `…-wN`). */
  memberId: string;
  memberName: string;
  memberWithdrawn: boolean;
  /** The console's decision (`at`: ISO), or null while it waits. */
  resolution: { outcome: PendingChargeOutcome; result: PendingChargeResult; at: string; operator: string; note: string } | null;
};

/** `waiting`: 확인 필요 (oldest first). `resolved`: decided here (newest first). */
export type PendingChargesView = { waiting: PendingChargeRow[]; resolved: PendingChargeRow[] };

/** OK answers what the decision did (also for a retry of it). */
export type PendingChargeResolveResult = { status: "OK"; result: PendingChargeResult } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" };

export const CHARGE_RESOLVE_NOTE = { min: 2, max: 200 } as const;
