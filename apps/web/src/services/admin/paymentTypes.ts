import type { ChargeRecord, DonationRecord, DonationStatus, RefundStatus } from "@/services/wallet/walletTypes";

/** 후원 · 결제 운영 — code-first. Client-safe types. Refund policy and KRW payout are TBD. */

export type AdminRefund = {
  chargeId: string;
  memberId: string;
  /** The requester's nickname — also for a withdrawn account (2026-10-08 결정: original nickname + 탈퇴 badge). */
  memberName: string;
  /** Filed by an account that has since withdrawn: shown with a 탈퇴 badge, and the console cannot decide it. */
  memberWithdrawn: boolean;
  requestedAt: string;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  decision: { at: string; by: string; note: string } | null;
  charge: Pick<ChargeRecord, "chargedAt" | "fnAmount" | "paidAmount" | "methodLabel" | "transactionId"> | null;
};

/**
 * The fields the console shows — built field by field, so a record's other fields (messages, preferences) stay on the
 * server. `memberWithdrawn`: the member withdrew (the console adds a 탈퇴 badge to the original nickname).
 */
export type AdminChargeRow = Pick<ChargeRecord, "id" | "chargedAt" | "methodLabel" | "fnAmount" | "paidAmount" | "status" | "transactionId"> & {
  refund: { status: RefundStatus; requestedAt: string } | null;
  memberId: string;
  memberName: string;
  memberWithdrawn: boolean;
};

export type AdminDonationRow = Pick<DonationRecord, "id" | "donatedAt" | "creatorName" | "fnAmount" | "typeLabel" | "status"> & { memberId: string; memberName: string; memberWithdrawn: boolean };

export type PaymentsView = { charges: AdminChargeRow[]; refunds: AdminRefund[]; balance: number };

export type DonationsView = {
  rows: AdminDonationRow[];
  byStatus: Record<DonationStatus, { count: number; fn: number }>;
  byType: { typeLabel: string; count: number; fn: number }[];
};

export const REFUND_NOTE = { min: 2, max: 200 } as const;

/**
 * The author name the site shows for a withdrawn member's community content and block entries (2026-10-08 결정). The admin
 * console shows the original nickname with a 탈퇴 badge instead.
 */
export const WITHDRAWN_MEMBER_NAME = "탈퇴한 회원";

export type RefundDecisionResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" };
