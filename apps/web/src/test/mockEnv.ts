import { vi } from "vitest";
import type { Role } from "@/types/role";

/**
 * Test helpers for the mock backend. Services keep their state on `globalThis.__funationMock*`,
 * so each test clears those keys and re-imports the modules to start from the seed data.
 */

export const sessionState: { roles: Role[] | null } = { roles: ["SUPPORTER", "CREATOR"] };

/** Signed in with these roles, or signed out with `null`. */
export const signIn = (roles: Role[] | null = ["SUPPORTER", "CREATOR"]) => {
  sessionState.roles = roles;
};

export function mockSessionModule() {
  const session = () =>
    sessionState.roles ? { userId: "u-test", nickname: "홍길동", funationId: "hongGD123", avatarUrl: null, roles: [...sessionState.roles] } : null;
  return {
    SESSION_COOKIE: "funation_session",
    getSession: vi.fn(async () => session()),
    getCreatorSession: vi.fn(async () => (sessionState.roles?.includes("CREATOR") ? session() : null)),
    getAdminSession: vi.fn(async () => (sessionState.roles?.includes("ADMIN") ? session() : null)),
    startMockAdminSession: vi.fn(),
    hasRole: (s: { roles: Role[] } | null, role: Role) => !!s && s.roles.includes(role),
    startSession: vi.fn(),
    endSession: vi.fn(),
    revokeSession: vi.fn()
  };
}

export function resetMockStores() {
  for (const key of Object.keys(globalThis)) {
    if (key.startsWith("__funationMock")) delete (globalThis as Record<string, unknown>)[key];
  }
  vi.resetModules();
  signIn();
}

/** A valid Idempotency-Key (16–64 of [A-Za-z0-9-]). */
export const key = (n = 1) => `test-key-${String(n).padStart(8, "0")}`;
