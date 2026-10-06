import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for secrets that arrive with a request (admin API token, overlay keys,
 * manager-link tokens, the bank-SMS key), so response timing never tells how much of a guess matched.
 * A value that is not a string, or an empty expected secret, never matches.
 */
export function sameSecret(given: unknown, expected: string): boolean {
  if (typeof given !== "string" || !expected) return false;
  const x = Buffer.from(given);
  const y = Buffer.from(expected);
  return x.length === y.length && timingSafeEqual(x, y);
}
