import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MdPictureInPicture, MdPictureInPictureAlt } from "react-icons/md";

import type { Settings } from "@/domain/settings";

type SettingsSubscribe = (cb: (s: Settings) => void) => () => void;

/** Picture-in-Picture toggle. Shown without a room and not synced to the room. */
export function mountPipButton(opts: {
  fullscreenButton: Element;
  initialSettings: Settings;
  subscribe: SettingsSubscribe;
  onToggle: () => void;
}): void {
  const parent = opts.fullscreenButton.parentElement;
  if (!parent) return;
  if (document.getElementById("d-party-pip-button")) return;
  const host = document.createElement("div");
  host.id = "d-party-pip-button";
  host.style.display = "contents";
  parent.insertBefore(host, opts.fullscreenButton);
  createRoot(host).render(
    <PipButton
      initialSettings={opts.initialSettings}
      subscribe={opts.subscribe}
      onToggle={opts.onToggle}
    />,
  );
}

export function PipButton({
  initialSettings,
  subscribe,
  onToggle,
}: {
  initialSettings: Settings;
  subscribe: SettingsSubscribe;
  onToggle: () => void;
}) {
  const [enabled, setEnabled] = useState(initialSettings.enablePictureInPicture);
  const inPip = usePipState();

  useEffect(() => {
    const off = subscribe((s) => setEnabled(s.enablePictureInPicture));
    return () => off();
  }, [subscribe]);

  if (!enabled) return null;

  return (
    <div
      className="pip_main_button"
      role="button"
      title={
        inPip ? "ピクチャーインピクチャーを終了" : "ピクチャーインピクチャーで再生"
      }
      onClick={onToggle}
    >
      {inPip ? <MdPictureInPicture /> : <MdPictureInPictureAlt />}
    </div>
  );
}

function usePipState(): boolean {
  const [inPip, setInPip] = useState(false);
  useEffect(() => {
    const v = document.getElementById("video") as HTMLVideoElement | null;
    if (!v) return;
    const update = () => setInPip(document.pictureInPictureElement === v);
    v.addEventListener("enterpictureinpicture", update);
    v.addEventListener("leavepictureinpicture", update);
    update();
    return () => {
      v.removeEventListener("enterpictureinpicture", update);
      v.removeEventListener("leavepictureinpicture", update);
    };
  }, []);
  return inPip;
}
