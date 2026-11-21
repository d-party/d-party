export const CHROME_WEBSTORE_URL =
  "https://chrome.google.com/webstore/detail/d-party/ibmlcfpijglpfbfgaleaeooebgdgcbpc?hl=ja";

export const GOOGLE_CHROME_URL = "https://www.google.com/intl/ja_jp/chrome/";

export const MICROSOFT_EDGE_URL = "https://www.microsoft.com/ja-jp/edge";

export const D_ANIME_STORE_URL = "https://animestore.docomo.ne.jp/animestore/";

export const GITHUB_ORG_URL = "https://github.com/d-party";

export const GITHUB_REPO_URL = `${GITHUB_ORG_URL}/d-party`;

export const GITHUB_SPONSORS_URL = "https://github.com/sponsors/d-party";

export const FEEDBACK_FORM_URL = "https://forms.gle/kKPbAPGY96rbaKgK8";

export function lobbyPath(roomId: string): string {
  return `/anime-store/lobby/${roomId}`;
}

/** `popup` は `openTimerPopup` が開く小窓用。 */
export function timerPath(roomId: string, { popup = false } = {}): string {
  return `${lobbyPath(roomId)}?timer=true${popup ? "&popup=1" : ""}`;
}
