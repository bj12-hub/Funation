/**
 * The creator studio's pages that run on FLEXTV (phase 5, docs/development/flextv-backend.md "5단계"). The studio's
 * other pages still read the mock, which a production build does not have, so with FLEXTV the middleware sends them to
 * the dashboard instead of an error page. Edge-safe: the middleware imports it.
 */
export const FLEXTV_STUDIO_PATHS = [
  "/creator",
  "/creator/broadcast",
  // Phase 7: 채널 설정 (the streamer's FLEXTV 방송국).
  "/creator/settings",
  // Phase 6: only with FLEXTV's Ssumnation endpoints (the pages answer 404 without them).
  "/creator/donation-types",
  "/creator/remote",
  "/creator/revenue",
  "/creator/donations",
  "/creator/settlement",
  "/creator/settlement/register",
  "/creator/settlement/apply",
  "/creator/settlement/manage"
] as const;

export const isStudioPath = (pathname: string) => pathname === "/creator" || pathname.startsWith("/creator/");

export function flextvStudioServes(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (FLEXTV_STUDIO_PATHS as readonly string[]).includes(path);
}
