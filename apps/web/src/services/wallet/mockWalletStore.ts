import type { ChargeResult } from "./chargeTypes";
import type { DonationResult } from "@/services/donations/donationTypes";
import type { ChargeRecord, DonationCategory, DonationRecord } from "./walletTypes";

/**
 * Development-only, in-memory wallet data for the charge and donation mocks. Server-side only;
 * resets when the dev server restarts. Kept on `globalThis` for the same reason as
 * services/account/mockStore.ts. The balance itself lives on the mock account (`mockAccount.fnBalance`).
 */

type IdempotencyEntry<R> = {
  /** Request the key was first used with; a different request under the same key is a conflict. */
  fingerprint: string;
  /** `null` while the first request is still running. */
  result: R | null;
};

type MockWalletState = {
  chargeTermsAgreedAt: string | null;
  marketingOptIn: boolean;
  /** Charges made through the mock, newest first (seed history is in walletHistory.ts). */
  charges: ChargeRecord[];
  /**
   * Donations made through the mock, newest first. `hideProfile`: sent with 프로필 숨기기 (shown as 익명), so public
   * totals and rankings never put it under the member's name (absent = shown, e.g. platform donations).
   */
  donations: (DonationRecord & { category: DonationCategory; hideProfile?: boolean })[];
  idempotency: Record<string, IdempotencyEntry<ChargeResult>>;
  donationIdempotency: Record<string, IdempotencyEntry<DonationResult>>;
};

// Bump the key when the state shape changes so a running dev server starts from fresh data.
// V3: donation records keep `hideProfile`.
const globalForWallet = globalThis as typeof globalThis & { __funationMockWalletV3?: MockWalletState };

export const mockWallet = (globalForWallet.__funationMockWalletV3 ??= {
  chargeTermsAgreedAt: null,
  marketingOptIn: false,
  charges: [],
  donations: [],
  idempotency: {},
  donationIdempotency: {}
});
