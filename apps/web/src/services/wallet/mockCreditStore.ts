import { accountSince } from "@/services/account/withdrawalCore";

/**
 * Development-only record of FN credited without a payment (attendance rewards, promotions).
 * Every balance change must leave a wallet record (docs/domains/wallet.md) — the backend writes
 * these as wallet transactions. Server-side only, kept on `globalThis` like the other mock stores.
 */

/** `account`: the start marker (`accountSince()`) of the account credited, as refund requests keep it. */
export type MockCredit = { id: string; at: string; fnAmount: number; reason: string; account: string | null };

const g = globalThis as typeof globalThis & { __funationMockCreditsV2?: { credits: MockCredit[] } };

export const mockCredits = (g.__funationMockCreditsV2 ??= { credits: [] });

export function recordCredit(fnAmount: number, reason: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  mockCredits.credits.unshift({
    id: `cr-${now.getTime().toString(36)}-${mockCredits.credits.length}`,
    at: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    fnAmount,
    reason,
    account: accountSince()
  });
}

/** Credits of the current account only: after a 재가입 the withdrawn account's credits are not shown. */
export const currentAccountCredits = () => mockCredits.credits.filter((c) => c.account === accountSince());
