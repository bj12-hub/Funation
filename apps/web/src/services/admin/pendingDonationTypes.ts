/**
 * 확인 중 후원 (2026-10-08 결정) — client-safe types of the console list `/donations/pending` (admin app). SOOP · FlexTV
 * donations whose platform result is still unknown 24 hours after the request (FN held), and the ones decided there.
 */

export type PendingDonationOutcome = "COMPLETED" | "FAILED";

export type PendingDonationRow = {
  transactionId: string;
  platform: "SOOP" | "FLEXTV";
  /** "SOOP" · "FlexTV". */
  platformLabel: string;
  creatorName: string;
  productLabel: string;
  fnAmount: number;
  /** ISO time of the request; the 24 h count from it. */
  requestedAt: string;
  /** Who sent it: the original nickname, marked when that account has withdrawn since (also after a 재가입, `…-wN`). */
  memberId: string;
  memberName: string;
  memberWithdrawn: boolean;
  /** The last status lookup (lazy re-check or 다시 확인), or null. */
  lastCheckAt: string | null;
  /**
   * How it was settled. `fnReturn` (실패): RETURNED = the held FN went back; FORFEITED = the account had withdrawn, so
   * nothing was credited (반환 불가(탈퇴) · 소멸). `by`: PLATFORM = 다시 확인 found the platform's result.
   */
  resolution: {
    outcome: PendingDonationOutcome;
    at: string;
    by: "PLATFORM" | "OPERATOR";
    operator: string | null;
    note: string | null;
    fnReturn: "RETURNED" | "FORFEITED" | null;
    externalTransactionId: string | null;
  } | null;
};

/** `waiting`: 확인 필요 (oldest first). `resolved`: decided here (newest first). `checking`: still inside the 24 h. */
export type PendingDonationsView = { waiting: PendingDonationRow[]; resolved: PendingDonationRow[]; checking: number };

/** 다시 확인: what the platform answered (UNKNOWN = still no result; the item stays 확인 필요). */
export type PendingCheckResult =
  | { status: "OK"; outcome: PendingDonationOutcome | "UNKNOWN" }
  | { status: "INVALID"; message: string }
  | { status: "NOT_FOUND" };

export type PendingResolveResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" };

export const RESOLVE_NOTE = { min: 2, max: 200 } as const;
