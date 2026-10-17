import { WIDGET_HELPER_PATH, widgetPageOf } from "@/features/helper/widgetPages";

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

/**
 * A host as the routing compares it: lower case, without the trailing dot of a fully qualified name — a browser opening
 * `https://helper.example.com./` sends `Host: helper.example.com.`, and that is still the helper domain.
 */
const normalizeHost = (host: string) =>
  host
    .trim()
    .toLowerCase()
    .replace(/\.(?=(:\d+)?$)/, "");
const PORT = /:\d+$/;

export const parseHostList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean);

/**
 * Whether `host` names the helper. A `HELPER_HOST` entry without a port names that host on any port (a proxy may pass
 * `helper.example.com:443`); an entry with a port names that port only.
 */
export function isHelperHost(host: string | null | undefined, configured: string[]): boolean {
  const h = normalizeHost(host ?? "");
  if (!h) return false;
  if (configured.length > 0) return configured.some((c) => c === h || (!PORT.test(c) && c === h.replace(PORT, "")));
  return h.startsWith("helper.");
}

/**
 * Whether a request is for the helper: its Host, or any `X-Forwarded-Host` value (a reverse proxy's public host, and the
 * host Next forwards when it renders a server action's redirect target through an internal request to itself).
 * Any value, not only the first: a proxy that appends to the header puts the client's own value first, so a client on
 * the helper domain could otherwise present itself as the site (and reach the wallet, the admin API … there). Matching
 * more is the safe side: a forged header can only turn a site request into a helper one, which shows less, never more.
 */
export function isHelperRequest(host: string | null, forwardedHost: string | null, configured: string[]): boolean {
  return isHelperHost(host, configured) || (forwardedHost ?? "").split(",").some((h) => isHelperHost(h, configured));
}

/** `path` is `prefix` itself or below it (segment-aware: "/login" matches "/login/x", not "/loginx"). */
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Site routes the helper host serves as they are: OBS overlays, pop-out windows, sign-in · sign-up · password reset,
 * 채널 만들기, the terms that sign-up links to, the media the overlays load, and the SMS 계좌후원 webhook — the helper's
 * 후원 연동 page hands out its address on the helper domain, and the key in it is the webhook's only credential, as on
 * the site. Everything else of the site (wallet, settlement, community, the admin API …) stays on the site's domain.
 */
const SHARED_PREFIXES = ["/overlay", "/popout", "/login", "/signup", "/password-reset", "/channel/new", "/terms", "/api/custom-sound", "/api/media", "/api/bank-sms"];

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
  ["/creator/chat", "/chat/manage"]
];

/** Where a studio address goes on the helper host. Studio pages the helper does not have go to the helper home. */
export function helperPathForStudio(pathname: string, search: string): string {
  // The 위젯 catalog's `?open=GOAL` (opens that popup) is the widget's own page here.
  if (pathname === "/creator/widgets") {
    const open = new URLSearchParams(search).get("open") ?? "";
    return Object.hasOwn(WIDGET_HELPER_PATH, open) ? WIDGET_HELPER_PATH[open as keyof typeof WIDGET_HELPER_PATH] : "/";
  }
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

/** The top-level folders of `public/` (helperRouting.test.ts checks this list against the folder). */
export const PUBLIC_FOLDERS = ["images", "mock"];

/**
 * The helper's own pages by their first segment: the folders of `app/helper` (helperRouting.test.ts checks this list
 * against the folder) and the 위젯 기능 pages of `app/helper/[feature]` (WIDGET_PAGES).
 */
export const HELPER_PAGE_FOLDERS = ["assets", "banner", "chat", "crew", "drawing", "effects", "filtering", "link", "overlays", "remote", "signatures", "theme", "tools", "video", "widgets", "youtube"];

/**
 * Whether a helper address (`/x?y`, as `getHelperPath` gives it) is one of the helper's pages. The layout shows a
 * signed-out visitor the landing only there; any other address — the site's wallet, community … — is the helper's 404
 * for everyone, as it is once signed in (otherwise the landing would offer to sign in and then land on the 404).
 */
export function isHelperPagePath(path: string): boolean {
  const first = path.split(/[?#]/, 1)[0].split("/")[1] ?? "";
  return first === "" || HELPER_PAGE_FOLDERS.includes(first) || widgetPageOf(first) !== null;
}

/**
 * Next's own assets and the files from `public/` are served on both hosts — only those: a dot in the last segment does
 * not make an address a file (`/api/admin/members/a.b` is still the admin API, `/donation/youtube/a.b` a site page).
 */
const isAsset = (pathname: string) => under(pathname, "/_next") || PUBLIC_FOLDERS.some((f) => under(pathname, `/${f}`));

/**
 * `/helper/x` → `/x`, an address on the same host: leading slashes collapse into one, so `/helper//evil.com` cannot turn
 * into `//evil.com` (another host, to a browser). Next already answers `//` in a path with a 308 before the middleware
 * runs; this does not rely on it.
 */
const withoutHelperSegment = (pathname: string, search: string) => `/${pathname.slice(HELPER_SEGMENT.length).replace(/^[/\\]+/, "")}${search}`;

/** Routing on the helper host. `pathname` is the request path, `search` its query string ("" or "?…"). */
export function routeHelperRequest(pathname: string, search: string): HelperRoute {
  if (isAsset(pathname)) return { action: "pass" };
  // One address per page: `/helper/x` is shown as `/x`.
  if (under(pathname, HELPER_SEGMENT)) return { action: "redirect", path: withoutHelperSegment(pathname, search) };
  if (under(pathname, "/creator")) return { action: "redirect", path: helperPathForStudio(pathname, search) };
  if (SHARED_PREFIXES.some((p) => under(pathname, p))) return { action: "pass" };
  // The site's other API routes (admin, wallet, bank SMS webhook) are not part of the helper.
  if (under(pathname, "/api")) return { action: "notFound" };
  return { action: "rewrite", path: `${HELPER_SEGMENT}${pathname === "/" ? "" : pathname}${search}` };
}

/**
 * The request path percent-decoded once, as Next also tries it when it looks for a page: `/%68elper/link` and
 * `/helper%2Flink` are served as `/helper/link`, while the middleware is handed the path as it was sent.
 */
const decodedPath = (pathname: string) => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
};

/** Routing on the site's own host: the helper pages are not served there (one domain per product). */
export function routeSiteRequest(pathname: string, search: string, helperHosts: string[]): { action: "pass" } | { action: "notFound" } | { action: "redirectHost"; host: string; path: string } {
  // An encoded spelling of `/helper` (no link produces one) is a 404, never a redirect: a decoded path can hold
  // characters a browser drops from a Location (`%09`), so it is not handed on.
  if (!under(pathname, HELPER_SEGMENT)) return under(decodedPath(pathname), HELPER_SEGMENT) ? { action: "notFound" } : { action: "pass" };
  const path = withoutHelperSegment(pathname, search);
  return helperHosts.length > 0 ? { action: "redirectHost", host: helperHosts[0], path } : { action: "notFound" };
}
