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
};

type MockPlatformState = {
  transactions: MockPlatformTransaction[];
  /** Idempotency-Key → first request fingerprint and result (`null` while running). */
  idempotency: Record<string, { fingerprint: string; result: PlatformDonationResult | null }>;
};

const stamp = (daysAgo: number, time: string) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${time}`;
};

/** Sample rows from 817:8038 (history), dated relative to today. No FN was debited for these. */
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
    completedAt: status === "PROCESSING" ? null : stamp(daysAgo, time)
  });
  return [
    row("TXN-SEED-A81", "SOOP", "kim_stream", "김스트리머", "별풍선 30개", 30_000, "COMPLETED", 7, "14:31", "SP-SEED-8F2A91"),
    row("TXN-SEED-B12", "FLEXTV", "flexman_live", "플렉스맨", "박수", 10_000, "PROCESSING", 7, "14:28", null),
    row("TXN-SEED-C34", "FLEXTV", "todaylive_flex", "오늘도라이브", "응원", 5_000, "REFUNDING", 9, "18:42", "FT-SEED-1C77E0"),
    row("TXN-SEED-D56", "SOOP", "gameking", "게임왕", "별풍선 10개", 10_000, "REFUNDED", 10, "09:11", "SP-SEED-5B03D2")
  ];
}

const globalForPlatform = globalThis as typeof globalThis & { __funationMockPlatformV2?: MockPlatformState };

export const mockPlatform = (globalForPlatform.__funationMockPlatformV2 ??= { transactions: seed(), idempotency: {} });
