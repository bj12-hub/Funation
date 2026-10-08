import { randomUUID } from "node:crypto";
import { CODE_TTL_SECONDS, type VerificationPurpose } from "./verificationTypes";

/**
 * Phone verification state — server-only, not a "use server" module, so sign-up and password reset can
 * consume a verification without the browser being able to mint one.
 *
 * A code is accepted only if it was sent to that phone for that purpose less than CODE_TTL_SECONDS ago
 * (Figma 13:63 · 720:60: 3 minutes) and fewer than MAX_CODE_ATTEMPTS wrong codes were tried on it. A correct
 * code is used up and gives a random, single-use token bound to the phone and the purpose.
 * 2026-10-08 결정 (기본값): 5 wrong codes invalidate the code, a code lives 3 minutes (CODE_TTL_SECONDS = 180) and a
 * verified phone must be used within 30 minutes. TBD with the backend: SMS provider, send rate limits.
 */

/** Mock SMS: every sent code is this one. */
const MOCK_CODE = "123456";
/** Wrong codes per sent code: the 5th wrong code invalidates it, also for the right code after it (2026-10-08 결정). */
export const MAX_CODE_ATTEMPTS = 5;
/** How long a verified phone can be used for the sign-up / reset that follows: 30 minutes (2026-10-08 결정). */
export const VERIFIED_TOKEN_TTL_MS = 30 * 60_000;

type SentCode = { phone: string; purpose: VerificationPurpose; code: string; sentAt: number; attempts: number };
type VerifiedToken = { token: string; phone: string; purpose: VerificationPurpose; expiresAt: number; used: boolean };
type Store = { sent: Map<string, SentCode>; tokens: Map<string, VerifiedToken> };

const g = globalThis as typeof globalThis & { __ssumnationMockVerificationV1?: Store };
const store = (): Store => (g.__ssumnationMockVerificationV1 ??= { sent: new Map(), tokens: new Map() });
const sentKey = (phone: string, purpose: VerificationPurpose) => `${purpose}:${phone}`;

/** A new code replaces the previous one for this phone and purpose (and its wrong attempts). */
export function recordSentCode(phone: string, purpose: VerificationPurpose, now = Date.now()) {
  store().sent.set(sentKey(phone, purpose), { phone, purpose, code: MOCK_CODE, sentAt: now, attempts: 0 });
}

/** The verification token for a correct, unexpired code that was sent for this purpose, or null. */
export function verifySentCode(phone: string, purpose: VerificationPurpose, code: string, now = Date.now()): string | null {
  const key = sentKey(phone, purpose);
  const sent = store().sent.get(key);
  if (!sent || now - sent.sentAt >= CODE_TTL_SECONDS * 1000 || sent.attempts >= MAX_CODE_ATTEMPTS) return null;
  if (code !== sent.code) {
    sent.attempts += 1;
    return null;
  }
  store().sent.delete(key); // one verification per sent code
  const token = randomUUID();
  store().tokens.set(token, { token, phone, purpose, expiresAt: now + VERIFIED_TOKEN_TTL_MS, used: false });
  return token;
}

function usableToken(token: unknown, purpose: VerificationPurpose, now: number) {
  const t = typeof token === "string" ? store().tokens.get(token) : undefined;
  return t && !t.used && t.purpose === purpose && now < t.expiresAt ? t : null;
}

/** The phone a usable token (this purpose, not expired, not used) verified, without using it up; or null. */
export const verifiedPhone = (token: unknown, purpose: VerificationPurpose, now = Date.now()) => usableToken(token, purpose, now)?.phone ?? null;

/**
 * Uses up a verification token for this purpose and returns the verified phone, or null when the token is
 * unknown, for another purpose, expired or already used. Call it in the same synchronous step as the write.
 */
export function consumeVerificationToken(token: unknown, purpose: VerificationPurpose, now = Date.now()): string | null {
  const t = usableToken(token, purpose, now);
  if (!t) return null;
  t.used = true;
  return t.phone;
}
