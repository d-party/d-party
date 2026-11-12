/** タイマーを小窓で開く。ブロックされたら同じタブで開く。 */

export function openTimerPopup(roomId: string): void {
  const url = `/anime-store/lobby/${roomId}?timer=true&popup=1`;
  const width = 380;
  const height = 280;
  const left = Math.round(
    window.screenX + Math.max(0, (window.outerWidth - width) / 2),
  );
  const top = Math.round(
    window.screenY + Math.max(0, (window.outerHeight - height) / 2),
  );
  const features = `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
  const opened = window.open(url, "d-party-timer", features);
  if (!opened) window.location.href = url;
}
