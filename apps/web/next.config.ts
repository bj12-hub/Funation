import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

/**
 * Baseline response headers (기본값 — 일반적인 기준). Every page: no MIME sniffing, a cross-origin referrer that is
 * only the origin, and no camera / microphone / location. Pages may be framed only by this site — the studio's
 * 오버레이 미리보기 frames /overlay/* from the same origin — except the OBS overlays themselves, which streaming tools
 * may load however they like (they are read-only behind the secret key). Private areas are kept out of search
 * engines. A full Content-Security-Policy waits for the real embeds and payment provider (TBD).
 */
const everywhere = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : [])
];
const framedBySiteOnly = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" }
];
const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
/** 음악 편집기 녹음 (2026-10-24): the microphone on that one studio page, for this site only (it stays off everywhere else). */
export const MUSIC_EDITOR_SOURCE = "/creator/widgets/music";
export const MUSIC_EDITOR_PERMISSIONS = "camera=(), microphone=(self), geolocation=()";
/**
 * 커스텀 오버레이 sandbox (`public/sandbox/*`, 2026-10-24): the creator's own HTML · CSS · JS runs here. The page is
 * sandboxed by its own header too (an opaque origin even if something frames it without the sandbox attribute or opens
 * it directly): scripts only, no network (fetch · XHR · WebSocket), no forms, frames or workers. Inline script and
 * style (the code itself); images · media · fonts from https, data: and this site. It replaces the site-wide CSP on this
 * path (the later rule wins), so it repeats frame-ancestors: only this site may frame it.
 */
export const SANDBOX_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' https: data: blob:; media-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; frame-ancestors 'self'";

/** Every path except /overlay and /overlay/… (path-to-regexp, as in `headers()` sources). */
export const NOT_OVERLAY_SOURCE = "/((?!overlay(?:/|$)).*)";
/** Studio, OBS overlays, the 커스텀 오버레이 sandbox, pop-out windows, account and wallet pages, API routes. */
export const PRIVATE_SOURCES = ["/creator/:path*", "/overlay/:path*", "/sandbox/:path*", "/popout/:path*", "/mypage/:path*", "/wallet/:path*", "/api/:path*"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Allow opening the dev server from other devices on the local network (e.g. a phone).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
  experimental: {
    // Profile photos are up to 5MB (Figma 745:98) and 정산 자료 등록 sends up to four 5MB files (437:4);
    // the default Server Action body limit is 1MB.
    serverActions: { bodySizeLimit: "21mb" }
  },
  async headers() {
    return [
      { source: "/:path*", headers: everywhere },
      { source: NOT_OVERLAY_SOURCE, headers: framedBySiteOnly },
      { source: "/sandbox/:path*", headers: [{ key: "Content-Security-Policy", value: SANDBOX_CSP }] },
      { source: MUSIC_EDITOR_SOURCE, headers: [{ key: "Permissions-Policy", value: MUSIC_EDITOR_PERMISSIONS }] },
      // The 커스텀 오버레이 page's address holds the overlay key: its sandbox frame (the creator's code) must not see it as
      // document.referrer. The frame also asks for no referrer; this covers anything else the page loads.
      { source: "/overlay/custom/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      // Same for the 외부 프로그램 연동 page: its requests to the creator's programs never carry the key in Referer.
      { source: "/overlay/bridge/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      // 공개 시그니처 페이지 (2026-10-25): its address holds the page key; no request it makes carries it in Referer.
      { source: "/signatures/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      ...PRIVATE_SOURCES.map((source) => ({ source, headers: noindex }))
    ];
  }
};

export default nextConfig;
