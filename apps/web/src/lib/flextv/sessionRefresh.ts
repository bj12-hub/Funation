import { refreshTokens } from "./auth";
import { FlextvUnavailableError } from "./client";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSessionCookieWrites, decodeRefreshCookie, needsRefresh, sessionCookieWrites, type CookieWrite } from "./tokens";

/**
 * Renews a FLEXTV session in the middleware (Server Components cannot set cookies): when the access cookie is gone
 * or about to expire and a refresh cookie is there, FLEXTV issues a new access token. The new cookies go both to the
 * browser and into this request's own Cookie header, so the page rendered for it already reads them.
 *
 * Returns null when nothing changes — no refresh needed, or FLEXTV unreachable (the session is kept and tried again on
 * the next request). A refresh token FLEXTV no longer accepts ends the session.
 */
export async function refreshSessionCookies(cookies: { get: (name: string) => { value: string } | undefined }): Promise<CookieWrite[] | null> {
  const access = cookies.get(ACCESS_COOKIE)?.value;
  const refresh = decodeRefreshCookie(cookies.get(REFRESH_COOKIE)?.value);
  if (!needsRefresh(access, refresh)) {
    // An unreadable refresh cookie (an older format, a hand-edited value) is dropped; the access cookie stays.
    return cookies.get(REFRESH_COOKIE) && !refresh ? clearSessionCookieWrites().filter((w) => w.name === REFRESH_COOKIE) : null;
  }
  try {
    const outcome = await refreshTokens(refresh.refreshToken);
    return outcome.kind === "OK" ? sessionCookieWrites(outcome.tokens, refresh.keep) : clearSessionCookieWrites();
  } catch (error) {
    if (error instanceof FlextvUnavailableError) return null;
    throw error;
  }
}

/** The request's Cookie header with `writes` applied (a cleared cookie is removed). */
export function cookieHeaderWith(header: string | null, writes: CookieWrite[]): string {
  const pairs = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) pairs.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  for (const { name, value } of writes) {
    if (value) pairs.set(name, value);
    else pairs.delete(name);
  }
  return [...pairs].map(([name, value]) => `${name}=${value}`).join("; ");
}
