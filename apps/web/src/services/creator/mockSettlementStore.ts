import type { MemberType } from "./settlementTypes";

/**
 * Development-only settlement state for the mock creator. Server-side only, kept on `globalThis`
 * like mockCreatorStore.ts. Starts unregistered so the 정산 등록 flow (433:4 → 429:139 → form) is
 * reachable. Only masked identifiers are kept — the real backend stores verified data in a
 * dedicated, encrypted store (TBD) and never returns full ID or account numbers to the browser.
 */

export type MockSettlementRegistration = {
  memberType: MemberType;
  registrant: string;
  bankName: string;
  accountMasked: string;
  submittedAt: string;
};

type MockSettlement = {
  /** Consent from the 이용동의 step; the form page requires it. */
  terms: { memberType: MemberType; acceptedAt: string } | null;
  registration: MockSettlementRegistration | null;
};

const globalForSettlement = globalThis as typeof globalThis & { __funationMockSettlementV1?: MockSettlement };

export const mockSettlement = (globalForSettlement.__funationMockSettlementV1 ??= {
  terms: null,
  registration: null
});
