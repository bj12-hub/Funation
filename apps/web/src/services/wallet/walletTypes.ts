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
  /** 환불 요청 (code-first). Present once the member asked for a refund; an operator decides it. */
  refund?: { status: "REQUESTED" | "APPROVED" | "REJECTED"; requestedAt: string; decidedAt?: string; note?: string } | null;
};

export const REFUND_REASON_MAX = 200;
export type RefundRequestResult = { status: "REQUESTED"; requestedAt: string } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

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

/** funnation 내 후원 내역 filters (validated by the page before reaching the service). */
export type DonationFilter = { q?: string; min?: number; max?: number; sort?: "latest" | "oldest" };
export const DONATION_QUERY_MAX = 40;

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

// ── FN Wallet (Figma 817:7552) ─────────────────────────────────────────────────

export type LedgerKind = "CHARGE" | "USE" | "REFUND" | "REWARD";
/** REWARD: FN credited without a payment (출석 보상 등). */
export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = { CHARGE: "충전", USE: "사용", REFUND: "환불", REWARD: "적립" };
export const LEDGER_PERIODS = [
  { key: "30", label: "최근 30일" },
  { key: "90", label: "최근 90일" },
  { key: "all", label: "전체 기간" }
] as const;
export type LedgerPeriod = (typeof LEDGER_PERIODS)[number]["key"];

export type LedgerEntry = {
  id: string;
  kind: LedgerKind;
  description: string;
  /** Signed FN change: + for 충전/환불, − for 사용. */
  deltaFn: number;
  statusLabel: string;
  tone: "done" | "pending" | "failed" | "refund";
  at: string;
};

export type WalletOverview = {
  available: number;
  /** FN held for in-flight requests. The locking policy is TBD, so the mock reports 0. */
  locked: number;
  totalUsed: number;
  kind: LedgerKind | "all";
  period: LedgerPeriod;
  entries: LedgerEntry[];
  page: number;
  totalPages: number;
};

export type HistoryPage<T> = { items: T[]; totalCount: number; page: number; totalPages: number; period: Period };

