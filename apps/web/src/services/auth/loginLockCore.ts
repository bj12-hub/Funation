import { accountSince, isWithdrawn } from "@/services/account/withdrawalCore";
import { SAMPLE_MEMBER_ID } from "@/services/admin/memberCore";

/**
 * Password failure counting and the login lock (Figma 718:213) — server-only, not a "use server" module,
 * so the login, the 마이페이지 password change and the password reset share one counter and none of it is
 * callable from the browser.
 *
 * Failures are counted per account, not per typed identifier: the identifier is trimmed, lowercased and
 * resolved to its account first, so typing the same account differently does not start a new count.
 * After MAX_PASSWORD_FAILURES wrong passwords the account is locked until a password reset (718:213 copy)
 * or a successful login before that. TBD: whether a lock also expires after some time (policy), and
 * per-IP / per-device counting (backend).
 */

export const MAX_PASSWORD_FAILURES = 5;

type Store = { failures: Map<string, number> };
const g = globalThis as typeof globalThis & { __funationMockLoginLockV1?: Store };
const store = (): Store => (g.__funationMockLoginLockV1 ??= { failures: new Map() });

/**
 * The mock's one account slot. A 재가입 account gets its own key (its start marker), so it does not
 * inherit the withdrawn account's failures.
 */
export const currentAccountKey = () => {
  const since = accountSince();
  return since ? `${SAMPLE_MEMBER_ID}@${since}` : SAMPLE_MEMBER_ID;
};

/**
 * Mock directory: "unknown" (any case or spacing) is not registered; every other identifier is the sample
 * account, until it withdrew. The backend resolves an email or ID to the account the same way.
 */
export function resolveAccount(identifier: unknown): string | null {
  if (typeof identifier !== "string") return null;
  const id = identifier.trim().toLowerCase();
  if (!id || id === "unknown" || isWithdrawn()) return null;
  return currentAccountKey();
}

export const isPasswordLocked = (account: string) => (store().failures.get(account) ?? 0) >= MAX_PASSWORD_FAILURES;

/** Counts one wrong password; true when the account is now locked. */
export function recordPasswordFailure(account: string): boolean {
  const count = (store().failures.get(account) ?? 0) + 1;
  store().failures.set(account, count);
  return count >= MAX_PASSWORD_FAILURES;
}

/** After a correct password (unlocked account) or a password reset. */
export function clearPasswordFailures(account: string) {
  store().failures.delete(account);
}
