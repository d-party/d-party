/** 利用マニュアル用: 架空のユーザー「さくら」の設定と実績を入れた設定タブ（options.html）。 */
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

import { OptionsApp } from "@/presentation/options/OptionsApp";
import { installChromeMock } from "@/presentation/popup/storybookChromeMock";

import { SAKURA_STORAGE, announcementsOf } from "./fixtures";

function withMock(initial: Record<string, unknown>): Decorator {
  return (Story) => {
    installChromeMock(initial);
    const chromeMock = (globalThis as { chrome: { runtime: { getManifest: () => unknown } } }).chrome;
    chromeMock.runtime.getManifest = () => ({ version: "2.14.1" });
    return <Story />;
  };
}

const meta: Meta<typeof OptionsApp> = {
  title: "Manual/Options",
  component: OptionsApp,
  parameters: { layout: "fullscreen" },
  // 既定では backend からアナウンスを取りにいく。撮影結果が変わらないよう、出さない。
  args: { loadAnnouncements: announcementsOf() },
};
export default meta;
type Story = StoryObj<typeof OptionsApp>;

export const Sakura: Story = { decorators: [withMock(SAKURA_STORAGE)] };
