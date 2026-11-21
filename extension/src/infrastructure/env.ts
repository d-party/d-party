/**
 * 接続先。ビルド時の `D_PARTY_ENV` を DefinePlugin がリテラルに置き換える。
 * 未指定は localhost（http / ws）、`production` は d-party.net（https / wss）。
 * 公開サイト・REST API・WebSocket はすべて同じホストにある。
 */

const IS_PRODUCTION = process.env.D_PARTY_ENV === "production";
const HOST = IS_PRODUCTION ? "d-party.net" : "localhost";

/** 末尾にスラッシュを付けない。orval のクライアントはこれにパスを継ぎ足す。 */
export const API_BASE_URL = `${IS_PRODUCTION ? "https" : "http"}://${HOST}`;

export const SITE_URL = `${API_BASE_URL}/`;
export const USAGE_URL = `${SITE_URL}usage`;

export const WEBSOCKET_ENDPOINT = `${IS_PRODUCTION ? "wss" : "ws"}://${HOST}/anime-store/party/`;

/** 共有リンク（ロビー）。拡張機能の有無を確かめてから dアニメストアへ送る。 */
export const lobbyUrl = (roomId: string): string =>
  `${SITE_URL}anime-store/lobby/${roomId}`;

// DMM TV 用（backend の dmm-tv/* ルート）。同期プロトコルは dアニメと共通で、接続先だけが違う。
export const DMM_WEBSOCKET_ENDPOINT = `${IS_PRODUCTION ? "wss" : "ws"}://${HOST}/dmm-tv/party/`;

/** DMM TV の共有リンク（ロビー）。 */
export const dmmLobbyUrl = (roomId: string): string =>
  `${SITE_URL}dmm-tv/lobby/${roomId}`;

export const FACEBOOK_APP_ID = "256850306460920";
