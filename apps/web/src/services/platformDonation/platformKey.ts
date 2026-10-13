import { createHmac, randomBytes } from "node:crypto";

/**
 * The Idempotency-Key a platform adapter gets for a member's 플랫폼 후원 — server-only (node:crypto: import it only from
 * server modules, never from a client component or anything one imports). The member's own key stays with Ssumnation;
 * the platform gets a key derived from the member and that key with a server secret: the same for the same member and
 * key (a retry reaches the platform under the same key), different for two members who send the same key, and neither
 * the member id nor the member's key can be read back from it. Stored on the transaction (`platformKey`), so status
 * lookups ask by the key the platform was given.
 *
 * `account`: the account's start marker (`accountSince()`, null for the slot's first account). The mock's 재가입 gives the
 * new account the slot's member id again (account/rejoin.ts), so the key names the account too: a 재가입 account sending
 * the withdrawn account's member key is another member at the platform as well, not a retry of that account's donation
 * (the backend's member ids differ anyway). The first account's keys are unchanged by it.
 */

// Not under __ssumnationMock*: test resets keep it (the backend keeps a server secret).
const g = globalThis as typeof globalThis & { __ssumnationPlatformKeySecret?: Buffer };
const secret = () => (g.__ssumnationPlatformKeySecret ??= randomBytes(32));

/** "pk-" + 40 hex characters: within the Idempotency-Key pattern (16–64 of [A-Za-z0-9-]). */
export const platformKeyFor = (memberId: string, key: string, account: string | null = null) =>
  `pk-${createHmac("sha256", secret())
    .update(`${account === null ? memberId : `${memberId}@${account}`}\n${key}`)
    .digest("hex")
    .slice(0, 40)}`;
