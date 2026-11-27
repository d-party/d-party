/** Mirrors the backend's `ReactionType` names. */
export const REACTION_TYPES = [
  "fav",
  "middle_finger",
  "thumbs_up",
  "smile",
  "cry",
] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];

/** `reactIcon` は react-icons (Font Awesome 6) のキー。 */
export const REACTION_META: Record<
  ReactionType,
  { label: string; emoji: string; reactIcon: string }
> = {
  fav: { label: "お気に入り", emoji: "❤️", reactIcon: "FaHeart" },
  thumbs_up: { label: "いいね", emoji: "👍", reactIcon: "FaThumbsUp" },
  smile: { label: "笑顔", emoji: "😄", reactIcon: "FaFaceSmileBeam" },
  cry: { label: "涙", emoji: "😢", reactIcon: "FaFaceSadCry" },
  middle_finger: {
    label: "ブーイング",
    emoji: "🖕",
    reactIcon: "FaHandMiddleFinger",
  },
};

export interface ReactionDef {
  id: ReactionType;
  label: string;
  reactIcon: string;
}

const DISPLAY_ORDER: readonly ReactionType[] = [
  "thumbs_up",
  "fav",
  "smile",
  "cry",
  "middle_finger",
];

/** 既定のリアクション（統計の対象）。並びは表示順。 */
export const DEFAULT_REACTIONS: readonly ReactionDef[] = DISPLAY_ORDER.map(
  (id) => ({
    id,
    label: REACTION_META[id].label,
    reactIcon: REACTION_META[id].reactIcon,
  }),
);

export function isDefaultReaction(id: string): id is ReactionType {
  return (REACTION_TYPES as readonly string[]).includes(id);
}
