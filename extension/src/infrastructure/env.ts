/**
 * 接続先。ビルド時の `D_PARTY_ENV` を DefinePlugin がリテラルに置き換える。
 * 未指定は localhost（http / ws）、`production` は d-party.net（https / wss）。
 */

const IS_PRODUCTION = process.env.D_PARTY_ENV === "production";

export const BACKEND_HOST = IS_PRODUCTION ? "d-party.net/" : "localhost/";
export const BACKEND_PROTOCOL = IS_PRODUCTION ? "https://" : "http://";
export const WEBSOCKET_PROTOCOL = IS_PRODUCTION ? "wss://" : "ws://";

export const API_ENDPOINT = `${BACKEND_PROTOCOL}${BACKEND_HOST}api/v1/`;
export const HEALTH_CHECK_ENDPOINT = `${API_ENDPOINT}health`;
export const VERSION_CHECK_ENDPOINT = `${API_ENDPOINT}chrome-extension/version-check`;

/** 公開サイトの URL（backend と同じホスト）。 */
export const SITE_URL = `${BACKEND_PROTOCOL}${BACKEND_HOST}`;
export const USAGE_URL = `${SITE_URL}usage`;

export const ANIMESTORE_HOST = `${BACKEND_HOST}anime-store/`;
export const WEBSOCKET_ENDPOINT = `${WEBSOCKET_PROTOCOL}${ANIMESTORE_HOST}party/`;
export const ANIMESTORE_REDIRECT_ENDPOINT = `${BACKEND_PROTOCOL}${ANIMESTORE_HOST}lobby/`;

// DMM TV 用エンドポイント（バックエンドの dmm-tv/* ルートに対応）。WS 同期プロトコルは
// dアニメと共通で、接続先だけがサービスごとに分かれる。プレイヤー同期の結線は PR2。
export const DMM_HOST = `${BACKEND_HOST}dmm-tv/`;
export const DMM_WEBSOCKET_ENDPOINT = `${WEBSOCKET_PROTOCOL}${DMM_HOST}party/`;
export const DMM_REDIRECT_ENDPOINT = `${BACKEND_PROTOCOL}${DMM_HOST}lobby/`;

/** No trailing slash. */
export const API_BASE_URL = `${BACKEND_PROTOCOL}${BACKEND_HOST}`.replace(/\/$/, "");

export const FACEBOOK_APP_ID = "256850306460920";
