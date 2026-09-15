import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ogPreview } from "./ogPreview";
import { RoomOgImage } from "./RoomOgImage";

/**
 * Preview of the room Open Graph image (1200×630). The exact same component is
 * rasterized to PNG by `app/anime-store/lobby/[roomId]/opengraph-image.tsx`
 * via `next/og` (`@vercel/og`), so this story shows what the shared card looks
 * like. Rendered at half scale to fit the canvas; toggle the `title` control to
 * try different anime titles (empty = older-extension fallback).
 */
const meta: Meta<typeof RoomOgImage> = {
  title: "OGP/RoomOgImage",
  component: RoomOgImage,
  parameters: {
    layout: "centered",
    backgrounds: { default: "light" },
  },
  decorators: [ogPreview],
  argTypes: {
    title: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof RoomOgImage>;

export const WithTitle: Story = {
  args: { title: "葬送のフリーレン - 第1話 - 冒険の終わり" },
};

export const WorkTitleOnly: Story = {
  args: { title: "ぼっち・ざ・ろっく！" },
};

export const LongTitle: Story = {
  args: {
    title:
      "公爵令嬢の嗜み - 第12話 - とても長いサブタイトルが入った場合のレイアウト確認用エピソード",
  },
};

/** Rooms created by older extension versions send no title → generic fallback. */
export const NoTitleFallback: Story = {
  args: { title: "" },
};
