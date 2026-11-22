import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { MdPictureInPicture, MdPictureInPictureAlt } from "react-icons/md";

import type { Settings } from "@/domain/settings";

import { type SettingsSubscribe, useLiveSettings } from "./useLiveSettings";

const HOST_ID = "d-party-pip-button";

interface PipButtonProps {
  initialSettings: Settings;
  subscribe: SettingsSubscribe;
  onToggle: () => void;
}

/** Picture-in-Picture toggle. Shown without a room and not synced to the room. */
export function mountPipButton({
  fullscreenButton,
  ...props
}: PipButtonProps & { fullscreenButton: Element }): void {
  const parent = fullscreenButton.parentElement;
  if (!parent) return;
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.display = "contents";
  parent.insertBefore(host, fullscreenButton);
  createRoot(host).render(<PipButton {...props} />);
}

function PipButton({ initialSettings, subscribe, onToggle }: PipButtonProps) {
  const { enablePictureInPicture } = useLiveSettings(initialSettings, subscribe);
  const inPip = useSyncExternalStore(subscribePip, isInPip);

  if (!enablePictureInPicture) return null;

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

const playerVideo = () => document.getElementById("video");

function subscribePip(onChange: () => void): () => void {
  const video = playerVideo();
  if (!video) return () => undefined;
  video.addEventListener("enterpictureinpicture", onChange);
  video.addEventListener("leavepictureinpicture", onChange);
  return () => {
    video.removeEventListener("enterpictureinpicture", onChange);
    video.removeEventListener("leavepictureinpicture", onChange);
  };
}

function isInPip(): boolean {
  const video = playerVideo();
  return video !== null && document.pictureInPictureElement === video;
}
