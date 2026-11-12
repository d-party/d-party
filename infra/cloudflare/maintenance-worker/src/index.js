// オリジン（Cloudflare Tunnel の先の nginx）に届かないときに、Cloudflare の
// エラーページの代わりに静的なメンテナンスページを返す Worker。
//
// nginx が生きている間のエラー（django / frontend の停止・計画メンテナンス）は nginx が
// 同じページを 503 で返すので、ここでは触らない。

import maintenancePage from "../../../helm/d-party/files/maintenance.html";

/**
 * Cloudflare 側で生成されるエラーかどうか。
 *
 * - 502 / 504: cloudflared が nginx に届かない
 * - 520〜530 : オリジン到達不能。530 はトンネル切断（Error 1033）
 *
 * 503 は含めない。nginx のメンテナンスページと `/api/v1/health` の 503 を通すため。
 */
export function isEdgeError(status) {
  return status === 502 || status === 504 || (status >= 520 && status <= 530);
}

function maintenanceResponse() {
  return new Response(maintenancePage, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "60",
    },
  });
}

export default {
  async fetch(request) {
    // WebSocket はそのまま通す（応答を読み替えると 101 の受け渡しが壊れる）。
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return fetch(request);
    }
    let response;
    try {
      response = await fetch(request);
    } catch {
      return maintenanceResponse();
    }
    return isEdgeError(response.status) ? maintenanceResponse() : response;
  },
};
