import type { PartySocket, PartySocketHandlers } from "@/application/ports";
import type { IncomingMessage, OutgoingMessage } from "@/domain/protocol";

/** Typed WebSocket wrapper. `send()` before OPEN is queued and flushed on open. */
export class PartyWebSocketClient implements PartySocket {
  private socket: WebSocket | null = null;
  private outbox: string[] = [];

  constructor(private readonly url: string) {}

  connect(handlers: PartySocketHandlers): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    this.outbox = [];
    // 張り直した後に届く、前のソケットのイベントは捨てる。
    const isCurrent = () => this.socket === socket;

    socket.onopen = () => {
      if (!isCurrent()) return;
      for (const data of this.outbox.splice(0)) socket.send(data);
      handlers.onOpen?.();
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      if (!isCurrent()) return;
      const message = parseMessage(event.data);
      if (message) handlers.onMessage(message);
    };
    socket.onclose = () => {
      if (isCurrent()) handlers.onClose();
    };
  }

  send(message: OutgoingMessage): void {
    const data = JSON.stringify(message);
    const socket = this.socket;
    if (!socket) throw new Error("socket not connected");
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    } else if (socket.readyState === WebSocket.CONNECTING) {
      this.outbox.push(data);
    } else {
      throw new Error(`socket not writable (readyState=${socket.readyState})`);
    }
  }

  close(): void {
    this.socket?.close();
  }
}

/** JSON として読めないフレームや、`action` を持たないものは無視する。 */
function parseMessage(data: string): IncomingMessage | null {
  try {
    const message: unknown = JSON.parse(data);
    return typeof message === "object" && message !== null && "action" in message
      ? (message as IncomingMessage)
      : null;
  } catch {
    return null;
  }
}
