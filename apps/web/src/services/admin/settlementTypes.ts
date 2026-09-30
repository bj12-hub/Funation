import type { SettlementStatus } from "@/services/creator/settlementTypes";

/**
 * 정산 심사 — code-first. Client-safe types. Fee and payout figures are the mock values computed by the
 * settlement service (all policy numbers are TBD, CLAUDE.md §14); the console only shows them.
 */

export type AdminSettlementRow = {
  id: string;
  creatorName: string;
  status: SettlementStatus;
  requestedAt: string;
  periodFrom: string;
  periodTo: string;
  amountFn: number;
  feeFn: number;
  netKrw: number;
  payoutDate: string | null;
  review: { at: string; by: string; note: string } | null;
};

export type AdminSettlementView = {
  rows: AdminSettlementRow[];
  counts: Record<SettlementStatus, number>;
  registration: { memberType: string; registrant: string; holder: string; bankName: string; accountMasked: string; code: string; submittedAt: string } | null;
  availableFn: number;
};

export const SETTLEMENT_NOTE = { min: 2, max: 200 } as const;

export type SettlementDecisionResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" };
