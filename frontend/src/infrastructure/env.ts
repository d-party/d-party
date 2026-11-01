/**
 * Backend location, in priority order:
 *   1) `NEXT_PUBLIC_*` baked at build time (dev and compose-prod)
 *   2) the browser's own origin — nginx serves both, so k3s images need no build args
 *   3) the local default during SSR (server requests use `BACKEND_INTERNAL_ORIGIN`)
 */
function conn(): { host: string; protocol: string; ws: string } {
  const explicitHost = process.env.NEXT_PUBLIC_BACKEND_HOST;
  if (explicitHost) {
    return {
      host: explicitHost,
      protocol: process.env.NEXT_PUBLIC_BACKEND_PROTOCOL ?? "http://",
      ws: process.env.NEXT_PUBLIC_WEBSOCKET_PROTOCOL ?? "ws://",
    };
  }
  if (typeof window !== "undefined") {
    const { host, protocol } = window.location;
    return {
      host: `${host}/`,
      protocol: `${protocol}//`,
      ws: protocol === "https:" ? "wss://" : "ws://",
    };
  }
  return { host: "localhost/", protocol: "http://", ws: "ws://" };
}

const c = conn();

export const BACKEND_HOST = c.host;
export const BACKEND_PROTOCOL = c.protocol;
export const WEBSOCKET_PROTOCOL = c.ws;

export const API_ENDPOINT = `${BACKEND_PROTOCOL}${BACKEND_HOST}api/v1/`;

export const ANIMESTORE_HOST = `${BACKEND_HOST}anime-store/`;
export const WEBSOCKET_ENDPOINT = `${WEBSOCKET_PROTOCOL}${ANIMESTORE_HOST}party/`;
export const ANIMESTORE_REDIRECT_ENDPOINT = `${BACKEND_PROTOCOL}${ANIMESTORE_HOST}lobby/`;

/** No trailing slash. */
export const API_BASE_URL = `${BACKEND_PROTOCOL}${BACKEND_HOST}`.replace(
  /\/$/,
  "",
);

/**
 * `metadataBase` 用の絶対 URL（SSR では window.location が無い）。k3s では実行時の
 * `SITE_URL` で、それ以外は `NEXT_PUBLIC_SITE_URL` で上書きする。
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "https://d-party.net";

export const CHROME_WEBSTORE_URL =
  "https://chrome.google.com/webstore/detail/d-party/ibmlcfpijglpfbfgaleaeooebgdgcbpc?hl=ja";

export const GOOGLE_CHROME_URL = "https://www.google.com/intl/ja_jp/chrome/";

export const MICROSOFT_EDGE_URL = "https://www.microsoft.com/ja-jp/edge";

export const D_ANIME_STORE_URL = "https://animestore.docomo.ne.jp/animestore/";
