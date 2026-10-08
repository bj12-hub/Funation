/**
 * The own entry of a plain-object map for a key that comes from the client (request ids, idempotency keys,
 * platform video ids), or undefined. `map[key]` alone also finds Object.prototype members: "propertyIsEnumerable"
 * passes the request-id pattern and returns a function, and "__proto__" returns Object.prototype itself, so a
 * write through it would change every object in the process.
 */
export const ownEntry = <T>(map: Record<string, T>, key: string): T | undefined => (Object.hasOwn(map, key) ? map[key] : undefined);
