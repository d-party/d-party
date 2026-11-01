import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/nextjs-vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  // @d-party/ui の story も取り込む。

  stories: [
    "../src/**/*.stories.@(ts|tsx|mdx)",
    "../../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  staticDirs: ["../public"],
  viteFinal: async (viteConfig) => {
    const { mergeConfig } = await import("vite");
    return mergeConfig(viteConfig, {
      resolve: {
        alias: {
          "@": path.resolve(dirname, "../src"),
        },
      },
    });
  },
};

export default config;
