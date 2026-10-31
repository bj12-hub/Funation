import { isRecord } from "./client";

/**
 * FLEXTV tokens and the Ssumnation cookies that carry them (docs/development/flextv-backend.md "세션").
 *
 * FLEXTV issues an opaque access token (2 days) and refresh token (30 days) per member. Ssumnation keeps them in its own
 * httpOnly cookies — the browser never reads them:
 * - `ssumnation_session`: the access token (the same cookie `lib/session.ts` reads as SESSION_COOKIE)
 * - `ssumnation_refresh`: `1.{keep}.{access expiry, ms}.{refresh token}` — the middleware renews the access token from it
 *   shortly before it expires, also for a session that ends with the browser (no "로그인 유지").
 *
 * Edge-safe (the middleware imports it): no Node APIs, no next/headers.
 */

export const ACCESS_COOKIE = "ssumnation_session";
export const REFRESH_COOKIE = "ssumnation_refresh";

/** FLEXTV's own cookie lifetimes (`server/utils/cookies.js`), used when it sends no TTL. */
const DEFAULT_ACCESS_TTL = 2 * 24 * 60 * 60;
const DEFAULT_REFRESH_TTL = 30 * 24 * 60 * 60;

/** Renew this long before the access token expires, so a page never renders with a token FLEXTV just dropped. */
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type FlextvTokens = {
  accessToken: string;
  refreshToken: string;
  /** Seconds left. */
  accessTtl: number;
  refreshTtl: number;
};

const str = (value: unknown) => (typeof value === "string" ? value : "");
const ttl = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback);
/** FLEXTV's oauth server writes these placeholders instead of a token it could not find. */
const isToken = (value: string) => value.length > 0 && value !== "noAccessToken" && value !== "noRefreshToken" && /^[A-Za-z0-9._~-]+$/.test(value);

/**
 * Tokens from a FLEXTV body: the sign-in's `token` ({ accessToken, refreshToken, accessToken_ttl, … }) or the refresh's
 * answer ({ access_token, refresh_token, … }). The refresh may leave the refresh token out: `fallbackRefresh` keeps it.
 */
export function readTokens(raw: unknown, fallbackRefresh?: string): FlextvTokens | null {
  if (!isRecord(raw)) return null;
  const accessToken = str(raw.accessToken) || str(raw.access_token);
  const refreshToken = str(raw.refreshToken) || str(raw.refresh_token) || fallbackRefresh || "";
  if (!isToken(accessToken) || !isToken(refreshToken)) return null;
  return {
    accessToken,
    refreshToken,
    accessTtl: ttl(raw.accessToken_ttl, DEFAULT_ACCESS_TTL),
    refreshTtl: ttl(raw.refreshToken_ttl, DEFAULT_REFRESH_TTL)
  };
}

const FLEXTV_ACCESS_COOKIE = "flx_oauth_access";
const FLEXTV_REFRESH_COOKIE = "flx_oauth_refresh";

/** FLEXTV's sign-up sends its tokens only as Set-Cookie (`flx_oauth_access`, `flx_oauth_refresh`). */
export function readTokensFromSetCookie(lines: string[], now = Date.now()): FlextvTokens | null {
  const found: Record<string, { value: string; ttl: number | null }> = {};
  for (const line of lines) {
    const [pair, ...attributes] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    if (name !== FLEXTV_ACCESS_COOKIE && name !== FLEXTV_REFRESH_COOKIE) continue;
    let value = pair.slice(eq + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      continue;
    }
    // FLEXTV clears a cookie before it sets it again: the last non-empty line wins.
    if (!value) continue;
    found[name] = { value, ttl: cookieTtl(attributes, now) };
  }
  const access = found[FLEXTV_ACCESS_COOKIE];
  const refresh = found[FLEXTV_REFRESH_COOKIE];
  if (!access || !refresh || !isToken(access.value) || !isToken(refresh.value)) return null;
  return {
    accessToken: access.value,
    refreshToken: refresh.value,
    accessTtl: access.ttl ?? DEFAULT_ACCESS_TTL,
    refreshTtl: refresh.ttl ?? DEFAULT_REFRESH_TTL
  };
}

function cookieTtl(attributes: string[], now: number): number | null {
  let expires: number | null = null;
  for (const attribute of attributes) {
    const eq = attribute.indexOf("=");
    if (eq < 0) continue;
    const key = attribute.slice(0, eq).trim().toLowerCase();
    const value = attribute.slice(eq + 1).trim();
    if (key === "max-age") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) return Math.floor(seconds);
    } else if (key === "expires") {
      const at = Date.parse(value);
      if (Number.isFinite(at) && at > now) expires = Math.floor((at - now) / 1000);
    }
  }
  return expires;
}

export type RefreshCookie = { keep: boolean; accessExpiresAt: number; refreshToken: string };

export const encodeRefreshCookie = ({ keep, accessExpiresAt, refreshToken }: RefreshCookie) => `1.${keep ? 1 : 0}.${accessExpiresAt}.${refreshToken}`;

export function decodeRefreshCookie(value: string | undefined): RefreshCookie | null {
  if (!value) return null;
  const match = /^1\.([01])\.(\d{1,15})\.([A-Za-z0-9._~-]+)$/.exec(value);
  if (!match) return null;
  return { keep: match[1] === "1", accessExpiresAt: Number(match[2]), refreshToken: match[3] };
}

export type CookieOptions = { httpOnly: true; sameSite: "lax"; secure: boolean; path: "/"; maxAge?: number };
export type CookieWrite = { name: string; value: string; options: CookieOptions };

const baseOptions = (): CookieOptions => ({ httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });

/**
 * The cookies of a signed-in session. "로그인 유지" (`keep`) makes both outlive the browser (the access cookie for the
 * token's own lifetime, the refresh cookie for the refresh token's); otherwise both end with the browser session.
 */
export function sessionCookieWrites(tokens: FlextvTokens, keep: boolean, now = Date.now()): CookieWrite[] {
  const accessExpiresAt = now + tokens.accessTtl * 1000;
  return [
    { name: ACCESS_COOKIE, value: tokens.accessToken, options: { ...baseOptions(), ...(keep ? { maxAge: tokens.accessTtl } : {}) } },
    {
      name: REFRESH_COOKIE,
      value: encodeRefreshCookie({ keep, accessExpiresAt, refreshToken: tokens.refreshToken }),
      options: { ...baseOptions(), ...(keep ? { maxAge: tokens.refreshTtl } : {}) }
    }
  ];
}

/** Cookie writes that end the session (an expired max-age makes the browser drop them). */
export const clearSessionCookieWrites = (): CookieWrite[] =>
  [ACCESS_COOKIE, REFRESH_COOKIE].map((name) => ({ name, value: "", options: { ...baseOptions(), maxAge: 0 } }));

/** The access token is missing (its cookie expired) or about to expire, and a refresh token is there to renew it. */
export function needsRefresh(accessToken: string | undefined, refresh: RefreshCookie | null, now = Date.now()): refresh is RefreshCookie {
  if (!refresh) return false;
  return !accessToken || now >= refresh.accessExpiresAt - REFRESH_MARGIN_MS;
}
