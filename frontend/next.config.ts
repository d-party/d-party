import type { NextConfig } from "next";

/** Not a static export: lobby room ids are only known at runtime. */
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // @d-party/ui はソースのまま公開している。

  transpilePackages: ["@d-party/ui"],
};

export default nextConfig;
