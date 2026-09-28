import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow opening the dev server from other devices on the local network (e.g. a phone).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
  experimental: {
    // Profile photos are up to 5MB (Figma 745:98); the default Server Action body limit is 1MB.
    serverActions: { bodySizeLimit: "6mb" }
  }
};

export default nextConfig;
