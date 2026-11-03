import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cookieHeaderWith, refreshSessionCookies } from "./sessionRefresh";
import { ACCESS_COOKIE, REFRESH_COOKIE, decodeRefreshCookie, encodeRefreshCookie } from "./tokens";

/** The middleware renews a FLEXTV session before its access token expires (lib/flextv/sessionRefresh.ts). */

const jar = (values: Record<string, string>) => ({ get: (name: string) => (name in values ? { value: values[name] } : undefined) });
const refreshCookie = (accessExpiresAt: number, keep = true) => encodeRefreshCookie({ keep, accessExpiresAt, refreshToken: "r".repeat(128) });
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test/");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("refreshSessionCookies", () => {
  it("leaves a session alone while its access token is fresh", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await refreshSessionCookies(jar({ [ACCESS_COOKIE]: "a", [REFRESH_COOKIE]: refreshCookie(Date.now() + 3_600_000) }))).toBeNull();
    expect(await refreshSessionCookies(jar({}))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renews an expired access token with the refresh token, keeping 로그인 유지 as it was", async () => {
    const fetch = vi.fn(async () => answer({ access_token: "n".repeat(128), refresh_token: "r".repeat(128), accessToken_ttl: 7_200, refreshToken_ttl: 1_000_000 }));
    vi.stubGlobal("fetch", fetch);
    const writes = await refreshSessionCookies(jar({ [REFRESH_COOKIE]: refreshCookie(Date.now() - 1, false) }));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.flextv.test/api/oauth/refresh");
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: "r".repeat(128) });
    expect(writes?.[0]).toMatchObject({ name: ACCESS_COOKIE, value: "n".repeat(128) });
    expect(writes?.[0].options.maxAge).toBeUndefined();
    expect(decodeRefreshCookie(writes?.[1].value)?.keep).toBe(false);
  });

  it("ends the session when FLEXTV refuses the refresh token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer({ msg: "ERROR" })));
    const writes = await refreshSessionCookies(jar({ [ACCESS_COOKIE]: "a", [REFRESH_COOKIE]: refreshCookie(0) }));
    expect(writes?.map((w) => [w.name, w.value])).toEqual([
      [ACCESS_COOKIE, ""],
      [REFRESH_COOKIE, ""]
    ]);
  });

  it("keeps the session when FLEXTV cannot be reached, to try again on the next request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(await refreshSessionCookies(jar({ [REFRESH_COOKIE]: refreshCookie(0) }))).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => answer(null, 502)));
    expect(await refreshSessionCookies(jar({ [REFRESH_COOKIE]: refreshCookie(0) }))).toBeNull();
  });

  it("drops an unreadable refresh cookie and keeps the access cookie", async () => {
    const writes = await refreshSessionCookies(jar({ [ACCESS_COOKIE]: "a", [REFRESH_COOKIE]: "garbage" }));
    expect(writes?.map((w) => w.name)).toEqual([REFRESH_COOKIE]);
  });
});

describe("cookieHeaderWith", () => {
  it("hands the page the renewed cookies and drops cleared ones", () => {
    const header = `theme=dark; ${ACCESS_COOKIE}=old; ${REFRESH_COOKIE}=1.1.1.r`;
    const options = { httpOnly: true as const, sameSite: "lax" as const, secure: false, path: "/" as const };
    expect(cookieHeaderWith(header, [{ name: ACCESS_COOKIE, value: "new", options }])).toBe(`theme=dark; ${ACCESS_COOKIE}=new; ${REFRESH_COOKIE}=1.1.1.r`);
    expect(cookieHeaderWith(header, [{ name: ACCESS_COOKIE, value: "", options }, { name: REFRESH_COOKIE, value: "", options }])).toBe("theme=dark");
    expect(cookieHeaderWith(null, [{ name: ACCESS_COOKIE, value: "new", options }])).toBe(`${ACCESS_COOKIE}=new`);
  });
});
