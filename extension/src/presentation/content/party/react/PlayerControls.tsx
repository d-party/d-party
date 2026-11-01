import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FaSyncAlt } from "react-icons/fa";

import { ReactionIcon } from "@/components/reactionIcons";
import { EXTRA_REACTION_BY_ID } from "@/domain/extraReactions";
import { DEFAULT_REACTIONS } from "@/domain/reactions";
import type { Settings } from "@/domain/settings";

type SettingsSubscribe = (cb: (s: Settings) => void) => () => void;

export interface PlayerControlsHandlers {
  onSync: () => void;
  onReaction: (id: string) => void;
}

/** player.css の hover 配色が参照するクラス。 */
const DEFAULT_BUTTON_CLASS: Record<string, string> = {
  thumbs_up: "thumbs_button",
  fav: "fav_button",
  smile: "smile_button",
  cry: "cry_button",
  middle_finger: "middle_finger_button",
};

export function mountPlayerControls(opts: {
  anchor: Element;
  initialSettings: Settings;
  subscribe: SettingsSubscribe;
  handlers: PlayerControlsHandlers;
}): void {
  const parent = opts.anchor.parentElement;
  if (!parent) return;
  if (document.getElementById("d-party-player-controls")) return;
  const host = document.createElement("div");
  host.id = "d-party-player-controls";
  host.style.display = "contents";
  parent.insertBefore(host, opts.anchor);
  createRoot(host).render(
    <PlayerControls
      subscribe={opts.subscribe}
      initialSettings={opts.initialSettings}
      handlers={opts.handlers}
    />,
  );
}

/** Sync, the default reactions and the user's extra reactions. */
export function PlayerControls({
  subscribe,
  initialSettings,
  handlers,
}: {
  subscribe: SettingsSubscribe;
  initialSettings: Settings;
  handlers: PlayerControlsHandlers;
}) {
  const [hidden, setHidden] = useState(initialSettings.hideReactionIcon);
  const [extraIds, setExtraIds] = useState(initialSettings.extraReactions);

  useEffect(() => {
    const off = subscribe((s) => {
      setHidden(s.hideReactionIcon);
      setExtraIds(s.extraReactions);
    });
    return () => off();
  }, [subscribe]);

  const reactionStyle = hidden ? { display: "none" as const } : undefined;
  const extraDefs = extraIds
    .map((id) => EXTRA_REACTION_BY_ID[id])
    .filter((r) => r !== undefined);

  return (
    <>
      <ControlButton
        className="sync_button controll_button"
        onClick={handlers.onSync}
      >
        <FaSyncAlt className="buttonArea_icon" />
      </ControlButton>
      {DEFAULT_REACTIONS.map((r) => (
        <ControlButton
          key={r.id}
          className={`${DEFAULT_BUTTON_CLASS[r.id] ?? "reaction_button"} controll_button`}
          style={reactionStyle}
          title={r.label}
          onClick={() => handlers.onReaction(r.id)}
        >
          <ReactionIcon
            iconKey={r.reactIcon}
            className="buttonArea_icon reaction_icon"
          />
        </ControlButton>
      ))}
      {extraDefs.map((r) => (
        <ControlButton
          key={r.id}
          className="reaction_button controll_button"
          style={reactionStyle}
          title={r.label}
          onClick={() => handlers.onReaction(r.id)}
        >
          <ReactionIcon
            iconKey={r.reactIcon}
            className="buttonArea_icon reaction_icon"
          />
        </ControlButton>
      ))}
    </>
  );
}

function ControlButton({
  className,
  style,
  title,
  onClick,
  children,
}: {
  className: string;
  style?: React.CSSProperties;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={className}
      style={style}
      title={title}
      role="button"
      onClick={onClick}
    >
      {children}
    </div>
  );
}
