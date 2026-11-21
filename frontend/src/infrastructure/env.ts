/**
 * Every environment variable the app reads is read here.
 *
 * Backend location, in priority order:
 *   1) `NEXT_PUBLIC_*` baked at build time (dev and compose-prod)
 *   2) the browser's own origin — nginx serves both, so k3s images need no build args
 *   3) the local default during SSR (server requests use `BACKEND_INTERNAL_ORIGIN`)
 */
function backendOrigins(): { http: string; ws: string } {
  // `NEXT_PUBLIC_BACKEND_HOST` carries a trailing slash (`d-party.net/`).
  const host = process.env.NEXT_PUBLIC_BACKEND_HOST?.replace(/\/$/, "");
  if (host) {
    return {
      http: `${process.env.NEXT_PUBLIC_BACKEND_PROTOCOL ?? "http://"}${host}`,
      ws: `${process.env.NEXT_PUBLIC_WEBSOCKET_PROTOCOL ?? "ws://"}${host}`,
    };
  }
  if (typeof window !== "undefined") {
    const { origin } = window.location;
    return { http: origin, ws: origin.replace(/^http/, "ws") };
  }
  return { http: "http://localhost", ws: "ws://localhost" };
}

const backend = backendOrigins();

/**
 * Origin the REST client prefixes, without a trailing slash. On the server it is
 * `BACKEND_INTERNAL_ORIGIN` (e.g. `http://django:8000`) when set: the public URL
 * would hairpin through nginx and can hang `generateMetadata`.
 */
export const API_BASE_URL = (
  (typeof window === "undefined" && process.env.BACKEND_INTERNAL_ORIGIN) ||
  backend.http
).replace(/\/$/, "");

export const WEBSOCKET_ENDPOINT = `${backend.ws}/anime-store/party/`;

/**
 * `metadataBase` 用の絶対 URL（SSR では window.location が無い）。k3s では実行時の
 * `SITE_URL` で、それ以外は `NEXT_PUBLIC_SITE_URL` で上書きする。
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "https://d-party.net";
