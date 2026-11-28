import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

import { loadOf, SAMPLE_WARNING } from "@/components/announcementSamples";
import { STORAGE_KEYS } from "@/domain/settings";
import { installChromeMock } from "@/presentation/popup/storybookChromeMock";

import { OptionsApp } from "./OptionsApp";

function withChromeMock(
  initial: Record<string, unknown> = {},
): Decorator {
  return (Story) => {
    installChromeMock(initial);
    return <Story />;
  };
}

const meta: Meta<typeof OptionsApp> = {
  title: "Options/OptionsApp",
  component: OptionsApp,
  parameters: { layout: "fullscreen" },
  args: { loadAnnouncements: loadOf() },
};

export default meta;

type Story = StoryObj<typeof OptionsApp>;

/** First-run state: defaults (display name「ユーザー」, 別タブ自動再生 ON). */
export const Default: Story = { decorators: [withChromeMock()] };

/** A returning user with some settings and extra reactions saved. */
export const WithSavedSettings: Story = {
  decorators: [
    withChromeMock({
      [STORAGE_KEYS.userName]: "たかし",
      [STORAGE_KEYS.autoAnotherTab]: false,
      [STORAGE_KEYS.hideReaction]: true,
      [STORAGE_KEYS.extraReactions]: ["2604", "1f44f", "2615"],
    }),
  ],
};

/** 配信中のアナウンスはヘッダーの下に出す。 */
export const WithAnnouncement: Story = {
  args: { loadAnnouncements: loadOf(SAMPLE_WARNING) },
  decorators: [withChromeMock()],
};
