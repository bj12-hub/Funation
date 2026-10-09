import { sampleStamp, sampleTimes } from "@/services/wallet/mockWalletStore";
import type { PlatformDonationResult, PlatformKey } from "./platformTypes";

/**
 * Development-only platform donation records. Server-side only, kept on `globalThis` like the
 * other mock stores. The FN balance itself lives on the mock account (`mockAccount.fnBalance`).
 */

export type PlatformTransactionStatus = "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDING" | "REFUNDED";

export type MockPlatformTransaction = {
  transactionId: string;
  externalTransactionId: string | null;
  platform: PlatformKey;
  creatorId: string;
  creatorName: string;
  productLabel: string;
  fnAmount: number;
  message: string;
  status: PlatformTransactionStatus;
  failureReason: string | null;
  /** "YYYY-MM-DD HH:mm", server time. */
  createdAt: string;
  completedAt: string | null;
  /** The start marker of the account that sent it (`accountSince()`); missing or null = the first account (seed). */
  account?: string | null;
  /** ISO time of the request (`createdAt` is its local minute); the 24 h re-check window counts from it. */
  requestedAt: string;
  /**
   * Where the request's Idempotency-Key entry is in `idempotency` — the member's key under the member (`memberKeyOf`,
   * lib/records.ts; a 재가입 moves it to the withdrawn account's id). Null for the seed rows.
   */
  requestKey: string | null;
  /**
   * The key the platform adapter was given for it — derived from the member and the member's key, never the member's
   * own (./platformKey.ts) — so a status lookup asks by it. Null for the seed rows.
   */
  platformKey: string | null;
  /**
   * Set when the platform did not answer (PENDING, FN held). `lastCheckAt`: the last status lookup (lazy re-check or
   * the console's 다시 확인). Kept after the result is known, so the console still lists what it decided.
   */
  pending?: { lastCheckAt: string | null };
  /** How a PENDING transaction was settled (2026-10-08 결정): by a platform re-check or by an operator in 확인 중 후원. */
  resolution?: PlatformResolution;
};

/**
 * `fnReturn` (FAILED only): RETURNED = the held FN went back to the account that sent it; FORFEITED = that account has
 * withdrawn since, so nothing was credited (a 재가입 account never gets it) and the FN is gone like the rest of the
 * withdrawn account's FN. `requestId`: the console request that decided it (operator only).
 */
export type PlatformResolution = {
  outcome: "COMPLETED" | "FAILED";
  at: string;
  by: "PLATFORM" | "OPERATOR";
  operator: string | null;
  note: string | null;
  requestId: string | null;
  fnReturn: "RETURNED" | "FORFEITED" | null;
};

type MockPlatformState = {
  transactions: MockPlatformTransaction[];
  /**
   * The member's Idempotency-Key, per member (`memberKeyOf`) → first request fingerprint and result (`null` while
   * running). Another member sending the same key gets a donation of their own.
   */
  idempotency: Record<string, { fingerprint: string; result: PlatformDonationResult | null }>;
};

/** A sample row's time, on the wallet's fixed sample dates (`sampleTimes`: never after the wallet store was created). */
const dayAt = (daysAgo: number, time: string) => sampleTimes([{ daysAgo, time }])[0];
/** "YYYY-MM-DD HH:mm". */
const stamp = (daysAgo: number, time: string) => sampleStamp(dayAt(daysAgo, time)).slice(0, 16);

/**
 * Sample rows from 817:8038 (history), dated relative to the day the mock wallet store was created, like the wallet's
 * sample history. No FN was debited for these (the sample balance is a sample too). The PROCESSING row is a platform
 * result still unknown after 24 h, so 확인 중 후원 has an item.
 */
function seed(): MockPlatformTransaction[] {
  const row = (
    id: string,
    platform: PlatformKey,
    creatorId: string,
    creatorName: string,
    productLabel: string,
    fnAmount: number,
    status: PlatformTransactionStatus,
    daysAgo: number,
    time: string,
    ext: string | null
  ): MockPlatformTransaction => ({
    transactionId: id,
    externalTransactionId: ext,
    platform,
    creatorId,
    creatorName,
    productLabel,
    fnAmount,
    message: "",
    status,
    failureReason: null,
    createdAt: stamp(daysAgo, time),
    completedAt: status === "PROCESSING" ? null : stamp(daysAgo, time),
    requestedAt: dayAt(daysAgo, time).toISOString(),
    requestKey: null,
    platformKey: null,
    ...(status === "PROCESSING" ? { pending: { lastCheckAt: null } } : {})
  });
  return [
    row("TXN-SEED-A81", "SOOP", "kim_stream", "김스트리머", "별풍선 30개", 30_000, "COMPLETED", 7, "14:31", "SP-SEED-8F2A91"),
    row("TXN-SEED-B12", "FLEXTV", "flexman_live", "플렉스맨", "박수", 10_000, "PROCESSING", 7, "14:28", null),
    row("TXN-SEED-C34", "FLEXTV", "todaylive_flex", "오늘도라이브", "응원", 5_000, "REFUNDING", 9, "18:42", "FT-SEED-1C77E0"),
    row("TXN-SEED-D56", "SOOP", "gameking", "게임왕", "별풍선 10개", 10_000, "REFUNDED", 10, "09:11", "SP-SEED-5B03D2")
  ];
}

// V4: keys are per member, and a transaction keeps its entry's key and the key the platform was given (V3: transactions
// keep their request time, Idempotency-Key, PENDING re-check state and resolution).
const globalForPlatform = globalThis as typeof globalThis & { __ssumnationMockPlatformV4?: MockPlatformState };

export const mockPlatform = (globalForPlatform.__ssumnationMockPlatformV4 ??= { transactions: seed(), idempotency: {} });
