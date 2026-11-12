/** Mirrors the backend's `ReactionType` names. */
export const REACTION_TYPES = [
  "fav",
  "middle_finger",
  "thumbs_up",
  "smile",
  "cry",
] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_META: Record<
  ReactionType,
  { label: string; emoji: string }
> = {
  fav: { label: "お気に入り", emoji: "❤️" },
  thumbs_up: { label: "いいね", emoji: "👍" },
  smile: { label: "笑顔", emoji: "😄" },
  cry: { label: "涙", emoji: "😢" },
  middle_finger: { label: "ブーイング", emoji: "🖕" },
};

/** 既定のリアクション（統計の対象）。並びは表示順。 */
export interface ReactionDef {
  id: string;
  label: string;
  reactIcon: string;
}

export const DEFAULT_REACTIONS: ReactionDef[] = [
  {
    id: "thumbs_up",
    label: REACTION_META.thumbs_up.label,
    reactIcon: "FaThumbsUp",
  },
  { id: "fav", label: REACTION_META.fav.label, reactIcon: "FaHeart" },
  { id: "smile", label: REACTION_META.smile.label, reactIcon: "FaFaceSmileBeam" },
  { id: "cry", label: REACTION_META.cry.label, reactIcon: "FaFaceSadCry" },
  {
    id: "middle_finger",
    label: REACTION_META.middle_finger.label,
    reactIcon: "FaHandMiddleFinger",
  },
];

export function isDefaultReaction(id: string): id is ReactionType {
  return (REACTION_TYPES as readonly string[]).includes(id);
}
