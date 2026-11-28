import type { NextConfig } from "next";

/** Not a static export: lobby room ids are only known at runtime. */
const nextConfig: NextConfig = {
  output: "standalone",
  // 応答に `X-Powered-By: Next.js` を付けない。
  poweredByHeader: false,
  // `next dev` が AI エージェントを検出したときに、AGENTS.md へ英語のブロックを書き足さない
  // （すでにあるブロックは取り除かれる）。ルートの turbo.json の `agentGuidance: false` と同じ理由。
  agentRules: false,
  // @d-party/ui はソースのまま公開している。
  transpilePackages: ["@d-party/ui"],
  async redirects() {
    return [
      // 【暫定】旧「使い方」/usage を利用マニュアル /docs へ転送する。
      // 理由: インストール済みの古い版（v2.14.1 以前）の拡張機能が、ポップアップの「情報」タブの
      //   「使い方」と初回インストール時に開くページで /usage を開くため。
      // 外す条件: /docs を指す版の拡張機能が行き渡ったら外す。目安は、その版（v2.14.1 の次の
      //   リリース）を Chrome ウェブストアに出してから 3 か月。
      // 将来外すので、ブラウザに恒久的にキャッシュされる 308 ではなく 307（permanent: false）にする。
      // クエリはそのまま引き継がれる。/usage/ は Next の末尾スラッシュの 308 で /usage に寄ってから来る。
      // 外すときは frontend/AGENTS.md の「利用マニュアル /docs」の手順に従う。
      { source: "/usage", destination: "/docs", permanent: false },
    ];
  },
};

export default nextConfig;
