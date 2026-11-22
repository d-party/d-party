/** Popup settings in `chrome.storage.sync`. Do not rename the storage keys: users' values live there. */

/**
 * - `normal`: 下から浮上し、最上部で少し止まって消える
 * - `badge`: 右下に「ユーザー名 : リアクション」を出す
 * - `left`: 左側を揺れながら上る
 */
export const REACTION_DISPLAY_MODES = ["normal", "badge", "left"] as const;

export type ReactionDisplayMode = (typeof REACTION_DISPLAY_MODES)[number];

export const USER_NAME_MAX_LENGTH = 15;

/** react-icons (Font Awesome 6) のキー。backend の既定値と同じ。 */
export const DEFAULT_USER_ICON = "FaRegUser";

export interface Settings {
  autoAnotherTab: boolean;
  autoUserNameDecision: boolean;
  enablePictureInPicture: boolean;
  hideReaction: boolean;
  hideReactionIcon: boolean;
  selfNotification: boolean;
  reactionDisplay: ReactionDisplayMode;
  /** 追加したエクストラリアクションの id（既定の 5 種は含めない）。 */
  extraReactions: string[];
  userName: string;
  /** react-icons (Font Awesome 6) のキー（例: "FaCat"）。 */
  userIcon: string;
}

export const DEFAULT_SETTINGS: Settings = {
  autoAnotherTab: true,
  autoUserNameDecision: false,
  enablePictureInPicture: true,
  hideReaction: false,
  hideReactionIcon: false,
  selfNotification: false,
  reactionDisplay: "normal",
  extraReactions: [],
  userName: "ユーザー",
  userIcon: DEFAULT_USER_ICON,
};

export const STORAGE_KEYS = {
  autoAnotherTab: "auto_another_tab",
  autoUserNameDecision: "auto_user_name_decision",
  enablePictureInPicture: "enable_picture_in_picture",
  hideReaction: "hide_reaction",
  hideReactionIcon: "hide_reaction_icon",
  selfNotification: "self_notification",
  reactionDisplay: "reaction_display",
  extraReactions: "extra_reactions",
  userName: "user_name",
  userIcon: "user_icon",
} as const satisfies Record<keyof Settings, string>;
