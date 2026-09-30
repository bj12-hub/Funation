import type { NextConfig } from "next";

// Somnation admin console — a separate app from the site (apps/web). It talks to the site only through
// the server-side admin API client (src/lib/siteApi.ts).
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // Operators only: never framed, never indexed.
    return [{ source: "/:path*", headers: [{ key: "X-Frame-Options", value: "DENY" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "same-origin" }] }];
  }
};

export default nextConfig;
