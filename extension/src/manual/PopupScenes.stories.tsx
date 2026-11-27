/** 利用マニュアル用: 架空のユーザー「さくら」の設定と統計を入れたポップアップ。 */
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

import { PERSONAL_STATS_STORAGE_KEY } from "@/domain/personalStats";
import { STORAGE_KEYS } from "@/domain/settings";
import { PopupApp } from "@/presentation/popup/PopupApp";
import { installChromeMock } from "@/presentation/popup/storybookChromeMock";

const SAKURA_STORAGE = {
  [STORAGE_KEYS.userName]: "さくら",
  [STORAGE_KEYS.userIcon]: "FaCat",
  [STORAGE_KEYS.extraReactions]: ["2604", "1f44f", "2615"],
  [PERSONAL_STATS_STORAGE_KEY]: {
    roomsCreated: 8,
    roomsJoined: 15,
    reactionsByType: { fav: 42, thumbs_up: 31, smile: 57, cry: 12, middle_finger: 2 },
    connectionMs: 26 * 60 * 60 * 1000 + 15 * 60 * 1000,
    since: new Date("2026-04-03T20:00:00+09:00").getTime(),
  },
};

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
};
export default meta;
type Story = StoryObj<typeof PopupApp>;

export const Sakura: Story = { decorators: [withMock(SAKURA_STORAGE)] };

/** インストール直後（既定値）。 */
export const FirstRun: Story = { decorators: [withMock({})] };
