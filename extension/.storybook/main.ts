import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  // @d-party/ui の story も取り込む。
  stories: [
    "../src/**/*.stories.@(ts|tsx)",
    "../../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs"],
  framework: "@storybook/react-vite",
  core: {
    disableTelemetry: true,
  },
  viteFinal: async (viteConfig) => {
    const { mergeConfig } = await import("vite");
    return mergeConfig(viteConfig, {
      // `@/*` comes from tsconfig.json's `paths`.
      resolve: { tsconfigPaths: true },
      define: {
        "process.env.D_PARTY_ENV": JSON.stringify(
          process.env.D_PARTY_ENV ?? "development",
        ),
      },
    });
  },
};

export default config;
