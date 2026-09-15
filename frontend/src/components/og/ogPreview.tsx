import type { Decorator } from "@storybook/nextjs-vite";

import { OG_SIZE } from "@/lib/og/card";

/**
 * Storybook decorator for the OG cards: renders the story in a 1200×630 box
 * (the real card size) scaled to half so it fits the canvas.
 */
export const ogPreview: Decorator = (Story) => (
  <div
    style={{
      width: OG_SIZE.width,
      height: OG_SIZE.height,
      transform: "scale(0.5)",
      transformOrigin: "top left",
      // Keep the surrounding layout sized to the scaled box.
      marginBottom: -OG_SIZE.height / 2,
      marginRight: -OG_SIZE.width / 2,
      boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
      overflow: "hidden",
    }}
  >
    <Story />
  </div>
);
