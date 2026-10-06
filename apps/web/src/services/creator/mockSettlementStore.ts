import { randomBytes } from "node:crypto";
import type { MemberType, SettlementHistoryItem, SettlementStatus } from "./settlementTypes";

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
  /**
   * Copy of the (masked) registration at request time. 466:2: requests already made are paid and
   * taxed with the 정산 정보 of that moment, so a later 정보 변경 never changes this request. Admin
   * review and approval read this copy, never the current registration. Missing = cannot be approved.
   */
  registrationAtRequest?: MockSettlementRegistration;
  /** 정산 심사 (관리자 콘솔): who decided and the note shown to the creator. */
  review?: { at: string; by: string; note: string };
};

type MockSettlement = {
  /** Consent from the 이용동의 step; the form page requires it. */
  terms: { memberType: MemberType; acceptedAt: string } | null;
  registration: MockSettlementRegistration | null;
  /** Creator earnings available to request, in FN (server-side source of truth in the mock). */
  availableFn: number;
  autoSettlement: boolean;
  requests: MockSettlementRequest[];
  /**
   * Requests of a withdrawn account, moved here when a 재가입 starts a new account in the mock slot: the admin
   * console keeps listing them (as 탈퇴한 회원), the new account's creator screens never see them.
   */
  pastRequests?: MockSettlementRequest[];
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

/**
 * The registration the seed requests were made with (display values from the docs: 예시은행, masked
 * account, Figma sample code). Registered before the oldest seed request; since removed via 정보 변경,
 * so the creator starts unregistered.
 */
function seedRegistration(): MockSettlementRegistration {
  const now = new Date();
  return {
    memberType: "INDIVIDUAL",
    registrant: "홍길동",
    holder: "홍길동",
    bankName: "예시은행",
    accountMasked: "********1234",
    code: "F0L0E0X0",
    submittedAt: new Date(now.getFullYear(), now.getMonth() - 7, 1).toISOString()
  };
}

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
    payoutDate: status === "REJECTED" ? null : ymd(new Date(y, m + 1, 0)),
    registrationAtRequest: seedRegistration()
  };
}

/**
 * What the creator's browser gets for a request: the admin review (operator, internal memo) and the
 * registration copy stay on the server; only a 반려 사유 is shown, for rejected requests.
 */
export const toHistoryItem = (r: MockSettlementRequest): SettlementHistoryItem => ({
  id: r.id,
  status: r.status,
  requestedAt: r.requestedAt,
  periodFrom: r.periodFrom,
  periodTo: r.periodTo,
  amountFn: r.amountFn,
  feeFn: r.feeFn,
  netKrw: r.netKrw,
  payoutDate: r.payoutDate,
  reviewNote: r.status === "REJECTED" ? r.review?.note : undefined
});

// V4: requests carry `registrationAtRequest`; a new key re-seeds a running dev server with it.
const globalForSettlement = globalThis as typeof globalThis & { __funationMockSettlementV4?: MockSettlement };

/** Sample amounts from 478:2 (five 승인, one 거절), dated relative to today. */
export const mockSettlement = (globalForSettlement.__funationMockSettlementV4 ??= {
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
