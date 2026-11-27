import type { Preview } from "@storybook/react-vite";

import { applyTheme } from "../src/styles/theme";

import "../src/presentation/popup/styles.css";

// 拡張機能と同じテーマで描く（今はダーク固定）。OS の配色には従わない。
applyTheme(document.documentElement);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
  },
};

export default preview;
