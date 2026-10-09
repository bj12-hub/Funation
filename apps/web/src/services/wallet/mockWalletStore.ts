import { toDateString } from "@/lib/period";
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
  /**
   * ISO time this store was created. The sample (seed) history — walletHistory.ts and the sample 플랫폼 후원 — is dated
   * from it once (`sampleTimes`), not from each read's "today", so on a dev server left running past midnight it stays
   * before every record written live since.
   */
  sampleAt: string;
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
// V5: the sample history is dated from `sampleAt` (V4: a failed 플랫폼 후원's record keeps `fnReturned`).
const globalForWallet = globalThis as typeof globalThis & { __ssumnationMockWalletV5?: MockWalletState };

export const mockWallet = (globalForWallet.__ssumnationMockWalletV5 ??= {
  sampleAt: new Date().toISOString(),
  chargeTermsAgreedAt: null,
  marketingOptIn: false,
  charges: [],
  donations: [],
  idempotency: {},
  donationIdempotency: {}
});

/**
 * Times of sample (seed) records, fixed by the store's creation (`sampleAt`) instead of each read's "today": a row is
 * `daysAgo` calendar days before the day the store was created, at `time` ("HH:mm" or "HH:mm:ss", server time). A row
 * that would not be before the store's creation (one of today's rows later in the day) moves to just before it — the
 * newest one second before, the next one second before that — so no sample record is dated after a record written live
 * and the rows keep their order. In the order of `rows`.
 */
export function sampleTimes(rows: readonly { daysAgo: number; time: string }[]): Date[] {
  const created = new Date(mockWallet.sampleAt);
  const at = rows.map(({ daysAgo, time }) => {
    const [h, m, s = 0] = time.split(":").map(Number);
    return new Date(created.getFullYear(), created.getMonth(), created.getDate() - daysAgo, h, m, s).getTime();
  });
  const out = [...at];
  const newestFirst = at.map((_, k) => k).sort((a, b) => at[b] - at[a]);
  let latest = Math.floor(created.getTime() / 1_000) * 1_000 - 1_000; // whole seconds, before the creation's second
  for (const i of newestFirst) {
    out[i] = Math.min(at[i], latest);
    latest = out[i] - 1_000;
  }
  return out.map((t) => new Date(t));
}

/** Local "YYYY-MM-DD HH:mm:ss" (server time), the wallet records' format. */
export const sampleStamp = (d: Date) => `${toDateString(d)} ${d.toTimeString().slice(0, 8)}`;
