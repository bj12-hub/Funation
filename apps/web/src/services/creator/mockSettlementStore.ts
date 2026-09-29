import { randomBytes } from "node:crypto";
import type { MemberType, SettlementStatus } from "./settlementTypes";

/**
 * Development-only settlement state for the mock creator. Server-side only, kept on `globalThis`
 * like mockCreatorStore.ts. Starts unregistered so the 정산 등록 flow (433:4 → 429:139 → form) is
 * reachable. Only masked identifiers are kept — the real backend stores verified data in a
 * dedicated, encrypted store (TBD) and never returns full ID or account numbers to the browser.
 */

export type MockSettlementRegistration = {
  memberType: MemberType;
  registrant: string;
  holder: string;
  bankName: string;
  accountMasked: string;
  /** 정산 코드 (458:92). Format TBD; Figma sample "F0L0E0X0". */
  code: string;
  submittedAt: string;
};

export type MockSettlementRequest = {
  id: string;
  status: SettlementStatus;
  /** yyyy-mm-dd */
  requestedAt: string;
  periodFrom: string;
  periodTo: string;
  amountFn: number;
  feeFn: number;
  netKrw: number;
  /** 지급(예정)일, yyyy-mm-dd; null when rejected. */
  payoutDate: string | null;
};

type MockSettlement = {
  /** Consent from the 이용동의 step; the form page requires it. */
  terms: { memberType: MemberType; acceptedAt: string } | null;
  registration: MockSettlementRegistration | null;
  /** Creator earnings available to request, in FN (server-side source of truth in the mock). */
  availableFn: number;
  autoSettlement: boolean;
  requests: MockSettlementRequest[];
  /** Idempotency-Key → created request id, so a retried submit never creates a second request. */
  idempotency: Record<string, string>;
};

/**
 * Settlement policy numbers as they appear in Figma samples (466:2 · 469:195 · 473:2 · 477:2).
 * None of these is approved (CLAUDE.md §14: minimum, fees, FN exchange rate are TBD); they exist
 * only so the mock screens can show the designed flow, and live on the server only.
 */
export const MOCK_SETTLEMENT_POLICY = {
  minFn: 40_000,
  paymentFeeRate: 0.066,
  serviceFeeRate: 0,
  krwPerFn: 1
} as const;

export const newSettlementCode = () =>
  randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "0");

const fee = (fn: number) => Math.round(fn * MOCK_SETTLEMENT_POLICY.paymentFeeRate);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** A request made `monthsAgo` months back on the 11th (Figma rows use 신청일 = 11일, 정산 기간 = previous month). */
function seed(monthsAgo: number, status: SettlementStatus, amountFn: number): MockSettlementRequest {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() - monthsAgo;
  return {
    id: `st-seed-${monthsAgo}`,
    status,
    requestedAt: ymd(new Date(y, m, 11)),
    periodFrom: ymd(new Date(y, m - 1, 1)),
    periodTo: ymd(new Date(y, m, 0)),
    amountFn,
    feeFn: status === "REJECTED" ? 0 : fee(amountFn),
    netKrw: status === "REJECTED" ? 0 : amountFn - fee(amountFn),
    payoutDate: status === "REJECTED" ? null : ymd(new Date(y, m + 1, 0))
  };
}

const globalForSettlement = globalThis as typeof globalThis & { __funationMockSettlementV3?: MockSettlement };

/** Sample amounts from 478:2 (five 승인, one 거절), dated relative to today. */
export const mockSettlement = (globalForSettlement.__funationMockSettlementV3 ??= {
  terms: null,
  registration: null,
  availableFn: 127_500,
  autoSettlement: false,
  requests: [
    seed(1, "APPROVED", 203_800),
    seed(2, "APPROVED", 98_200),
    seed(3, "APPROVED", 156_400),
    seed(4, "APPROVED", 87_300),
    seed(5, "APPROVED", 72_100),
    seed(6, "REJECTED", 45_000)
  ],
  idempotency: {}
});
