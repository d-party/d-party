import type { NextConfig } from "next";

/**
 * Next.js configuration for the d-party user-facing frontend.
 *
 * `output: "standalone"` produces a self-contained server bundle (used by the
 * Dockerfile) so the dynamic lobby route `/anime-store/lobby/[roomId]` is
 * resolved at runtime — arbitrary room ids cannot be known at build time, so a
 * static export is unsuitable.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
