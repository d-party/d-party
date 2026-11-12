/** ルーム設定（backend の `Setting`）。ワイヤの snake_case とは {@link fromWire} で変換する。 */
export interface RoomSettings {
  /** オーナーだけが再生を操作できる。 */
  oneWay: boolean;
  /** オーナーが抜けたらルームを消す。 */
  ownerLeaveDelete: boolean;
  /** リアクションを送らない（自分の画面にだけ出す）。 */
  disableReaction: boolean;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  oneWay: false,
  ownerLeaveDelete: false,
  disableReaction: false,
};

export function isDefaultRoomSettings(settings: RoomSettings): boolean {
  return (
    !settings.oneWay && !settings.ownerLeaveDelete && !settings.disableReaction
  );
}

export const ROOM_SETTING_LABELS: Record<keyof RoomSettings, string> = {
  oneWay: "一方通行モード",
  ownerLeaveDelete: "オーナー退室時の自動削除",
  disableReaction: "リアクション禁止",
};

export interface RoomSettingChange {
  key: keyof RoomSettings;
  label: string;
  enabled: boolean;
}

export function diffRoomSettings(
  previous: RoomSettings,
  next: RoomSettings,
): RoomSettingChange[] {
  const keys: (keyof RoomSettings)[] = [
    "oneWay",
    "ownerLeaveDelete",
    "disableReaction",
  ];
  return keys
    .filter((key) => previous[key] !== next[key])
    .map((key) => ({
      key,
      label: ROOM_SETTING_LABELS[key],
      enabled: next[key],
    }));
}

export function fromWire(wire: {
  one_way?: boolean;
  owner_leave_delete?: boolean;
  disable_reaction?: boolean;
}): RoomSettings {
  return {
    oneWay: wire.one_way ?? false,
    ownerLeaveDelete: wire.owner_leave_delete ?? false,
    disableReaction: wire.disable_reaction ?? false,
  };
}
