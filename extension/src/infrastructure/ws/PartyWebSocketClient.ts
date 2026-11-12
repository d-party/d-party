import type { IncomingMessage, OutgoingMessage } from "@/domain/protocol";

export interface PartySocketHandlers {
  onMessage: (message: IncomingMessage) => void;
  onClose: (event: CloseEvent) => void;
  onOpen?: (event: Event) => void;
}

/** Typed WebSocket wrapper. `send()` before OPEN is queued and flushed on open. */
export class PartyWebSocketClient {
  private socket: WebSocket | null = null;
  private outbox: string[] = [];

  constructor(private readonly url: string) { }

  connect(handlers: PartySocketHandlers): void {
    const socket = new WebSocket(this.url);
    socket.onmessage = (event: MessageEvent<string>) => {
      handlers.onMessage(JSON.parse(event.data) as IncomingMessage);
    };
    socket.onclose = (event) => handlers.onClose(event);
    socket.onopen = (event) => {
      while (this.outbox.length > 0) {
        const data = this.outbox.shift();
        if (data !== undefined) socket.send(data);
      }
      handlers.onOpen?.(event);
    };
    this.socket = socket;
    // 代入の時点で既に OPEN なら onopen が来ないので、自分で呼ぶ。
    if (socket.readyState === WebSocket.OPEN) {
      window.setTimeout(() => socket.onopen?.(new Event("open")), 0);
    }
  }

  send(message: OutgoingMessage): void {
    const data = JSON.stringify(message);
    const s = this.socket;
    if (!s) throw new Error("socket not connected");
    if (s.readyState === WebSocket.OPEN) {
      s.send(data);
      return;
    }
    if (s.readyState === WebSocket.CONNECTING) {
      this.outbox.push(data);
      return;
    }
    throw new Error(`socket not writable (readyState=${s.readyState})`);
  }

  close(): void {
    this.socket?.close();
  }
}
