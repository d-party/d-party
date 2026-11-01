import type { Decorator } from "@storybook/nextjs-vite";

import { OG_SIZE } from "@/lib/og/card";

/** Storybook decorator: the 1200×630 card at half scale. */
export const ogPreview: Decorator = (Story) => (
  <div
    style={{
      width: OG_SIZE.width,
      height: OG_SIZE.height,
      transform: "scale(0.5)",
      transformOrigin: "top left",
      marginBottom: -OG_SIZE.height / 2,
      marginRight: -OG_SIZE.width / 2,
      boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
      overflow: "hidden",
    }}
  >
    <Story />
  </div>
);
