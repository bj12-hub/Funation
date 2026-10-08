import type { SettlementStatus } from "@/services/creator/settlementTypes";

/**
 * 정산 심사 — code-first. Client-safe types. Fee and payout figures are the mock values computed by the
 * settlement service (all policy numbers are TBD, CLAUDE.md §14); the console only shows them.
 */

/** A settlement registration as the console shows it: member type label, masked account only. */
export type AdminSettlementRegistration = { memberType: string; registrant: string; holder: string; bankName: string; accountMasked: string; code: string; submittedAt: string };

export type AdminSettlementRow = {
  id: string;
  /** The studio channel's name, or a withdrawn creator's original nickname (`creatorWithdrawn`, shown with a 탈퇴 badge). */
  creatorName: string;
  creatorWithdrawn: boolean;
  status: SettlementStatus;
  requestedAt: string;
  periodFrom: string;
  periodTo: string;
  amountFn: number;
  feeFn: number;
  netKrw: number;
  payoutDate: string | null;
  /** 정산 정보 at request time (466:2) — what this request is reviewed and paid with. Null = cannot be approved. */
  registrationAtRequest: AdminSettlementRegistration | null;
  review: { at: string; by: string; note: string } | null;
};

export type AdminSettlementView = {
  rows: AdminSettlementRow[];
  counts: Record<SettlementStatus, number>;
  /** The creator's current registration (may differ from a request's `registrationAtRequest`). */
  registration: AdminSettlementRegistration | null;
  availableFn: number;
};

export const SETTLEMENT_NOTE = { min: 2, max: 200 } as const;

export type SettlementDecisionResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" };
