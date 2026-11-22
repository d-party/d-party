import { timerPath } from "@/lib/links";

const POPUP_WIDTH = 380;
const POPUP_HEIGHT = 280;

/** タイマーを小窓で開く。ブロックされたら同じタブで開く。 */
export function openTimerPopup(roomId: string): void {
  const url = timerPath(roomId, { popup: true });
  const left = Math.round(
    window.screenX + Math.max(0, (window.outerWidth - POPUP_WIDTH) / 2),
  );
  const top = Math.round(
    window.screenY + Math.max(0, (window.outerHeight - POPUP_HEIGHT) / 2),
  );
  const features = `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`;
  const opened = window.open(url, "d-party-timer", features);
  if (!opened) window.location.href = url;
}
