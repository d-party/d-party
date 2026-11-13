/**
 * WebSocket protocol. Mirrors the backend's `streamer/format.py` and consumer
 * actions; keep both in lock-step. Hand-written because OpenAPI cannot describe it.
 */

export interface User {
  user_id: string;
  user_name: string;
  /** react-icons (Font Awesome 6) のキー。 */
  user_icon?: string;
  is_host?: boolean;
}

/** Player state as reported by the extension (sent to the server). */
export interface PlayerOption {
  time: number;
  src: string | null;
  paused: boolean;
  rate: number;
  part_id: string;
}

/** Player state as received. The backend stringifies `paused` / `rate` (`"True"` / `"False"`). */
export interface SyncOption {
  time: number;
  src: string | null;
  paused: string;
  rate: string;
  part_id: string;
}

// Outgoing (client -> server). Each carries a `request_id`. The server knows the
// sender from the connection, so messages do not repeat the user.

export interface CreateRoomMessage {
  action: "create";
  user_name: string;
  user_icon: string;
  part_id: string;
  /** OGP 用の作品名。作成時に一度だけ送る。 */
  title: string;
  request_id: number;
}

export interface JoinRoomMessage {
  action: "join";
  user_name: string;
  user_icon: string;
  room_id: string;
  request_id: number;
}

export interface VideoOperationMessage {
  action: "video_operation";
  operation: string;
  option: PlayerOption;
  /** タイマー画面がエピソードの切り替えに追従するために毎回送る。 */
  title?: string;
  request_id: number;
}

export interface SyncRequestMessage {
  action: "sync_request";
  request_id: number;
}

export interface SyncResponseMessage {
  action: "sync_response";
  to_user: User;
  option: PlayerOption;
  request_id: number;
}

export interface OperationNotificationMessage {
  action: "operation_notification";
  operation: string;
  request_id: number;
}

export interface LeaveMessage {
  action: "leave";
  request_id: number;
}

export interface UserListRequestMessage {
  action: "user_list";
  request_id: number;
}

/** ホスト以外が送っても無視される。 */
export interface DeleteRoomMessage {
  action: "delete_room";
  request_id: number;
}

export interface ReactionMessage {
  action: "reaction";
  /** デフォルト名（`fav` 等）または エクストラ id（Noto コードポイント）。 */
  reaction_type: string;
  request_id: number;
}

/** ホスト以外が送っても無視される。 */
export interface UpdateSettingMessage {
  action: "update_setting";
  one_way: boolean;
  owner_leave_delete: boolean;
  disable_reaction: boolean;
  request_id: number;
}

export type OutgoingMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | VideoOperationMessage
  | SyncRequestMessage
  | SyncResponseMessage
  | OperationNotificationMessage
  | LeaveMessage
  | UserListRequestMessage
  | DeleteRoomMessage
  | ReactionMessage
  | UpdateSettingMessage;

// Incoming (server -> client).

export interface VideoOperationEvent {
  action: "video_operation";
  room_id: string;
  operation: string;
  user: User;
  option: SyncOption;
  title?: string;
}

export interface CreateEvent {
  action: "create";
  room_id: string;
  user: User;
}

export interface JoinEvent {
  action: "join";
  room_id: string;
  user: User;
}

export interface ServerMessageEvent {
  action: "server_message";
  /** `failed_spectate` はタイマー画面（frontend）にだけ届く。 */
  message_type: "failed_join" | "failed_spectate" | "host_change" | "room_deleted";
}

export interface UserAddEvent {
  action: "user_add";
  user: User;
}

export interface UserListEvent {
  action: "user_list";
  user_list: User[];
}

export interface LeaveEvent {
  action: "leave";
  user: User;
}

export interface SyncRequestEvent {
  action: "sync_request";
  user: User;
}

export interface SyncResponseEvent {
  action: "sync_response";
  option: SyncOption;
}

export interface OperationNotificationEvent {
  action: "operation_notification";
  operation: string;
  user: User;
}

export interface ReactionEvent {
  action: "reaction";
  /** デフォルト名（`fav` 等）または エクストラ id（Noto コードポイント）。 */
  reaction_type: string;
  /** 「ユーザー名 : リアクション」の表示に使う。 */
  user: User;
}

/** create / join のときと、ホストが変えたときに届く。 */
export interface RoomSettingEvent {
  action: "room_setting";
  one_way: boolean;
  owner_leave_delete: boolean;
  disable_reaction: boolean;
}

export type IncomingMessage =
  | VideoOperationEvent
  | CreateEvent
  | JoinEvent
  | ServerMessageEvent
  | UserAddEvent
  | UserListEvent
  | LeaveEvent
  | SyncRequestEvent
  | SyncResponseEvent
  | OperationNotificationEvent
  | ReactionEvent
  | RoomSettingEvent;
