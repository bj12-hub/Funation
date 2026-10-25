/**
 * The site's addresses that have no FLEXTV backend (phase 7, docs/development/flextv-backend.md "7단계"). With FLEXTV
 * they would show the mock — its one member's account and FN, its studio's overlays — and a production build has no
 * mock, so the middleware sends their pages home, answers the rest with a 404, and the menus leave them out.
 * Edge-safe: the middleware imports it.
 */

/** Pages sent home: Ssumnation's own areas that FLEXTV has no counterpart for yet (TBD), and FLEXTV's own flows. */
export const FLEXTV_UNSERVED_PAGES = [
  // 커뮤니티 · 이벤트 · 출석 체크 (its reward credits the mock's FN) · 명예의 전당.
  "/community",
  "/events",
  "/attendance",
  "/hall-of-fame",
  // SOOP · FlexTV 플랫폼 후원 and its history: spends the mock's FN.
  "/donation",
  // The mock studio's 마블 · 럼블 invitations.
  "/play",
  // The supporter identity (칭호 · 후원 닉네임 · 내 랭킹) is Ssumnation's.
  "/mypage/titles",
  "/mypage/nicknames",
  "/mypage/ranking",
  // 탈퇴, password reset and change happen on FLEXTV's site (its 본인인증); 마이페이지 links there.
  "/mypage/withdraw",
  "/password-reset",
  "/login/password-change"
] as const;

/** Of the OBS overlays and pop-outs, only these run on FLEXTV; the others read the mock studio. */
const SERVED_OVERLAYS = ["/overlay/widget", "/popout/remote"];
/** API routes of the mock studio (its media, sounds, 럼블 and the SMS 계좌후원 webhook). */
const MOCK_API = ["/api/media", "/api/custom-sound", "/api/play", "/api/bank-sms"];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export type FlextvSiteRoute = "serve" | "home" | "notFound";

/** What the site does with `pathname` with FLEXTV. The studio's own pages are lib/flextv/studioRoutes.ts. */
export function flextvSiteRoute(pathname: string): FlextvSiteRoute {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (under(path, "/overlay") || under(path, "/popout")) return SERVED_OVERLAYS.some((p) => under(path, p)) ? "serve" : "notFound";
  if (MOCK_API.some((p) => under(path, p))) return "notFound";
  return FLEXTV_UNSERVED_PAGES.some((p) => under(path, p)) ? "home" : "serve";
}

/** Whether a menu link leads to a page served with FLEXTV (`href` may carry a query). */
export const flextvServesLink = (href: string) => flextvSiteRoute(href.split(/[?#]/, 1)[0]) === "serve";
