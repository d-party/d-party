import { createRoot } from "react-dom/client";
import { FaSyncAlt } from "react-icons/fa";

import { ReactionIcon } from "@/components/reactionIcons";
import { findExtraReaction } from "@/domain/extraReactions";
import { DEFAULT_REACTIONS, type ReactionType } from "@/domain/reactions";
import type { Settings } from "@/domain/settings";

import { type SettingsSubscribe, useLiveSettings } from "./useLiveSettings";

const HOST_ID = "d-party-player-controls";

export interface PlayerControlsHandlers {
  onSync: () => void;
  onReaction: (id: string) => void;
}

interface PlayerControlsProps {
  initialSettings: Settings;
  subscribe: SettingsSubscribe;
  handlers: PlayerControlsHandlers;
}

/** player.css の hover 配色が参照するクラス。 */
const DEFAULT_BUTTON_CLASS: Record<ReactionType, string> = {
  thumbs_up: "thumbs_button",
  fav: "fav_button",
  smile: "smile_button",
  cry: "cry_button",
  middle_finger: "middle_finger_button",
};
const EXTRA_BUTTON_CLASS = "reaction_button";

export function mountPlayerControls({
  anchor,
  ...props
}: PlayerControlsProps & { anchor: Element }): void {
  const parent = anchor.parentElement;
  if (!parent) return;
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.display = "contents";
  parent.insertBefore(host, anchor);
  createRoot(host).render(<PlayerControls {...props} />);
}

/** Sync, the default reactions and the user's extra reactions. */
function PlayerControls({
  initialSettings,
  subscribe,
  handlers,
}: PlayerControlsProps) {
  const { hideReactionIcon, extraReactions } = useLiveSettings(
    initialSettings,
    subscribe,
  );

  const reactions = [
    ...DEFAULT_REACTIONS.map((r) => ({
      ...r,
      buttonClass: DEFAULT_BUTTON_CLASS[r.id],
    })),
    ...extraReactions
      .map(findExtraReaction)
      .filter((r) => r !== undefined)
      .map((r) => ({ ...r, buttonClass: EXTRA_BUTTON_CLASS })),
  ];

  return (
    <>
      <div
        className="sync_button controll_button"
        role="button"
        onClick={handlers.onSync}
      >
        <FaSyncAlt className="buttonArea_icon" />
      </div>
      {reactions.map((r) => (
        <div
          key={r.id}
          className={`${r.buttonClass} controll_button`}
          style={hideReactionIcon ? { display: "none" } : undefined}
          title={r.label}
          role="button"
          onClick={() => handlers.onReaction(r.id)}
        >
          <ReactionIcon
            iconKey={r.reactIcon}
            className="buttonArea_icon reaction_icon"
          />
        </div>
      ))}
    </>
  );
}
