import type { ChargeRecord, DonationRecord, DonationStatus } from "@/services/wallet/walletTypes";

/** 후원 · 결제 운영 — code-first. Client-safe types. Refund policy and KRW payout are TBD. */

export type AdminRefund = {
  chargeId: string;
  memberId: string;
  memberName: string;
  /** Filed by an account that has since withdrawn; the console cannot decide it (what a 탈퇴 does to it is TBD). */
  memberWithdrawn: boolean;
  requestedAt: string;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  decision: { at: string; by: string; note: string } | null;
  charge: Pick<ChargeRecord, "chargedAt" | "fnAmount" | "paidAmount" | "methodLabel" | "transactionId"> | null;
};

export type AdminChargeRow = ChargeRecord & { memberId: string; memberName: string };

export type AdminDonationRow = DonationRecord & { memberId: string; memberName: string };

export type PaymentsView = { charges: AdminChargeRow[]; refunds: AdminRefund[]; balance: number };

export type DonationsView = {
  rows: AdminDonationRow[];
  byStatus: Record<DonationStatus, { count: number; fn: number }>;
  byType: { typeLabel: string; count: number; fn: number }[];
};

export const REFUND_NOTE = { min: 2, max: 200 } as const;

/** Shown instead of the nickname for requests of a withdrawn account (the slot may belong to a new account now). */
export const WITHDRAWN_MEMBER_NAME = "탈퇴한 회원";

export type RefundDecisionResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" };
