import type { NextConfig } from "next";

// Somnation admin console — a separate app on its own subdomain (e.g. admin.<site domain>; domain TBD).
// It talks to the site only through the server-side admin API client (src/lib/siteApi.ts).
const production = process.env.NODE_ENV === "production";

/** No third-party scripts or fonts (next/font serves the fonts from this app). Dev needs eval for React Refresh. */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https:",
  `connect-src 'self'${production ? "" : " ws:"}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'"
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Local subdomain development: http://admin.localhost:3200 (browsers resolve *.localhost to loopback).
  allowedDevOrigins: ["admin.localhost"],
  async headers() {
    // Operators only: never framed, never indexed, strict transport on the real domain.
    const headers = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : [])
    ];
    return [{ source: "/:path*", headers }];
  }
};

export default nextConfig;
