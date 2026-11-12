/**
 * content script ↔ background のメッセージ。公開ページの content script から
 * localhost への fetch は Local Network Access で止まるので、background に任せる。
 */

export interface HealthCheckRequest {
  type: "healthCheck";
}

/** `ok` は 2xx だったか。 */

export interface HealthCheckResponse {
  ok: boolean;
}
