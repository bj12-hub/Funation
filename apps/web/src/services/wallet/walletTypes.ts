/**
 * FN wallet history types and display labels. Free of server-only imports so client
 * components can use them; data access lives in ./walletHistory.
 */

import type { Period } from "@/lib/period";
import type { RefundAmounts, RefundQuote } from "./refundPolicy";

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
  refund?: ChargeRefund | null;
};

export type RefundStatus = "REQUESTED" | "APPROVED" | "REJECTED";
/**
 * A charge's refund request as the member sees it; `note` is the operator's memo, shown for a rejection only.
 * `amounts`: the refund computed when it was requested (환불 정책 기본값) — once approved, what approval refunded.
 * `requestedAmounts`: only when approval used other amounts than the request (FN were used in the meantime).
 */
export type ChargeRefund = {
  status: RefundStatus;
  requestedAt: string;
  decidedAt?: string;
  note?: string;
  amounts: RefundAmounts;
  requestedAmounts?: RefundAmounts;
};
export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = { REQUESTED: "환불 요청", APPROVED: "환불 완료", REJECTED: "환불 거절" };

/** The list tag and the CSV 환불 상태: "환불 요청 · 전액 취소", "환불 완료 · 수수료 공제", "환불 거절". */
export function refundStatusText(refund: Pick<ChargeRefund, "status" | "amounts">): string {
  if (refund.status === "REJECTED") return REFUND_STATUS_LABEL.REJECTED;
  return `${REFUND_STATUS_LABEL[refund.status]} · ${refund.amounts.type === "FULL_CANCEL" ? "전액 취소" : "수수료 공제"}`;
}

export const REFUND_REASON_MAX = 200;
/**
 * A repeat request returns the existing one as it is now (also after an operator decided it). NOT_REFUNDABLE: nothing
 * of the charge is refundable now; CHANGED: the outcome is no longer the one the member saw (`expectedGrossFn` /
 * `expectedNetFn`) — no request is filed, the member checks the new `quote` and asks again.
 */
export type RefundRequestResult =
  | ChargeRefund
  | { status: "NOT_REFUNDABLE"; quote: RefundQuote }
  | { status: "CHANGED"; quote: RefundQuote }
  | { status: "INVALID"; message: string }
  | { status: "UNAUTHORIZED" };
/** The outcome shown before the member asks; a charge that already has a request answers with that request. */
export type RefundQuoteResult = { status: "QUOTE"; quote: RefundQuote } | ChargeRefund | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

import type { QuestView } from "@/services/donations/questTypes";

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

/** A failed 플랫폼 후원's held FN that went back (후원 내역: "실패 · FN 반환"). */
export const FN_RETURNED_LABEL = "FN 반환";

/** The 처리 상태 a donation row shows (FN 후원내역, its CSV and the FN Wallet list). */
export const donationStatusLabel = (d: Pick<DonationRecord, "status" | "fnReturned">) => (d.fnReturned && d.status === "REFUNDED" ? FN_RETURNED_LABEL : DONATION_STATUS_LABEL[d.status]);

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
  /** When a refund completed (e.g. a failed 퀘스트 후원), or when the FN of a failed 플랫폼 후원 went back. */
  refundedAt?: string;
  /**
   * A 플랫폼 후원 (SOOP · FlexTV) whose platform result was 실패 and whose held FN went back (`REFUNDED` status): shown as
   * "FN 반환", not 환불완료 (2026-10-09 결정) — it was never a refund.
   */
  fnReturned?: boolean;
  /** 퀘스트 후원 rows: the quest's result and whether the member can decide it now. */
  quest?: QuestView;
  /** 룰렛 · 뽑기 rows: where the spin/draw is, or its result once revealed (e.g. "룰렛 결과 · 스탬프 당첨"). */
  gameResult?: string;
};

// ── FN Wallet (Figma 817:7552) ─────────────────────────────────────────────────

/**
 * REWARD: FN credited without a payment (출석 보상 등). RETURN: the held FN of a failed 플랫폼 후원 going back (+) — its own
 * type "FN 반환", not 환불 (2026-10-09 결정); real refunds (퀘스트 실패 · 취소, 충전 환불) stay REFUND. FORFEIT: free FN
 * written off by 남은 FN 정리 of a 영구 정지 member (2026-10-08 결정) — listed under 전체 유형 only (no filter chip).
 */
export type LedgerKind = "CHARGE" | "USE" | "REFUND" | "RETURN" | "REWARD" | "FORFEIT";
export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = { CHARGE: "충전", USE: "사용", REFUND: "환불", RETURN: FN_RETURNED_LABEL, REWARD: "적립", FORFEIT: "소멸" };
/** The FN Wallet's 유형 filter chips, in order (FORFEIT has none). */
export const LEDGER_FILTER_KINDS = ["CHARGE", "USE", "REFUND", "RETURN", "REWARD"] as const satisfies readonly LedgerKind[];
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
  /** Signed FN change: + for 충전 · 환불 · FN 반환 · 적립, − for 사용 · 충전 환불 · 소멸. */
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

