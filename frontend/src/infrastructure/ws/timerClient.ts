/**
 * タイマー画面用の WebSocket クライアント。`spectate` を 1 度送り、あとは
 * `video_operation` を受けるだけ。形は backend の `streamer/format.py` に合わせる。
 */

/** paused / rate は文字列で届く。 */
export interface TimerSyncOption {
  time: number;
  paused: string; // "True" / "False"
  rate: string;
  part_id: string;
}

export interface TimerClientHandlers {
  onAck?: (partId: string, title: string) => void;
  onVideoOperation?: (option: TimerSyncOption, title?: string) => void;
  onEnded?: (reason: "room_deleted" | "failed_spectate" | "closed") => void;
  onOpen?: () => void;
}

/** 想定外に切れたら `maxRetries` 回まで再接続する。 */
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

    // error の後には close が来るので、再接続はそちらに任せる。

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
