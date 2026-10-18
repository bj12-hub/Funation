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

/** Every path except /overlay and /overlay/… (path-to-regexp, as in `headers()` sources). */
export const NOT_OVERLAY_SOURCE = "/((?!overlay(?:/|$)).*)";
/** Studio, OBS overlays, pop-out windows, account and wallet pages, API routes. */
export const PRIVATE_SOURCES = ["/creator/:path*", "/overlay/:path*", "/popout/:path*", "/mypage/:path*", "/wallet/:path*", "/api/:path*"];

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
      ...PRIVATE_SOURCES.map((source) => ({ source, headers: noindex }))
    ];
  }
};

export default nextConfig;
