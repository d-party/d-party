import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

import {
  PERSONAL_STATS_STORAGE_KEY,
  emptyStats,
  type PersonalStats,
} from "@/domain/personalStats";

import { PersonalStatsPanel } from "./PersonalStatsPanel";
import { installChromeMock } from "./storybookChromeMock";

function withStats(stats: PersonalStats): Decorator {
  return (Story) => {
    installChromeMock({ [PERSONAL_STATS_STORAGE_KEY]: stats });
    return (
      <div className="w-[360px] bg-background p-4 text-foreground">
        <Story />
      </div>
    );
  };
}

const populated: PersonalStats = {
  roomsCreated: 12,
  roomsJoined: 34,
  reactionsByType: {
    fav: 58,
    thumbs_up: 41,
    smile: 27,
    cry: 9,
    middle_finger: 3,
  },
  connectionMs: (5 * 60 + 42) * 60 * 1000, // 5時間42分
  since: new Date("2026-01-15").getTime(),
};

const meta: Meta<typeof PersonalStatsPanel> = {
  title: "Popup/PersonalStatsPanel",
  component: PersonalStatsPanel,
  parameters: { layout: "centered" },
};

export default meta;

type Story = StoryObj<typeof PersonalStatsPanel>;

/** A returning user with plenty of accumulated activity. */
export const Populated: Story = {
  decorators: [withStats(populated)],
};

/** First run: nothing recorded yet. */
export const Empty: Story = {
  decorators: [withStats(emptyStats())],
};
