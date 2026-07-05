/**
 * タイマーを小さな別窓（ポップアップ）として開く。常に手前へ浮かせて再生状況を見られる。
 * ポップアップがブロックされた場合は同じタブで開くフォールバック。
 *
 * ロビーの選択 UI と、タイマー画面（`TimerView`）の「別窓で開く」ボタンの両方から使う。
 */
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
