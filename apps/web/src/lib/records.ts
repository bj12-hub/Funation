/**
 * The own entry of a plain-object map for a key that comes from the client (request ids, idempotency keys,
 * platform video ids), or undefined. `map[key]` alone also finds Object.prototype members: "propertyIsEnumerable"
 * passes the request-id pattern and returns a function, and "__proto__" returns Object.prototype itself, so a
 * write through it would change every object in the process.
 */
export const ownEntry = <T>(map: Record<string, T>, key: string): T | undefined => (Object.hasOwn(map, key) ? map[key] : undefined);

/**
 * Where a member's retry key (Idempotency-Key, request id) is stored: under the member, so another member sending the
 * same value never gets this member's result or a conflict (docs/domains/donation.md "재시도 키 · 요청 id는 회원별").
 * A 재가입 moves the slot member's keys to the withdrawn account's own id (services/account/rejoin.ts).
 */
export const memberKeyOf = (memberId: string, key: string) => `${memberId}:${key}`;
