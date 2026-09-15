import type { Preview } from "@storybook/nextjs-vite";

import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "hsl(222.2 84% 4.9%)" },
        { name: "light", value: "#ffffff" },
      ],
    },
  },
};

export default preview;
