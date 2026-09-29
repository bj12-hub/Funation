/**
 * Development-only record of FN credited without a payment (attendance rewards, promotions).
 * Every balance change must leave a wallet record (docs/domains/wallet.md) — the backend writes
 * these as wallet transactions. Server-side only, kept on `globalThis` like the other mock stores.
 */

export type MockCredit = { id: string; at: string; fnAmount: number; reason: string };

const g = globalThis as typeof globalThis & { __funationMockCreditsV1?: { credits: MockCredit[] } };

export const mockCredits = (g.__funationMockCreditsV1 ??= { credits: [] });

export function recordCredit(fnAmount: number, reason: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  mockCredits.credits.unshift({
    id: `cr-${now.getTime().toString(36)}-${mockCredits.credits.length}`,
    at: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    fnAmount,
    reason
  });
}
