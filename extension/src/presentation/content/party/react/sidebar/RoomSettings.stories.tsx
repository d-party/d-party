import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  type RoomSettings as RoomSettingsValue,
  DEFAULT_ROOM_SETTINGS,
} from "@/domain/roomSettings";

import { RoomSettings } from "./RoomSettings";

const meta: Meta<typeof RoomSettings> = {
  title: "Party/RoomSettings",
  component: RoomSettings,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-80 rounded-lg bg-card p-4 text-card-foreground">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof RoomSettings>;

function Interactive({
  initial = DEFAULT_ROOM_SETTINGS,
  disabled = false,
}: {
  initial?: RoomSettingsValue;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return <RoomSettings value={value} onChange={setValue} disabled={disabled} />;
}

/** 既定（すべて OFF）。ルーム作成時のアコーディオン内の状態。 */
export const Default: Story = { render: () => <Interactive /> };

/** 一方通行モードだけ ON。 */
export const OneWay: Story = {
  render: () => (
    <Interactive initial={{ ...DEFAULT_ROOM_SETTINGS, oneWay: true }} />
  ),
};

/** 非オーナー向けの read-only 表示（操作タブ）。 */
export const ReadOnly: Story = {
  render: () => (
    <Interactive
      initial={{ oneWay: true, ownerLeaveDelete: true, disableReaction: true }}
      disabled
    />
  ),
};
