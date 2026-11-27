import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

import { installChromeMock } from "@/presentation/popup/storybookChromeMock";

import { Announcements } from "./Announcements";
import { loadOf, SAMPLE_INFO, SAMPLE_WARNING } from "./announcementSamples";

/** `dismissed` は閉じた扱いにしておく ID（`chrome.storage.local`）。 */
function withChromeMock(dismissed: number[] = []): Decorator {
  return (Story) => {
    installChromeMock({}, { dismissedAnnouncementIds: dismissed });
    return (
      <div className="w-[360px] bg-background pb-3">
        <Story />
      </div>
    );
  };
}

const meta: Meta<typeof Announcements> = {
  title: "Components/Announcements",
  component: Announcements,
  parameters: { layout: "centered" },
  args: { itemClassName: "px-4 pt-3" },
};

export default meta;

type Story = StoryObj<typeof Announcements>;

/** 通常のお知らせ。× で閉じると、以後は出ない。 */
export const Info: Story = {
  args: { load: loadOf(SAMPLE_INFO) },
  decorators: [withChromeMock()],
};

/** 重要（メンテナンスなど）。色とアイコンで区別する。 */
export const Warning: Story = {
  args: { load: loadOf(SAMPLE_WARNING) },
  decorators: [withChromeMock()],
};

/** 配信中が複数あれば、重要 → 新しい順（backend の並び）に重ねる。 */
export const Stacked: Story = {
  args: { load: loadOf(SAMPLE_WARNING, SAMPLE_INFO) },
  decorators: [withChromeMock()],
};

/** 本文の上限（60 文字）。 */
export const LongestMessage: Story = {
  args: {
    load: loadOf({ ...SAMPLE_INFO, message: "あいうえおかきくけこ".repeat(6) }),
  },
  decorators: [withChromeMock()],
};

/** 閉じたことのあるもの（ID 1）は出さない。 */
export const AlreadyDismissed: Story = {
  args: { load: loadOf(SAMPLE_WARNING, SAMPLE_INFO) },
  decorators: [withChromeMock([SAMPLE_WARNING.id])],
};

/** 取得に失敗したときは何も描かない。 */
export const LoadFailed: Story = {
  args: { load: () => Promise.reject(new Error("offline")) },
  decorators: [withChromeMock()],
};
