/** Sidebar history entries and operation notifications. Icons are keys rendered by the UI. */

/** Who performed the event, from the local user's point of view. */
export type HistoryDirection = "sent" | "received" | "system";

/** Icon key resolved to a concrete lucide icon by the presentation layer. */
export type HistoryIcon =
  | "play"
  | "pause"
  | "next"
  | "skip"
  | "rate"
  | "join"
  | "leave"
  | "sync"
  | "host"
  | "party"
  | "info"
  | "error";

export interface HistoryEntryInput {
  direction: HistoryDirection;
  icon: HistoryIcon;
  /** Plain text, no markup. */
  label: string;
  /** Set for others' operations and join / leave. Also used by the participant filter. */
  user?: string;
  userIcon?: string;
}

export interface OperationMeta {
  icon: HistoryIcon;
  label: string;
}

/** Wire `operation` → icon and label. Null for operations not shown in the UI. */
export function describeOperation(operation: string): OperationMeta | null {
  if (operation.startsWith("ratechange")) {
    const value = operation.slice("ratechange".length);
    return { icon: "rate", label: `×${value} 倍速` };
  }
  switch (operation) {
    case "next":
      return { icon: "next", label: "次のエピソード" };
    case "play":
      return { icon: "play", label: "再生" };
    case "stop":
      return { icon: "pause", label: "停止" };
    case "skip":
      return { icon: "skip", label: "スキップ" };
    default:
      return null;
  }
}
