import type { SettlementStatus } from "@/services/creator/settlementTypes";
import type { AdminHold } from "./adminTypes";

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
  /** 지급 완료: when, by whom, and the transfer reference the operator recorded (PAID only). */
  payment: { at: string; by: string; reference: string } | null;
  /** 보류 in force (심사 대기 · 승인 only): 승인 · 반려 · 지급 완료 are refused until 보류 해제 (2026-10-08 결정). */
  hold: AdminHold | null;
};

/** The console's 정산 심사 tabs: a status, or `HELD` = every request on 보류 (심사 대기 and 승인). */
export type SettlementFilter = SettlementStatus | "HELD";

export type AdminSettlementView = {
  rows: AdminSettlementRow[];
  /**
   * Requests per status, without those on 보류 — they are counted in `held` instead, so 심사 대기 and 승인 are what an
   * operator can process now and every request is in exactly one tab.
   */
  counts: Record<SettlementStatus, number>;
  held: number;
  /** The creator's current registration (may differ from a request's `registrationAtRequest`). */
  registration: AdminSettlementRegistration | null;
  availableFn: number;
};

export const SETTLEMENT_NOTE = { min: 2, max: 200 } as const;
/** 지급 완료's transfer reference (이체 참조번호): letters, digits and hyphens; its real format depends on the payout provider (TBD). */
export const SETTLEMENT_REFERENCE = { min: 4, max: 40 } as const;

export type SettlementDecisionResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" };
