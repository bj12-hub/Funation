import type { ChargeResult } from "./chargeTypes";
import type { ChargeRecord } from "./walletTypes";

/**
 * Development-only, in-memory wallet data for the charge mock. Server-side only; resets when the
 * dev server restarts. Kept on `globalThis` for the same reason as services/account/mockStore.ts.
 * The balance itself lives on the mock account (`mockAccount.fnBalance`).
 */

type IdempotencyEntry = {
  /** Request the key was first used with; a different request under the same key is a conflict. */
  fingerprint: string;
  /** `null` while the first request is still running. */
  result: ChargeResult | null;
};

type MockWalletState = {
  chargeTermsAgreedAt: string | null;
  marketingOptIn: boolean;
  /** Charges made through the mock, newest first (seed history is in walletHistory.ts). */
  charges: ChargeRecord[];
  idempotency: Record<string, IdempotencyEntry>;
};

const globalForWallet = globalThis as typeof globalThis & { __funationMockWallet?: MockWalletState };

export const mockWallet = (globalForWallet.__funationMockWallet ??= {
  chargeTermsAgreedAt: null,
  marketingOptIn: false,
  charges: [],
  idempotency: {}
});
