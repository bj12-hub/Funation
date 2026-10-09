import { accountSince } from "@/services/account/withdrawalCore";
import type { ChargeRefundLine } from "./refundPolicy";

/**
 * Development-only record of 남은 FN 정리 (2026-10-08 결정): an operator settles the remaining FN of a 영구 정지 member,
 * who cannot sign in — each charge's unused paid FN refunded under the 환불 정책 기본값 (`refundPolicy.ts`), the free FN
 * forfeited, the balance zeroed. Every balance change leaves a wallet record: the FIFO reads these as RECLAIM / FORFEIT
 * (`refundCore.ts`) and the FN Wallet lists them (`walletHistory.ts`). Server-side only, on `globalThis` like the other
 * mock stores; how each payment method returns the KRW is TBD (payment provider).
 */
export type MockFnSettlement = {
  id: string;
  /** The console request id: the same id again answers OK without a second settlement or audit entry. */
  requestId: string;
  memberId: string;
  /** The start marker of the account settled (`accountSince()`), as refund requests and credits keep it. */
  accountSince: string | null;
  /** ISO time of the settlement; `ledgerAt`: the same moment as local "YYYY-MM-DD HH:mm:ss", like the other wallet records. */
  at: string;
  ledgerAt: string;
  by: string;
  note: string;
  /** The balance before; `lines` refund the paid FN of each charge (oldest first); `forfeitFn` the rest, written off. */
  balanceFn: number;
  lines: ChargeRefundLine[];
  forfeitFn: number;
};

const g = globalThis as typeof globalThis & { __ssumnationMockFnSettlementsV1?: { settlements: MockFnSettlement[] } };

export const mockFnSettlements = (g.__ssumnationMockFnSettlementsV1 ??= { settlements: [] });

/** Settlements of the account holding the slot now (a withdrawn account's stay with its own start marker). */
export const currentAccountFnSettlements = () => mockFnSettlements.settlements.filter((s) => s.accountSince === accountSince());
