import type { NextConfig } from "next";

/** Not a static export: lobby room ids are only known at runtime. */
const nextConfig: NextConfig = {
  output: "standalone",
  // 応答に `X-Powered-By: Next.js` を付けない。
  poweredByHeader: false,
  // @d-party/ui はソースのまま公開している。
  transpilePackages: ["@d-party/ui"],
  async redirects() {
    return [
      // 旧「使い方」ページは利用マニュアルに統合した。インストール済みの古い拡張機能が
      // 初回インストール時やポップアップの「使い方」から開くので、URL は残して転送する（308）。
      { source: "/usage", destination: "/docs", permanent: true },
    ];
  },
};

export default nextConfig;
