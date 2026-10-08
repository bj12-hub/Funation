import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Operator session: mock sign-in fails closed in production, and sign-out really clears the `__Host-` cookie. */
const jar = { set: vi.fn(), get: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const load = () => import("./session");

describe("operator session", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllEnvs();
    jar.set.mockReset();
    jar.get.mockReset();
    jar.delete.mockReset();
  });

  it("keeps the mock sign-in off in production unless it is explicitly turned on", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const v of [undefined, "", "1", "TRUE", "false"]) {
      if (v === undefined) delete process.env.ADMIN_USE_MOCK;
      else vi.stubEnv("ADMIN_USE_MOCK", v);
      expect((await load()).isMock()).toBe(false);
    }
    vi.stubEnv("ADMIN_USE_MOCK", "true");
    expect((await load()).isMock()).toBe(true);

    // A hand-made cookie does not sign anyone in while the mock is off.
    vi.stubEnv("ADMIN_USE_MOCK", "");
    jar.get.mockReturnValue({ value: "mock-operator" });
    expect(await (await load()).getOperator()).toBeNull();
    await expect((await load()).startMockOperatorSession()).rejects.toThrow();
  });

  it("keeps the mock sign-in on in development unless it is turned off", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_USE_MOCK", "");
    expect((await load()).isMock()).toBe(true);
    vi.stubEnv("ADMIN_USE_MOCK", "false");
    expect((await load()).isMock()).toBe(false);
  });

  it("deletes the production cookie with the attributes a __Host- cookie needs", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { endOperatorSession, OPERATOR_COOKIE } = await load();
    await endOperatorSession();
    expect(OPERATOR_COOKIE).toBe("__Host-ssumnation_admin");
    expect(jar.delete).toHaveBeenCalledWith({ name: "__Host-ssumnation_admin", path: "/", secure: true, httpOnly: true, sameSite: "strict" });
  });
});
