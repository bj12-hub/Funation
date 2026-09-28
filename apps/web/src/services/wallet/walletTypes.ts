/**
 * FN wallet history types and display labels. Free of server-only imports so client
 * components can use them; data access lives in ./walletHistory.
 */

import type { Period } from "@/lib/period";

export type WalletSummary = {
  balance: number;
  available: number;
  /** FN due to expire; the expiry policy itself is TBD. */
  expiring: number;
};

export type ChargeStatus = "PROCESSING" | "COMPLETED" | "CANCELLED";

export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = { PROCESSING: "처리중", COMPLETED: "완료", CANCELLED: "취소" };

export type ChargeRecord = {
  id: string;
  /** "YYYY-MM-DD HH:mm:ss", server time. */
  chargedAt: string;
  methodEmoji: string;
  methodLabel: string;
  /** Extra method detail shown in the detail popup, e.g. "일시불". */
  methodDetail: string | null;
  fnAmount: number;
  /** KRW paid, as recorded by the payment provider. 0 when cancelled. */
  paidAmount: number;
  status: ChargeStatus;
  /** Transaction ID; `null` when no transaction was completed. */
  transactionId: string | null;
};

export type DonationCategory = "basic" | "quest" | "game";

export const DONATION_CATEGORY_LABEL: Record<DonationCategory, string> = { basic: "기본 후원", quest: "퀘스트 후원", game: "게임 후원" };

export type DonationStatus = "COMPLETED" | "PROCESSING" | "FAILED" | "REFUNDING" | "REFUNDED";

export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  COMPLETED: "완료",
  PROCESSING: "처리중",
  FAILED: "실패",
  REFUNDING: "환불중",
  REFUNDED: "환불완료"
};

export type DonationRecord = {
  id: string;
  donatedAt: string;
  creatorId: string;
  creatorName: string;
  message: string;
  fnAmount: number;
  typeLabel: string;
  status: DonationStatus;
};

export type HistoryPage<T> = { items: T[]; totalCount: number; page: number; totalPages: number; period: Period };

