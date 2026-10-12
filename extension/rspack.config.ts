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

/**
 * Drop the local-backend entries (`http://localhost/*`) from the copied
 * manifest in production builds, so the store package does not ask for a
 * localhost host permission or inject into local pages.
 */
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
    // Background service worker (MV3).
    background: src("presentation/background/index.ts"),
    // Content scripts — one self-contained bundle per injection target.
    "content-store": src("presentation/content/store/index.ts"),
    "content-party": src("presentation/content/party/index.ts"),
    "content-version": src("presentation/content/version/index.ts"),
    // Popup (React + shadcn/ui).
    popup: src("presentation/popup/index.tsx"),
    // Sidebar styles, emitted as a standalone CSS file and injected into the
    // sidebar's Shadow DOM at runtime (content-party).
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
  // Content scripts legitimately bundle React; the asset-size hint is noise here.
  performance: { hints: false },
  optimization: {
    // Content scripts and the service worker must each be a single, self-contained
    // file — disable code splitting and a shared runtime chunk.
    splitChunks: false,
    runtimeChunk: false,
  },
  plugins: [
    // Inline the build-time backend target so `src/infrastructure/env.ts` can
    // branch on it. Default is the local dev backend; release builds pass
    // `D_PARTY_ENV=production` to target d-party.net (see .github release.yml).
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
        { from: "public/images", to: "images", noErrorOnMissing: true },
        { from: "public/assets", to: "assets", noErrorOnMissing: true },
        { from: "public/css", to: "css", noErrorOnMissing: true },
      ],
    }),
    ...(isProduction ? [new StripLocalhostFromManifestPlugin()] : []),
  ],
};

export default config;
