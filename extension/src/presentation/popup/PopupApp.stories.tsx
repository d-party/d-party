import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

import {
  loadOf,
  SAMPLE_INFO,
  SAMPLE_LINK,
  SAMPLE_WARNING,
  SAMPLE_WARNING_LINKS,
} from "@/components/announcementSamples";
import { STORAGE_KEYS } from "@/domain/settings";

import { PopupApp } from "./PopupApp";
import { installChromeMock } from "./storybookChromeMock";

function withChromeMock(
  initial: Record<string, string | boolean> = {},
): Decorator {
  return (Story) => {
    installChromeMock(initial);
    // 実際のポップアップの幅（styles.css の #root）。
    return (
      <div className="w-[360px]">
        <Story />
      </div>
    );
  };
}

const meta: Meta<typeof PopupApp> = {
  title: "Popup/PopupApp",
  component: PopupApp,
  parameters: { layout: "centered" },
};

export default meta;

type Story = StoryObj<typeof PopupApp>;

/** First-run state: defaults (display name「ユーザー」, 別タブ自動再生 ON). */
export const Default: Story = {
  args: { loadAnnouncements: loadOf() },
  decorators: [withChromeMock()],
};

/** A returning user with some settings already saved. */
export const WithSavedSettings: Story = {
  decorators: [
    withChromeMock({
      [STORAGE_KEYS.userName]: "たかし",
      [STORAGE_KEYS.autoAnotherTab]: false,
      [STORAGE_KEYS.hideReaction]: true,
      [STORAGE_KEYS.hideReactionIcon]: true,
      [STORAGE_KEYS.selfNotification]: true,
    }),
  ],
  args: { loadAnnouncements: loadOf() },
};

/** 配信中のアナウンスはタブの上に出す。× で閉じたものは二度と出さない。 */
export const WithAnnouncement: Story = {
  args: { loadAnnouncements: loadOf(SAMPLE_WARNING) },
  decorators: [withChromeMock()],
};

/** 重要とお知らせが同時に配信されているとき。 */
export const WithAnnouncements: Story = {
  args: { loadAnnouncements: loadOf(SAMPLE_WARNING, SAMPLE_INFO) },
  decorators: [withChromeMock()],
};

/** 本文のリンク（`[テキスト](https://…)`）。新しいタブで開く。 */
export const WithLinkAnnouncements: Story = {
  args: { loadAnnouncements: loadOf(SAMPLE_WARNING_LINKS, SAMPLE_LINK) },
  decorators: [withChromeMock()],
};
