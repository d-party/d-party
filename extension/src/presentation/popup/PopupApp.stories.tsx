import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

import { STORAGE_KEYS } from "@/domain/settings";

import { PopupApp } from "./PopupApp";
import { installChromeMock } from "./storybookChromeMock";

function withChromeMock(initial: Record<string, string | boolean> = {}): Decorator {
  return (Story) => {
    installChromeMock(initial);
    return <Story />;
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
};
