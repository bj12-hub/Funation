import { NextResponse, type NextRequest } from "next/server";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import { cookieHeaderWith, refreshSessionCookies } from "@/lib/flextv/sessionRefresh";
import {
  HELPER_PATH_HEADER,
  SURFACE_HEADER,
  isHelperRequest,
  parseHostList,
  routeHelperRequest,
  routeSiteRequest,
  type Surface
} from "@/lib/helperRouting";

/**
 * Serves the Ssumnation 도우미 on its own domain (2026-10-14 결정, docs/development/helper-domain.md): on the helper host
 * the OBS tools and the 리모컨 are shown at the top level (`/chat` → `/helper/chat`), studio links are sent to their
 * helper page, and the rest of the site is not reachable. On the site's host the helper pages are not served.
 *
 * Every page request carries `x-ssumnation-surface` so layouts can pick their chrome; a value sent by the client is
 * overwritten here. This is navigation only — every page and server action still checks the session itself.
 *
 * With the FLEXTV backend it also renews the member's FLEXTV access token before it expires
 * (lib/flextv/sessionRefresh.ts), for the browser and for the page rendered for this request.
 */
export function middleware(request: NextRequest) {
  return FLEXTV_AUTH ? withSessionRefresh(request) : route(request, new Headers(request.headers));
}

async function withSessionRefresh(request: NextRequest) {
  const headers = new Headers(request.headers);
  const writes = await refreshSessionCookies(request.cookies);
  if (writes) headers.set("cookie", cookieHeaderWith(request.headers.get("cookie"), writes));

  const response = route(request, headers);
  for (const { name, value, options } of writes ?? []) response.cookies.set(name, value, options);
  return response;
}

function route(request: NextRequest, headers: Headers) {
  const { pathname, search } = request.nextUrl;
  const helperHosts = parseHostList(process.env.HELPER_HOST);
  const helper = isHelperRequest(request.headers.get("host"), request.headers.get("x-forwarded-host"), helperHosts);

  headers.delete(HELPER_PATH_HEADER);
  headers.set(SURFACE_HEADER, (helper ? "helper" : "site") satisfies Surface);

  if (!helper) {
    const route = routeSiteRequest(pathname, search, helperHosts);
    // An address no route matches, so the site's own 404 page answers (status 404).
    if (route.action === "notFound") return NextResponse.rewrite(new URL("/__helper-not-served", request.url), { request: { headers } });
    if (route.action === "redirectHost") return NextResponse.redirect(new URL(route.path, `${request.nextUrl.protocol}//${route.host}`));
    return NextResponse.next({ request: { headers } });
  }

  const route = routeHelperRequest(pathname, search);
  switch (route.action) {
    case "redirect":
      return NextResponse.redirect(new URL(route.path, request.url));
    case "notFound":
      // no-store: whether this answers depends on headers a client can send (X-Forwarded-Host), so no shared cache may
      // keep it for the site's address.
      return new NextResponse("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    case "rewrite":
      headers.set(HELPER_PATH_HEADER, `${pathname}${search}`);
      return NextResponse.rewrite(new URL(route.path, request.url), { request: { headers } });
    default:
      return NextResponse.next({ request: { headers } });
  }
}

export const config = {
  // Everything except Next's static files; files from public/ are passed through by the routing itself.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
