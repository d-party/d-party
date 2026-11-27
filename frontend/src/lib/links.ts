export const CHROME_WEBSTORE_URL =
  "https://chromewebstore.google.com/detail/d-party/ibmlcfpijglpfbfgaleaeooebgdgcbpc?hl=ja";

export const GOOGLE_CHROME_URL = "https://www.google.com/intl/ja_jp/chrome/";

export const MICROSOFT_EDGE_URL = "https://www.microsoft.com/ja-jp/edge";

export const D_ANIME_STORE_URL = "https://animestore.docomo.ne.jp/animestore/";

export const DMM_TV_URL = "https://tv.dmm.com/vod/";

export const GITHUB_ORG_URL = "https://github.com/d-party";

export const GITHUB_REPO_URL = `${GITHUB_ORG_URL}/d-party`;

export const GITHUB_SPONSORS_URL = "https://github.com/sponsors/d-party";

export const FEEDBACK_FORM_URL = "https://forms.gle/kKPbAPGY96rbaKgK8";

/** ロビーを持つ動画配信サービス。ロビーのパスの先頭（`/<service>/lobby/<roomId>`）でもある。 */
export type LobbyService = "anime-store" | "dmm-tv";

export function lobbyPath(
  roomId: string,
  service: LobbyService = "anime-store",
): string {
  return `/${service}/lobby/${roomId}`;
}

/** タイマー画面は dアニメストアのロビーだけ。`popup` は `openTimerPopup` が開く小窓用。 */
export function timerPath(roomId: string, { popup = false } = {}): string {
  return `${lobbyPath(roomId)}?timer=true${popup ? "&popup=1" : ""}`;
}
