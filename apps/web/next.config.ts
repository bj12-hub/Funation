import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow opening the dev server from other devices on the local network (e.g. a phone).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"]
};

export default nextConfig;
