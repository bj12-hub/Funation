/**
 * Ssumnation 도우미 (helper domain, 2026-10-14 결정): the OBS broadcast tools and the 리모컨 are served on their own
 * domain before the full site opens. Same app and data as the site; this module decides, per request, what the helper
 * host may show. Pure functions only — the middleware (Edge runtime) and the tests import it.
 *
 * The real domain is TBD: `HELPER_HOST` (comma-separated `host[:port]`) names it. Unset, any `helper.` host counts
 * (e.g. http://helper.localhost:3000 — browsers resolve `*.localhost` to this machine).
 */

/** Request header the middleware sets on every page request ("site" | "helper"). A client-sent value is overwritten. */
export const SURFACE_HEADER = "x-ssumnation-surface";
/** The helper path the visitor asked for (for `?next=` after sign-in); set by the middleware on the helper host only. */
export const HELPER_PATH_HEADER = "x-ssumnation-helper-path";
/** Helper pages live under this segment; the helper host rewrites `/x` to `/helper/x`. */
export const HELPER_SEGMENT = "/helper";

export type Surface = "site" | "helper";

export const parseHostList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

export function isHelperHost(host: string | null | undefined, configured: string[]): boolean {
  const h = (host ?? "").trim().toLowerCase();
  if (!h) return false;
  if (configured.length > 0) return configured.includes(h);
  return h.startsWith("helper.");
}

/**
 * Whether a request is for the helper: its Host, or the first `X-Forwarded-Host` (a reverse proxy's public host, and the
 * host Next forwards when it renders a server action's redirect target through an internal request to itself).
 * A forged X-Forwarded-Host can only turn a site request into a helper one, which shows less, never more.
 */
export function isHelperRequest(host: string | null, forwardedHost: string | null, configured: string[]): boolean {
  return isHelperHost(host, configured) || isHelperHost(forwardedHost?.split(",")[0], configured);
}

/** `path` is `prefix` itself or below it (segment-aware: "/login" matches "/login/x", not "/loginx"). */
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Site routes the helper host serves as they are: OBS overlays, pop-out windows, sign-in · sign-up · password reset,
 * 채널 만들기, the terms that sign-up links to, and the media the overlays load. Everything else of the site (wallet,
 * settlement, community …) stays on the site's domain.
 */
const SHARED_PREFIXES = ["/overlay", "/popout", "/login", "/signup", "/password-reset", "/channel/new", "/terms", "/api/custom-sound", "/api/media"];

/**
 * Studio addresses that the reused studio screens link to, mapped to their helper page. Longest prefix first; the
 * rest of the path is kept (`/creator/widgets/overlays/preview/alert` → `/overlays/preview/alert`).
 */
const STUDIO_PREFIXES: [string, string][] = [
  ["/creator/widgets/overlays", "/overlays"],
  ["/creator/widgets/signatures", "/signatures"],
  ["/creator/widgets/drawing", "/drawing"],
  ["/creator/widgets/effects", "/effects"],
  ["/creator/widgets/assets", "/assets"],
  ["/creator/widgets/banner", "/banner"],
  ["/creator/widgets/video", "/video"],
  ["/creator/widgets/tools", "/tools"],
  ["/creator/widgets/link", "/link"],
  ["/creator/crew/broadcast", "/crew/broadcast"],
  ["/creator/crew", "/crew"],
  ["/creator/remote", "/remote"],
  ["/creator/youtube", "/youtube"],
  ["/creator/chat", "/chat"]
];

/** Where a studio address goes on the helper host. Studio pages the helper does not have go to the helper home. */
export function helperPathForStudio(pathname: string, search: string): string {
  if (pathname === "/creator/widgets") return `/widgets${search}`;
  if (pathname === "/creator/donations") {
    const params = new URLSearchParams(search);
    if (params.get("tab") !== "filtering") return "/";
    params.delete("tab");
    const rest = params.toString();
    return `/filtering${rest ? `?${rest}` : ""}`;
  }
  for (const [from, to] of STUDIO_PREFIXES) {
    if (under(pathname, from)) return `${to}${pathname.slice(from.length)}${search}`;
  }
  return "/";
}

export type HelperRoute =
  | { action: "pass" }
  | { action: "rewrite"; path: string }
  | { action: "redirect"; path: string }
  | { action: "notFound" };

/** Files from `public/` (images, sounds …) and Next's own assets are served on both hosts. */
const isAsset = (pathname: string) => pathname.startsWith("/_next/") || /\/[^/]+\.[a-z0-9]+$/i.test(pathname);

/** Routing on the helper host. `pathname` is the request path, `search` its query string ("" or "?…"). */
export function routeHelperRequest(pathname: string, search: string): HelperRoute {
  if (isAsset(pathname)) return { action: "pass" };
  // One address per page: `/helper/x` is shown as `/x`.
  if (under(pathname, HELPER_SEGMENT)) return { action: "redirect", path: `${pathname.slice(HELPER_SEGMENT.length) || "/"}${search}` };
  if (under(pathname, "/creator")) return { action: "redirect", path: helperPathForStudio(pathname, search) };
  if (SHARED_PREFIXES.some((p) => under(pathname, p))) return { action: "pass" };
  // The site's other API routes (admin, wallet, bank SMS webhook) are not part of the helper.
  if (under(pathname, "/api")) return { action: "notFound" };
  return { action: "rewrite", path: `${HELPER_SEGMENT}${pathname === "/" ? "" : pathname}${search}` };
}

/** Routing on the site's own host: the helper pages are not served there (one domain per product). */
export function routeSiteRequest(pathname: string, search: string, helperHosts: string[]): { action: "pass" } | { action: "notFound" } | { action: "redirectHost"; host: string; path: string } {
  if (!under(pathname, HELPER_SEGMENT)) return { action: "pass" };
  const path = `${pathname.slice(HELPER_SEGMENT.length) || "/"}${search}`;
  return helperHosts.length > 0 ? { action: "redirectHost", host: helperHosts[0], path } : { action: "notFound" };
}
