import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMockStores } from "@/test/mockEnv";

/** Session roles and the Creator guard used by every creator service. */

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name)
  })
}));
vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));

async function load() {
  const session = await import("./session");
  const { mockSessionState } = await import("@/services/account/mockStore");
  return { ...session, mockSessionState };
}

describe("session roles", () => {
  beforeEach(() => {
    resetMockStores();
    cookieJar.clear();
  });

  it("has no session without the cookie", async () => {
    const { getSession, getCreatorSession } = await load();
    expect(await getSession()).toBeNull();
    expect(await getCreatorSession()).toBeNull();
  });

  it("ignores an unknown or forged token", async () => {
    const { getSession, SESSION_COOKIE } = await load();
    cookieJar.set(SESSION_COOKIE, "forged-token");
    expect(await getSession()).toBeNull();
  });

  it("resolves roles on the server and grants the creator guard", async () => {
    const { getSession, getCreatorSession, startSession, hasRole } = await load();
    await startSession({ keepSignedIn: false });
    const s = await getSession();
    expect(s?.roles).toEqual(["SUPPORTER", "CREATOR"]);
    expect(hasRole(s, "CREATOR")).toBe(true);
    expect(await getCreatorSession()).not.toBeNull();
  });

  it("denies the creator guard to a supporter-only member", async () => {
    const { getSession, getCreatorSession, startSession, mockSessionState } = await load();
    await startSession({ keepSignedIn: false });
    mockSessionState.roles = ["SUPPORTER"];
    expect(await getSession()).not.toBeNull();
    expect(await getCreatorSession()).toBeNull();
  });

  it("treats a revoked session as signed out", async () => {
    const { getSession, startSession, revokeSession } = await load();
    await startSession({ keepSignedIn: false });
    await revokeSession();
    expect(await getSession()).toBeNull();
  });
});
