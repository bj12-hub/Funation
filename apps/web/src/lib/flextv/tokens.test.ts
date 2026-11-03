import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_MARGIN_MS,
  clearSessionCookieWrites,
  decodeRefreshCookie,
  encodeRefreshCookie,
  needsRefresh,
  readTokens,
  readTokensFromSetCookie,
  sessionCookieWrites
} from "./tokens";

/** FLEXTV's tokens in Ssumnation's httpOnly cookies (docs/development/flextv-backend.md "세션"). */

const tokens = { accessToken: "a".repeat(128), refreshToken: "r".repeat(128), accessTtl: 3_600, refreshTtl: 86_400 };

afterEach(() => vi.unstubAllEnvs());

describe("reading FLEXTV tokens", () => {
  it("reads both spellings FLEXTV uses and falls back to its own lifetimes", () => {
    expect(readTokens({ accessToken: "abc", refreshToken: "def", accessToken_ttl: 10, refreshToken_ttl: 20 })).toEqual({ accessToken: "abc", refreshToken: "def", accessTtl: 10, refreshTtl: 20 });
    expect(readTokens({ access_token: "abc", refresh_token: "def", accessToken_ttl: -1 })).toEqual({ accessToken: "abc", refreshToken: "def", accessTtl: 172_800, refreshTtl: 2_592_000 });
  });

  it("refuses FLEXTV's placeholders and anything that is not a token", () => {
    expect(readTokens({ accessToken: "noAccessToken", refreshToken: "def" })).toBeNull();
    expect(readTokens({ accessToken: "abc", refreshToken: "noRefreshToken" })).toBeNull();
    expect(readTokens({ accessToken: "a b;c", refreshToken: "def" })).toBeNull();
    expect(readTokens("abc")).toBeNull();
  });

  it("reads the sign-up's Set-Cookie lines: the last non-empty value, Max-Age or Expires", () => {
    const now = Date.parse("2026-10-25T00:00:00Z");
    const lines = [
      "flx_oauth_access=; Path=/; Domain=.flextv.co.kr",
      "flx_oauth_access=abc; Path=/; Expires=Tue, 27 Oct 2026 00:00:00 GMT; HttpOnly",
      "flx_oauth_refresh=def; Max-Age=2592000; Path=/",
      "other=1"
    ];
    expect(readTokensFromSetCookie(lines, now)).toEqual({ accessToken: "abc", refreshToken: "def", accessTtl: 172_800, refreshTtl: 2_592_000 });
    expect(readTokensFromSetCookie(["flx_oauth_access=abc"], now)).toBeNull();
  });
});

describe("the refresh cookie", () => {
  it("round-trips and refuses other values", () => {
    const value = encodeRefreshCookie({ keep: true, accessExpiresAt: 1_761_350_400_000, refreshToken: "r".repeat(128) });
    expect(decodeRefreshCookie(value)).toEqual({ keep: true, accessExpiresAt: 1_761_350_400_000, refreshToken: "r".repeat(128) });
    for (const bad of [undefined, "", "r".repeat(128), "2.1.1.tok", "1.1.x.tok", "1.1.1.to;k"]) expect(decodeRefreshCookie(bad)).toBeNull();
  });
});

describe("session cookies", () => {
  it("are httpOnly; 로그인 유지 makes them outlive the browser for each token's lifetime", () => {
    vi.stubEnv("NODE_ENV", "production");
    const [access, refresh] = sessionCookieWrites(tokens, true, 1_000);
    expect(access).toEqual({ name: ACCESS_COOKIE, value: tokens.accessToken, options: { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 3_600 } });
    expect(refresh.name).toBe(REFRESH_COOKIE);
    expect(refresh.options.maxAge).toBe(86_400);
    expect(decodeRefreshCookie(refresh.value)).toEqual({ keep: true, accessExpiresAt: 1_000 + 3_600_000, refreshToken: tokens.refreshToken });
  });

  it("end with the browser without 로그인 유지, and still know when the access token expires", () => {
    const [access, refresh] = sessionCookieWrites(tokens, false, 1_000);
    expect(access.options.maxAge).toBeUndefined();
    expect(refresh.options.maxAge).toBeUndefined();
    expect(decodeRefreshCookie(refresh.value)?.keep).toBe(false);
  });

  it("are cleared with an expired max-age", () => {
    expect(clearSessionCookieWrites().map((w) => [w.name, w.value, w.options.maxAge])).toEqual([
      [ACCESS_COOKIE, "", 0],
      [REFRESH_COOKIE, "", 0]
    ]);
  });
});

describe("when to refresh", () => {
  const refresh = { keep: false, accessExpiresAt: 10_000_000, refreshToken: "r" };

  it("refreshes a missing or nearly expired access token, never without a refresh token", () => {
    expect(needsRefresh(undefined, refresh, 0)).toBe(true);
    expect(needsRefresh("a", refresh, 10_000_000 - REFRESH_MARGIN_MS)).toBe(true);
    expect(needsRefresh("a", refresh, 10_000_000 - REFRESH_MARGIN_MS - 1)).toBe(false);
    expect(needsRefresh(undefined, null, 0)).toBe(false);
  });
});
