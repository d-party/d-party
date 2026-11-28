/** Boundaries of the sync logic. The presentation layer implements them. */

import type {
  IncomingMessage,
  OutgoingMessage,
  PlayerOption,
  SyncOption,
  User,
} from "@/domain/protocol";
import type { ConnectionStatus } from "@/domain/connectionStatus";
import type { HistoryEntryInput } from "@/domain/history";
import type { ReactionType } from "@/domain/reactions";
import type { RoomSettings } from "@/domain/roomSettings";
import type { ReactionDisplayMode, Settings } from "@/domain/settings";

export interface PartySocketHandlers {
  onOpen?: () => void;
  onMessage: (message: IncomingMessage) => void;
  onClose: () => void;
}

/** The party WebSocket. `connect()` again replaces the previous connection. */
export interface PartySocket {
  connect(handlers: PartySocketHandlers): void;
  /** Throws when the socket is closing or closed. */
  send(message: OutgoingMessage): void;
  close(): void;
}

export interface Notifier {
  success(message: string): void;
  info(message: string): void;
  alert(message: string): void;
}

/** 届いた操作の送り主。プレイヤーが「誰の操作か」で扱いを変えるときに見る。 */
export interface ActionSource {
  /** ホストの操作か。`sync_response` はホストからしか来ないので常に true。 */
  fromHost: boolean;
}

/** Controls the service's player (dアニメストア / DMM TV) and reads its state. */
export interface PlayerController {
  getOption(): PlayerOption;
  getTitle(): string;
  onAction(operation: string, option: SyncOption, source?: ActionSource): void;
}

/** Renders the sidebar (share/history/users/control panels). */
export interface SidebarView {
  setShareLink(roomUrl: string): void;
  setJoined(joined: boolean): void;
  setSelfUserId(userId: string): void;
  showSharePanel(): void;
  setConnectionStatus(status: ConnectionStatus): void;
  addHistory(entry: HistoryEntryInput): void;
  updateUserList(users: User[]): void;
  setRoomSettings(settings: RoomSettings): void;
  resetToCreate(): void;
}

export interface ReactionPlayOptions {
  userName?: string;
  mode?: ReactionDisplayMode;
}

/** Plays the on-screen reaction animations. */
export interface ReactionView {
  /** 既定の名前（`fav` など）か、エクストラの Noto コードポイント。 */
  play(id: string, opts?: ReactionPlayOptions): void;
}

export interface SettingsProvider {
  current(): Settings;
}

/** Fire-and-forget; persisted locally, never sent to the backend. */
export interface StatsRecorder {
  roomCreated(): void;
  roomJoined(): void;
  reactionSent(type: ReactionType): void;
  connectionEnded(durationMs: number): void;
}
