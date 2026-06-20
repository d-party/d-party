/**
 * Backend connection configuration for the user-facing frontend.
 *
 * Port of the Chrome extension's `env.ts` (itself a port of the old
 * `js/common/settings.js`). Values default to the **local development** backend
 * (the docker-compose stack served via nginx on localhost) and can be overridden
 * at build time via `NEXT_PUBLIC_*` environment variables. For production, set:
 *   NEXT_PUBLIC_BACKEND_HOST="d-party.net/"
 *   NEXT_PUBLIC_BACKEND_PROTOCOL="https://"
 *   NEXT_PUBLIC_WEBSOCKET_PROTOCOL="wss://"
 */

export const BACKEND_HOST = process.env.NEXT_PUBLIC_BACKEND_HOST ?? "localhost/";
export const BACKEND_PROTOCOL =
  process.env.NEXT_PUBLIC_BACKEND_PROTOCOL ?? "https://";
export const WEBSOCKET_PROTOCOL =
  process.env.NEXT_PUBLIC_WEBSOCKET_PROTOCOL ?? "wss://";

export const API_ENDPOINT = `${BACKEND_PROTOCOL}${BACKEND_HOST}api/v1/`;

export const ANIMESTORE_HOST = `${BACKEND_HOST}anime-store/`;
export const WEBSOCKET_ENDPOINT = `${WEBSOCKET_PROTOCOL}${ANIMESTORE_HOST}party/`;
export const ANIMESTORE_REDIRECT_ENDPOINT = `${BACKEND_PROTOCOL}${ANIMESTORE_HOST}lobby/`;

/** Base URL (no trailing slash) used by the generated REST client. */
export const API_BASE_URL = `${BACKEND_PROTOCOL}${BACKEND_HOST}`.replace(
  /\/$/,
  "",
);

/** Chrome ウェブストアの d-party 拡張機能ページ（インストール導線）。 */
export const CHROME_WEBSTORE_URL =
  "https://chrome.google.com/webstore/detail/d-party/ibmlcfpijglpfbfgaleaeooebgdgcbpc?hl=ja";

/** Google Chrome 配布ページ（使い方ガイドのリンク）。 */
export const GOOGLE_CHROME_URL = "https://www.google.com/intl/ja_jp/chrome/";

/** Microsoft Edge 配布ページ（Chrome 拡張機能に対応するもう一つのブラウザ）。 */
export const MICROSOFT_EDGE_URL = "https://www.microsoft.com/ja-jp/edge";

/** dアニメストア（本家）トップ。 */
export const D_ANIME_STORE_URL = "https://animestore.docomo.ne.jp/animestore/";
