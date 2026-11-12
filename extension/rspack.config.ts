import path from "node:path";
import { fileURLToPath } from "node:url";

import { rspack, type Compiler, type Configuration } from "@rspack/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => path.resolve(__dirname, "src", p);
const isProduction = process.env.D_PARTY_ENV === "production";

const isLocalhost = (pattern: string) =>
  /^https?:\/\/localhost[/:]/.test(pattern);

interface Manifest {
  host_permissions?: string[];
  content_scripts?: { matches: string[] }[];
}

/** Production builds drop the `http://localhost/*` permissions and matches. */
class StripLocalhostFromManifestPlugin {
  apply(compiler: Compiler): void {
    const name = "StripLocalhostFromManifestPlugin";
    compiler.hooks.thisCompilation.tap(name, (compilation) => {
      compilation.hooks.processAssets.tap(
        { name, stage: rspack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE },
        () => {
          const asset = compilation.getAsset("manifest.json");
          if (!asset) return;
          const manifest = JSON.parse(
            asset.source.source().toString(),
          ) as Manifest;
          manifest.host_permissions = manifest.host_permissions?.filter(
            (p) => !isLocalhost(p),
          );
          manifest.content_scripts = manifest.content_scripts
            ?.map((cs) => ({
              ...cs,
              matches: cs.matches.filter((m) => !isLocalhost(m)),
            }))
            .filter((cs) => cs.matches.length > 0);
          compilation.updateAsset(
            "manifest.json",
            new rspack.sources.RawSource(
              `${JSON.stringify(manifest, null, 2)}\n`,
            ),
          );
        },
      );
    });
  }
}

const config: Configuration = {
  mode: process.env.NODE_ENV === "development" ? "development" : "production",
  devtool: false,
  context: __dirname,
  entry: {
    background: src("presentation/background/index.ts"),
    "content-store": src("presentation/content/store/index.ts"),
    "content-party": src("presentation/content/party/index.ts"),
    "content-version": src("presentation/content/version/index.ts"),
    // DMM TV の作品詳細ページにパーティー作成アイコンを注入する content script。
    "content-dmm-detail": src("presentation/content/dmm/detail/index.ts"),
    // DMM TV の再生ページで同時視聴（プレイヤー同期 + サイドバー）を行う content script。
    "content-dmm-player": src("presentation/content/dmm/player/index.ts"),
    popup: src("presentation/popup/index.tsx"),
    // Injected into the sidebar's Shadow DOM at runtime.
    "sidebar-style": src("styles/sidebar.css"),
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "js/[name].js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    alias: { "@": src("") },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        loader: "builtin:swc-loader",
        options: {
          jsc: {
            parser: { syntax: "typescript", tsx: true },
            transform: { react: { runtime: "automatic" } },
            target: "es2022",
          },
        },
      },
      {
        test: /\.css$/,
        type: "css",
        use: ["postcss-loader"],
      },
    ],
  },
  experiments: { css: true },
  performance: { hints: false },
  optimization: {
    // Content scripts and the service worker must each be one file.
    splitChunks: false,
    runtimeChunk: false,
  },
  plugins: [
    new rspack.DefinePlugin({
      "process.env.D_PARTY_ENV": JSON.stringify(
        process.env.D_PARTY_ENV ?? "development",
      ),
    }),
    new rspack.HtmlRspackPlugin({
      template: "public/popup.html",
      filename: "popup.html",
      chunks: ["popup"],
      inject: "body",
    }),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: "public/manifest.json", to: "manifest.json" },
        { from: "public/icon", to: "icon", noErrorOnMissing: true },
        { from: "public/css", to: "css", noErrorOnMissing: true },
      ],
    }),
    ...(isProduction ? [new StripLocalhostFromManifestPlugin()] : []),
  ],
};

export default config;
