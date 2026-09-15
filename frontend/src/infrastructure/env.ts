/**
 * Backend connection configuration for the user-facing frontend.
 *
 * Resolution priority (so a single image works across all environments):
 *   1) **Explicit `NEXT_PUBLIC_*`** baked at build time — preserves the existing
 *      behaviour of dev (`pnpm dev` defaults) and compose-prod (build.args set
 *      `NEXT_PUBLIC_*=d-party.net`). When set, this always wins.
 *   2) **Browser origin** — when no `NEXT_PUBLIC_*` is baked in, derive the host
 *      and scheme from `window.location`. frontend sits behind the same nginx /
 *      cloudflared origin as the backend (nginx routes `/`→frontend and
 *      `/api`·`/admin`·WS→django), so the browser can reach the backend at its
 *      own origin. This is what prod-kube uses (image built without build-args),
 *      moving domain resolution from build time to access time.
 *   3) **SSR fallback** — non-public runtime env, then the local default.
 *
 * Example for a build-time pinned deploy (compose-prod):
 *   NEXT_PUBLIC_BACKEND_HOST="d-party.net/"
 *   NEXT_PUBLIC_BACKEND_PROTOCOL="https://"
 *   NEXT_PUBLIC_WEBSOCKET_PROTOCOL="wss://"
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
  return {
    host: process.env.PUBLIC_BACKEND_HOST ?? "localhost/",
    protocol: process.env.PUBLIC_BACKEND_PROTOCOL ?? "http://",
    ws: process.env.PUBLIC_WEBSOCKET_PROTOCOL ?? "ws://",
  };
}

const c = conn();

export const BACKEND_HOST = c.host;
export const BACKEND_PROTOCOL = c.protocol;
export const WEBSOCKET_PROTOCOL = c.ws;

export const API_ENDPOINT = `${BACKEND_PROTOCOL}${BACKEND_HOST}api/v1/`;

export const ANIMESTORE_HOST = `${BACKEND_HOST}anime-store/`;
export const WEBSOCKET_ENDPOINT = `${WEBSOCKET_PROTOCOL}${ANIMESTORE_HOST}party/`;
export const ANIMESTORE_REDIRECT_ENDPOINT = `${BACKEND_PROTOCOL}${ANIMESTORE_HOST}lobby/`;

/** Base URL (no trailing slash) used by the generated REST client. */
export const API_BASE_URL = `${BACKEND_PROTOCOL}${BACKEND_HOST}`.replace(
  /\/$/,
  "",
);

/**
 * 公開サイトの絶対 URL。OGP / Twitter カードの画像 URL を絶対化するために
 * `metadataBase`（SSR）で使う。ブラウザの `window.location` はクローラ向け SSR
 * では使えないため、ここだけ接続先導出とは別扱いにする。
 *   - dev / compose-prod: 従来どおり `NEXT_PUBLIC_SITE_URL`（無ければ既定）。
 *   - prod-kube: build に焼かない runtime env `SITE_URL`（ConfigMap）で上書き。
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "https://d-party.net";

/** Chrome ウェブストアの d-party 拡張機能ページ（インストール導線）。 */
export const CHROME_WEBSTORE_URL =
  "https://chrome.google.com/webstore/detail/d-party/ibmlcfpijglpfbfgaleaeooebgdgcbpc?hl=ja";

/** Google Chrome 配布ページ（使い方ガイドのリンク）。 */
export const GOOGLE_CHROME_URL = "https://www.google.com/intl/ja_jp/chrome/";

/** Microsoft Edge 配布ページ（Chrome 拡張機能に対応するもう一つのブラウザ）。 */
export const MICROSOFT_EDGE_URL = "https://www.microsoft.com/ja-jp/edge";

/** dアニメストア（本家）トップ。 */
export const D_ANIME_STORE_URL = "https://animestore.docomo.ne.jp/animestore/";
