/** 利用マニュアル用: 架空のユーザー「さくら」の設定と統計を入れたポップアップ。 */
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

import { PopupApp } from "@/presentation/popup/PopupApp";
import { installChromeMock } from "@/presentation/popup/storybookChromeMock";

import { MANUAL_ANNOUNCEMENTS, SAKURA_STORAGE, announcementsOf } from "./fixtures";

function withMock(initial: Record<string, unknown>): Decorator {
  return (Story) => {
    installChromeMock(initial);
    const chromeMock = (globalThis as { chrome: { runtime: { getManifest: () => unknown } } }).chrome;
    chromeMock.runtime.getManifest = () => ({ version: "2.14.1" });
    return (
      <div id="popup-frame" className="w-[360px] bg-background text-foreground shadow-xl">
        <Story />
      </div>
    );
  };
}

const meta: Meta<typeof PopupApp> = {
  title: "Manual/Popup",
  component: PopupApp,
  parameters: { layout: "centered" },
  // 既定では backend からアナウンスを取りにいく。撮影結果が変わらないよう、ふだんは出さない。
  args: { loadAnnouncements: announcementsOf() },
};
export default meta;
type Story = StoryObj<typeof PopupApp>;

export const Sakura: Story = { decorators: [withMock(SAKURA_STORAGE)] };

/** インストール直後（既定値）。 */
export const FirstRun: Story = { decorators: [withMock({})] };

/** 運営からのアナウンスが出ているところ。配信中が 2 件あっても、出るのは一番新しい 1 件だけ。 */
export const SakuraAnnouncements: Story = {
  decorators: [withMock(SAKURA_STORAGE)],
  args: { loadAnnouncements: announcementsOf(...MANUAL_ANNOUNCEMENTS) },
};
