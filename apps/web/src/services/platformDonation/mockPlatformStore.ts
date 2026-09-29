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
  createdAt: string;
  completedAt: string | null;
};

type MockPlatformState = {
  transactions: MockPlatformTransaction[];
  /** Idempotency-Key → first request fingerprint and result (`null` while running). */
  idempotency: Record<string, { fingerprint: string; result: PlatformDonationResult | null }>;
};

const globalForPlatform = globalThis as typeof globalThis & { __funationMockPlatformV1?: MockPlatformState };

export const mockPlatform = (globalForPlatform.__funationMockPlatformV1 ??= { transactions: [], idempotency: {} });
