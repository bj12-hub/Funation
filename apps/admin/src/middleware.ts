import { NextResponse, type NextRequest } from "next/server";

/**
 * Serves the admin console only on its own host. With ADMIN_HOST set (e.g. "admin.example.com" — the real
 * domain is TBD), a request for any other Host gets a plain 404, so the console cannot be reached through
 * the bare IP, a stray DNS name or the site's domain. Unset (local development) it serves every host.
 */
export function middleware(request: NextRequest) {
  const allowed = (process.env.ADMIN_HOST ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return NextResponse.next();
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (allowed.includes(host)) return NextResponse.next();
  return new NextResponse("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export const config = {
  // Everything except Next's own static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
