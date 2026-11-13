/**
 * タイマー画面用の WebSocket クライアント。`spectate` を 1 度送り、あとは
 * `video_operation` を受けるだけ。形は backend の `streamer/format.py` に合わせる。
 */

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

/** `video_operation.option` を画面で使う形に直したもの。 */
export interface TimerPlayback {
  /** 秒。 */
  time: number;
  playing: boolean;
  rate: number;
}

export type TimerEndReason = "room_deleted" | "failed_spectate" | "closed";

export interface TimerClientHandlers {
  /** `spectate` が受理された。再接続のたびに呼ばれる。 */
  onAck: (title: string) => void;
  /** `title` は古い拡張機能だと空。 */
  onPlayback: (playback: TimerPlayback, title: string) => void;
  /** 想定外に切れた。このあと再接続する。 */
  onDisconnected: () => void;
  /** これ以上つながない。 */
  onEnded: (reason: TimerEndReason) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMessage(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(data);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toPlayback(option: unknown): TimerPlayback | null {
  if (!isRecord(option)) return null;
  return {
    time: Number(option.time) || 0,
    // pydantic は paused / rate を "True" / "False" / "1.0" の文字列で送る。
    playing: String(option.paused) === "False",
    rate: Number(option.rate) || 1,
  };
}

/** 想定外に切れたら `MAX_RETRIES` 回まで再接続する。 */
export class TimerSpectatorClient {
  private ws: WebSocket | null = null;
  private retries = 0;
  private reconnectTimer: number | null = null;

  constructor(
    private readonly url: string,
    private readonly roomId: string,
    private readonly handlers: TimerClientHandlers,
  ) {}

  connect(): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    // close() や終了のあとに届いた、古いソケットのイベントは捨てる。
    const isCurrent = (): boolean => this.ws === ws;

    ws.addEventListener("open", () => {
      if (!isCurrent()) return;
      ws.send(
        JSON.stringify({
          action: "spectate",
          room_id: this.roomId,
          request_id: Date.now(),
        }),
      );
    });

    ws.addEventListener("message", (event) => {
      if (!isCurrent()) return;
      const msg = parseMessage(event.data);
      if (!msg) return;
      switch (msg.action) {
        case "spectate":
          // open ではなくここで数え直す。accept 直後に切られ続けると再接続が止まらない。
          this.retries = 0;
          this.handlers.onAck(String(msg.title ?? ""));
          break;
        case "video_operation": {
          const playback = toPlayback(msg.option);
          if (playback) {
            this.handlers.onPlayback(playback, String(msg.title ?? ""));
          }
          break;
        }
        case "server_message":
          if (
            msg.message_type === "room_deleted" ||
            msg.message_type === "failed_spectate"
          ) {
            this.close();
            this.handlers.onEnded(msg.message_type);
          }
          break;
      }
    });

    // error の後にも close が来るので、再接続はここだけで扱う。
    ws.addEventListener("close", () => {
      if (!isCurrent()) return;
      this.ws = null;
      if (this.retries >= MAX_RETRIES) {
        this.handlers.onEnded("closed");
        return;
      }
      this.retries += 1;
      this.handlers.onDisconnected();
      this.reconnectTimer = window.setTimeout(
        () => this.connect(),
        RETRY_DELAY_MS,
      );
    });
  }

  close(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}
