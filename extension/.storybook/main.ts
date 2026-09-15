import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  // 共有 UI（@d-party/ui）の story も取り込む。両アプリのテーマトークンが
  // 異なるので、同じプリミティブを明るい配色と暗い配色の両方で確認できる。
  stories: [
    "../src/**/*.stories.@(ts|tsx)",
    "../../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  viteFinal: async (viteConfig) => {
    const { mergeConfig } = await import("vite");
    return mergeConfig(viteConfig, {
      resolve: {
        alias: {
          "@": path.resolve(dirname, "../src"),
        },
      },
      define: {
        "process.env.D_PARTY_ENV": JSON.stringify(
          process.env.D_PARTY_ENV ?? "development",
        ),
      },
    });
  },
};

export default config;
