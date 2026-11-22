import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  // @d-party/ui の story も取り込む。
  stories: [
    "../src/**/*.stories.@(ts|tsx|mdx)",
    "../../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs"],
  framework: "@storybook/nextjs-vite",
  core: {
    disableTelemetry: true,
  },
  staticDirs: ["../public"],
};

export default config;
