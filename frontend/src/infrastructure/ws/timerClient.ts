/**
 * タイマー画面用の最小 WebSocket クライアント（観覧専用 / spectator）。
 *
 * 拡張機能なし・dアニメストア不要のユーザーが、ルームの再生状況だけを見られるようにする。
 * バックエンドの `spectate` アクションで**読み取り専用参加**し、既存の `video_operation`
 * ブロードキャスト（ホストの操作 + 5 秒ごとのハートビート）を受信する。**追加の WS メッセージ
 * 種別は送らない**（spectate を一度送るだけで、あとは受信して計算で再生位置を再現する）。
 *
 * プロトコルはバックエンド `streamer/format.py` と対応（拡張機能 `domain/protocol.ts` のミラー）。
 */

/** サーバから受信する再生状態（pydantic が paused/rate を文字列化する）。 */
export interface TimerSyncOption {
  time: number;
  paused: string; // "True" / "False"
  rate: string;
  part_id: string;
}

export interface TimerClientHandlers {
  /** spectate 受理応答（初期の part_id / title）。 */
  onAck?: (partId: string, title: string) => void;
  /** ホストの動画操作（再生/一時停止/シーク/ハートビート）。 */
  onVideoOperation?: (option: TimerSyncOption, title?: string) => void;
  /** ルーム終了 / 観覧失敗 / 想定外クローズ。 */
  onEnded?: (reason: "room_deleted" | "failed_spectate" | "closed") => void;
  onOpen?: () => void;
}

/**
 * 観覧専用の WS 接続を張り、spectate を送って受信をハンドラへ流す。
 * 想定外クローズ時は最大 `maxRetries` 回まで再接続する。`close()` で明示終了。
 */
export class TimerSpectatorClient {
  private ws: WebSocket | null = null;
  private closedByUs = false;
  private retries = 0;
  private reconnectTimer: number | null = null;

  constructor(
    private readonly url: string,
    private readonly roomId: string,
    private readonly handlers: TimerClientHandlers,
    private readonly maxRetries = 5,
    private readonly retryDelayMs = 2000,
  ) {}

  connect(): void {
    this.closedByUs = false;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.retries = 0;
      this.handlers.onOpen?.();
      ws.send(
        JSON.stringify({
          action: "spectate",
          room_id: this.roomId,
          request_id: Date.now(),
        }),
      );
    });

    ws.addEventListener("message", (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      switch (msg.action) {
        case "spectate":
          this.handlers.onAck?.(
            String(msg.part_id ?? ""),
            String(msg.title ?? ""),
          );
          break;
        case "video_operation":
          this.handlers.onVideoOperation?.(
            msg.option as TimerSyncOption,
            msg.title as string | undefined,
          );
          break;
        case "server_message":
          if (msg.message_type === "room_deleted") {
            this.closedByUs = true;
            this.handlers.onEnded?.("room_deleted");
          } else if (msg.message_type === "failed_spectate") {
            this.closedByUs = true;
            this.handlers.onEnded?.("failed_spectate");
          }
          break;
      }
    });

    ws.addEventListener("close", () => {
      if (this.closedByUs) return;
      if (this.retries < this.maxRetries) {
        this.retries += 1;
        this.reconnectTimer = window.setTimeout(
          () => this.connect(),
          this.retryDelayMs,
        );
      } else {
        this.handlers.onEnded?.("closed");
      }
    });

    // error は close を誘発するため、close 側の再接続に任せる。
    ws.addEventListener("error", () => {});
  }

  close(): void {
    this.closedByUs = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws?.close();
    } catch {
      /* noop */
    }
    this.ws = null;
  }
}
