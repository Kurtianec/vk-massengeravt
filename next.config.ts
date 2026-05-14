import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't use "standalone" output for Vercel — Vercel handles the build itself
  // output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
