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

/**
 * 접속 기록 (account/retentionPolicy.ts ACCESS_LOG, kept 3 months after a withdrawal — 기본값): successful logins, wrong
 * passwords and locks, per account. The mock keeps the newest ACCESS_LOG_MAX; nothing shows them yet (backend: IP,
 * device and the retention of active members' logs are TBD).
 */
export type AccessEvent = { account: string; at: string; event: "LOGIN" | "FAILURE" | "LOCKED" };
const ACCESS_LOG_MAX = 500;

type Store = { failures: Map<string, number>; accessLog: AccessEvent[] };
// V2: the access log.
const g = globalThis as typeof globalThis & { __ssumnationMockLoginLockV2?: Store };
const store = (): Store => (g.__ssumnationMockLoginLockV2 ??= { failures: new Map(), accessLog: [] });

/** The login key of the slot account with this start marker (null = the first account). */
export const accountKeyOf = (since: string | null) => (since ? `${SAMPLE_MEMBER_ID}@${since}` : SAMPLE_MEMBER_ID);

/**
 * The mock's one account slot. A 재가입 account gets its own key (its start marker), so it does not
 * inherit the withdrawn account's failures.
 */
export const currentAccountKey = () => accountKeyOf(accountSince());

function logAccess(account: string, event: AccessEvent["event"]) {
  const log = store().accessLog;
  log.push({ account, at: new Date().toISOString(), event });
  if (log.length > ACCESS_LOG_MAX) log.splice(0, log.length - ACCESS_LOG_MAX);
}

/** A successful login of the account. */
export const recordLogin = (account: string) => logAccess(account, "LOGIN");

/** The account's 접속 기록 (oldest first). */
export const accessLogOf = (account: string) => store().accessLog.filter((e) => e.account === account);

/** Removes an account's 접속 기록 and failure count (retention purge). */
export function forgetAccess(account: string) {
  const s = store();
  s.failures.delete(account);
  s.accessLog = s.accessLog.filter((e) => e.account !== account);
}

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
  logAccess(account, count >= MAX_PASSWORD_FAILURES ? "LOCKED" : "FAILURE");
  return count >= MAX_PASSWORD_FAILURES;
}

/** After a correct password (unlocked account) or a password reset. */
export function clearPasswordFailures(account: string) {
  store().failures.delete(account);
}
