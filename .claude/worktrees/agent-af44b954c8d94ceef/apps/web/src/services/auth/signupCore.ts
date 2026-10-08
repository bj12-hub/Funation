import { accountSince, isWithdrawn } from "@/services/account/withdrawalCore";

/**
 * Sign-up records — server-only, not a "use server" module, so the nickname rules can read them.
 *
 * The mock has one account slot (the sample member). A sign-up after a withdrawal becomes the new account in it
 * (services/account/rejoin.ts); a sign-up while the slot is in use is recorded here instead, so its e-mail and
 * nickname count as taken from then on. Mock limitation: such an account cannot sign in (the login mock knows the
 * slot only).
 */

type Store = { accounts: { email: string; nickname: string | null; createdAt: string }[] };
const g = globalThis as typeof globalThis & { __funationMockSignupsV1?: Store };
const store = (): Store => (g.__funationMockSignupsV1 ??= { accounts: [] });

/** The sample account's e-mail (also the one the e-mail password reset knows). */
const SAMPLE_ACCOUNT_EMAIL = "user@funation.kr";
// Values used in the Figma error frames (722:765, 722:1059) are treated as taken in the mock.
const FIGMA_TAKEN_EMAILS = ["hello@funation.kr"];

export function isEmailTaken(email: string) {
  const e = email.trim().toLowerCase();
  if (FIGMA_TAKEN_EMAILS.includes(e) || store().accounts.some((a) => a.email === e)) return true;
  // Whether a withdrawn account's e-mail stays reserved is TBD; the mock frees it, so the same person can 재가입
  // right away with it (2026-10-05 결정).
  return e === SAMPLE_ACCOUNT_EMAIL && accountSince() === null && !isWithdrawn();
}

/** `nickname`: only for an account outside the slot (the slot's nickname is the mock account's own). */
export function recordSignup(email: string, nickname: string | null, now = new Date()) {
  store().accounts.push({ email: email.trim().toLowerCase(), nickname, createdAt: now.toISOString() });
}

/** Nicknames of the accounts recorded outside the slot (other members). */
export const signedUpNicknames = () => store().accounts.flatMap((a) => (a.nickname ? [a.nickname] : []));
