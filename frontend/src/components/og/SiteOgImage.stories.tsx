import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ogPreview } from "./ogPreview";
import { SiteOgImage } from "./SiteOgImage";

/**
 * Preview of the site-wide Open Graph card (1200×630). The exact same component
 * is rasterized to PNG by `app/opengraph-image.tsx` / `app/twitter-image.tsx`
 * via `next/og` (`@vercel/og`), so this story shows the card every page other
 * than a room lobby shares. Rendered at half scale to fit the canvas.
 */
const meta: Meta<typeof SiteOgImage> = {
  title: "OGP/SiteOgImage",
  component: SiteOgImage,
  parameters: {
    layout: "centered",
    backgrounds: { default: "light" },
  },
  decorators: [ogPreview],
};

export default meta;
type Story = StoryObj<typeof SiteOgImage>;

/** The card served for the landing page, 使い方, Q&A, 統計, プライバシー, 404. */
export const Default: Story = {};
