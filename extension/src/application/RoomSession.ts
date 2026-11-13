import { describeOperation } from "@/domain/history";
import type { IncomingMessage, OutgoingMessage, User } from "@/domain/protocol";
import { isDefaultReaction } from "@/domain/reactions";
import {
  type RoomSettings,
  DEFAULT_ROOM_SETTINGS,
  diffRoomSettings,
  fromWire,
  isDefaultRoomSettings,
} from "@/domain/roomSettings";

import type { ActionGuard } from "./ActionGuard";
import type {
  Notifier,
  PartySocket,
  PlayerController,
  ReactionView,
  SettingsProvider,
  SidebarView,
  StatsRecorder,
} from "./ports";

export interface RoomSessionDeps {
  client: PartySocket;
  /** 共有リンク（ロビー）の URL。 */
  shareLinkFor: (roomId: string) => string;
  player: PlayerController;
  sidebar: SidebarView;
  reactions: ReactionView;
  notifier: Notifier;
  settings: SettingsProvider;
  guard: ActionGuard;
  stats: StatsRecorder;
}

const SERVER_DISCONNECTED = "サーバーとの通信が終了";
const CONNECT_FAILED = "サーバーへの接続に失敗しました";

/**
 * Orchestrates a watch-together session over the party WebSocket. Remote
 * operations are applied under the {@link ActionGuard} so the media events
 * they trigger are not echoed back to the server.
 */
export class RoomSession {
  private readonly deps: RoomSessionDeps;

  private _inRoom = false;
  private joined = false;
  private resetDelayMs = 100;
  // 自分からソケットを閉じたとき、onClose の切断アラートを出さない。
  private intentionalTeardown = false;
  private isHost = false;
  // ホストが再生状態を定期配信してゲストのずれを直す。
  private heartbeatTimer: number | null = null;
  private static readonly HEARTBEAT_MS = 5000;
  // 手動の sync のときだけトーストを出す（join 直後の自動 sync では出さない）。
  private pendingManualSyncToast = false;
  // 接続時間のうち、まだ統計へ足していない区間の開始時刻。
  private connectedAt: number | null = null;
  // タブを閉じると切断ハンドラが走らないことがあるので、定期的に書き出す。
  private connectionCheckpointTimer: number | null = null;
  private static readonly CONNECTION_CHECKPOINT_MS = 60000;

  private roomSettings: RoomSettings = DEFAULT_ROOM_SETTINGS;
  // 入室直後の room_setting は初期値なので、変更として通知しない。
  private roomSettingsInitialized = false;
  // 作成時に選んだ設定。create の応答後に update_setting で送る。
  private pendingSettings: RoomSettings | null = null;
  private lastOneWayNoticeAt = 0;
  private static readonly ONE_WAY_NOTICE_THROTTLE_MS = 3000;
  // 受信した操作を適用すると seek → playing のように複数のメディアイベントが続き、
  // 後続は guard の再開後に届く。この時刻の直後のイベントは自分の操作として扱わない。
  private lastRemoteApplyAt = 0;
  private static readonly REMOTE_APPLY_ECHO_MS = 500;

  constructor(deps: RoomSessionDeps) {
    this.deps = deps;
  }

  get inRoom(): boolean {
    return this._inRoom;
  }

  /** `settings` は create の応答後に `update_setting` で送る（既定値なら送らない）。 */
  createRoom(partId: string, title = "", settings?: RoomSettings): void {
    this._inRoom = true;
    this.joined = false;
    this.resetDelayMs = 100;
    this.roomSettingsInitialized = false;
    this.pendingSettings = settings ?? null;
    this.deps.sidebar.setConnectionStatus("idle");
    this.openSocket(() => {
      this.send({
        action: "create",
        user_name: this.userName,
        user_icon: this.userIcon,
        part_id: partId,
        title,
        request_id: now(),
      });
    });
  }

  /** ホスト以外が送ってもサーバが無視する。 */
  updateSetting(settings: RoomSettings): void {
    this.roomSettings = settings;
    this.send({
      action: "update_setting",
      one_way: settings.oneWay,
      owner_leave_delete: settings.ownerLeaveDelete,
      disable_reaction: settings.disableReaction,
      request_id: now(),
    });
  }

  /** Join an existing room and immediately request a sync to the host. */
  joinRoom(roomId: string): void {
    this._inRoom = true;
    this.joined = false;
    this.resetDelayMs = 200;
    this.roomSettingsInitialized = false;
    this.deps.sidebar.setConnectionStatus("idle");
    this.openSocket(() => {
      this.send({
        action: "join",
        user_name: this.userName,
        user_icon: this.userIcon,
        room_id: roomId,
        request_id: now(),
      });
      this.deps.guard.allow();
    });
  }

  // OPEN 前に send() すると InvalidStateError になるので、最初の送信は onOpen で行う。
  private openSocket(onOpen: () => void): void {
    // 前の接続の close は client が捨てるので、フラグを持ち越さない。
    this.intentionalTeardown = false;
    this.deps.client.connect({
      onOpen,
      onMessage: (message) => this.handleMessage(message),
      onClose: () => {
        if (this.intentionalTeardown) {
          this.intentionalTeardown = false;
          return;
        }
        if (this.joined) {
          this.deps.notifier.alert(SERVER_DISCONNECTED);
        } else if (this._inRoom) {
          this.deps.notifier.alert(CONNECT_FAILED);
          this.deps.sidebar.addHistory({
            direction: "system",
            icon: "error",
            label: CONNECT_FAILED,
          });
        }
        this.resetRoomState();
        this.joined = false;
        this.deps.sidebar.setJoined(false);
        this.deps.sidebar.setConnectionStatus("failed");
      },
    });
  }

  private resetRoomState(): void {
    this.stopHeartbeat();
    this.endConnectionTracking();
    this.isHost = false;
    this._inRoom = false;
    this.roomSettings = DEFAULT_ROOM_SETTINGS;
    this.pendingSettings = null;
  }

  private startConnectionTracking(): void {
    this.connectedAt = now();
    if (this.connectionCheckpointTimer !== null) return;
    this.connectionCheckpointTimer = window.setInterval(() => {
      this.checkpointConnection();
    }, RoomSession.CONNECTION_CHECKPOINT_MS);
  }

  private checkpointConnection(): void {
    if (this.connectedAt === null) return;
    const at = now();
    this.deps.stats.connectionEnded(at - this.connectedAt);
    this.connectedAt = at;
  }

  // connectedAt を null にするので、leave() → onClose で二重に数えない。
  private endConnectionTracking(): void {
    this.checkpointConnection();
    this.connectedAt = null;
    if (this.connectionCheckpointTimer !== null) {
      window.clearInterval(this.connectionCheckpointTimer);
      this.connectionCheckpointTimer = null;
    }
  }

  private get operationBlocked(): boolean {
    return this.roomSettings.oneWay && !this.isHost;
  }

  // seek / ratechange は連続して発火するので間引く。
  private noticeOneWayBlocked(): void {
    const t = now();
    if (t - this.lastOneWayNoticeAt < RoomSession.ONE_WAY_NOTICE_THROTTLE_MS)
      return;
    this.lastOneWayNoticeAt = t;
    this.deps.notifier.alert("一方通行モードでは操作できません");
  }

  sendVideoOperation(operation: string): void {
    // 送らないだけだと手元のプレイヤーがルームからずれるので、ホストへ sync して戻す。
    if (this.operationBlocked) {
      if (now() - this.lastRemoteApplyAt < RoomSession.REMOTE_APPLY_ECHO_MS) {
        return;
      }
      this.noticeOneWayBlocked();
      this.requestSync({ manual: false });
      return;
    }
    this.sendPlayerState(operation);
    this.deps.guard.allow();
  }

  private sendPlayerState(operation: string): void {
    this.send({
      action: "video_operation",
      operation,
      option: this.deps.player.getOption(),
      title: this.deps.player.getTitle(),
      request_id: now(),
    });
  }

  requestSync(opts: { manual?: boolean } = {}): void {
    if (opts.manual ?? true) this.pendingManualSyncToast = true;
    this.send({ action: "sync_request", request_id: now() });
    this.deps.guard.allow();
  }

  private sendSyncResponse(toUser: User): void {
    this.send({
      action: "sync_response",
      to_user: toUser,
      option: this.deps.player.getOption(),
      request_id: now(),
    });
    this.deps.guard.allow();
  }

  sendActionNotification(operation: string): void {
    if (this.operationBlocked) {
      this.noticeOneWayBlocked();
      return;
    }
    this.send({
      action: "operation_notification",
      operation,
      request_id: now(),
    });
  }

  requestUserList(): void {
    this.send({ action: "user_list", request_id: now() });
  }

  /** 自分にも `room_deleted` が届き、そこで UI を戻す。 */
  deleteRoom(): void {
    this.send({ action: "delete_room", request_id: now() });
  }

  sendReaction(reactionId: string): void {
    // 自分の画面には呼び出し側が表示済み。
    if (this.roomSettings.disableReaction) {
      return;
    }
    this.send({
      action: "reaction",
      reaction_type: reactionId,
      request_id: now(),
    });
    if (isDefaultReaction(reactionId)) {
      this.deps.stats.reactionSent(reactionId);
    }
  }

  /** Leave the room (caller is responsible for any UI teardown). */
  leave(): void {
    this.send({ action: "leave", request_id: now() });
    this.resetRoomState();
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer !== null) return;
    this.heartbeatTimer = window.setInterval(() => {
      if (this.isHost && this._inRoom && this.joined) {
        this.sendPlayerState("sync");
      }
    }, RoomSession.HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private send(message: OutgoingMessage): void {
    try {
      if (this._inRoom) this.deps.client.send(message);
    } catch {
      this.deps.notifier.alert(SERVER_DISCONNECTED);
      this.deps.sidebar.addHistory({
        direction: "system",
        icon: "error",
        label: SERVER_DISCONNECTED,
      });
      this._inRoom = false;
    }
  }

  private handleMessage(message: IncomingMessage): void {
    this.dispatch(message);
    window.setTimeout(() => {
      this.deps.guard.allow();
    }, this.resetDelayMs);
  }

  private dispatch(message: IncomingMessage): void {
    const { player, sidebar, reactions, notifier, settings } = this.deps;
    switch (message.action) {
      case "video_operation":
        this.deps.guard.suppress();
        this.lastRemoteApplyAt = now();
        player.onAction(message.operation, message.option);
        break;
      case "create":
        this.enterRoom(message.room_id, message.user);
        this.isHost = true;
        this.deps.stats.roomCreated();
        this.startHeartbeat();
        sidebar.showSharePanel();
        notifier.success("ルームの作成に成功しました");
        sidebar.addHistory({
          direction: "system",
          icon: "party",
          label: "ルームを作成しました",
        });
        if (
          this.pendingSettings &&
          !isDefaultRoomSettings(this.pendingSettings)
        ) {
          this.updateSetting(this.pendingSettings);
        }
        this.pendingSettings = null;
        break;
      case "join":
        this.enterRoom(message.room_id, message.user);
        this.deps.stats.roomJoined();
        notifier.success("ルームに参加");
        // join の応答より前に送ると、サーバでユーザーが未作成のまま処理されて落ちる。
        this.requestSync({ manual: false });
        break;
      case "server_message":
        if (message.message_type === "host_change") {
          this.isHost = true;
          this.startHeartbeat();
          notifier.info("ルームのホスト権限を獲得");
          sidebar.addHistory({
            direction: "system",
            icon: "host",
            label: "ホスト権限を獲得しました",
          });
        } else if (message.message_type === "room_deleted") {
          this.handleRoomDeleted();
        } else if (message.message_type === "failed_join") {
          this.joined = false;
          notifier.alert("ルームに参加できませんでした");
          sidebar.addHistory({
            direction: "system",
            icon: "error",
            label: "ルームに参加できませんでした",
          });
          sidebar.setConnectionStatus("failed");
        }
        break;
      case "user_add":
        notifier.info(`『${message.user.user_name}』さんが参加 🎉`);
        sidebar.addHistory({
          direction: "system",
          icon: "join",
          label: `『${message.user.user_name}』さんが入室`,
          user: message.user.user_name,
          userIcon: message.user.user_icon,
        });
        break;
      case "user_list":
        sidebar.updateUserList(message.user_list);
        break;
      case "leave":
        notifier.info(`『${message.user.user_name}』さんが退室`);
        sidebar.addHistory({
          direction: "system",
          icon: "leave",
          label: `『${message.user.user_name}』さんが退室`,
          user: message.user.user_name,
          userIcon: message.user.user_icon,
        });
        break;
      case "sync_request":
        this.sendSyncResponse(message.user);
        break;
      case "sync_response":
        this.deps.guard.suppress();
        this.lastRemoteApplyAt = now();
        player.onAction("sync", message.option);
        if (this.pendingManualSyncToast) {
          this.pendingManualSyncToast = false;
          this.deps.notifier.info("再生状況をホストにシンク");
          this.deps.sidebar.addHistory({
            direction: "system",
            icon: "sync",
            label: "再生状況をホストにシンクしました",
          });
        }
        break;
      case "operation_notification":
        this.notifyOperation(
          message.operation,
          message.user.user_name,
          message.user.user_icon,
        );
        break;
      case "reaction":
        if (!settings.current().hideReaction) {
          reactions.play(message.reaction_type, {
            userName: message.user.user_name,
            mode: settings.current().reactionDisplay,
          });
        }
        break;
      case "room_setting": {
        const previousSettings = this.roomSettings;
        this.roomSettings = fromWire(message);
        sidebar.setRoomSettings(this.roomSettings);
        // 変えた本人（ホスト）には通知しない。
        if (this.roomSettingsInitialized && !this.isHost) {
          this.notifyRoomSettingChanges(previousSettings, this.roomSettings);
        }
        this.roomSettingsInitialized = true;
        break;
      }
    }
  }

  /** create / join をサーバが受理した。 */
  private enterRoom(roomId: string, self: User): void {
    const { sidebar } = this.deps;
    this.joined = true;
    this.startConnectionTracking();
    sidebar.setSelfUserId(self.user_id);
    sidebar.setShareLink(this.deps.shareLinkFor(roomId));
    sidebar.setJoined(true);
    sidebar.setConnectionStatus("connected");
  }

  private handleRoomDeleted(): void {
    this.intentionalTeardown = true;
    this.joined = false;
    this.resetRoomState();
    this.deps.client.close();
    this.deps.notifier.alert("ルームが削除されました");
    this.deps.sidebar.resetToCreate();
  }

  private notifyOperation(
    operation: string,
    userName: string,
    userIcon?: string,
  ): void {
    const meta = describeOperation(operation);
    if (!meta) return;
    this.deps.notifier.info(`『${userName}』さんが${meta.label}`);
    this.deps.sidebar.addHistory({
      direction: "received",
      icon: meta.icon,
      label: meta.label,
      user: userName,
      userIcon,
    });
  }

  private notifyRoomSettingChanges(
    previous: RoomSettings,
    next: RoomSettings,
  ): void {
    for (const change of diffRoomSettings(previous, next)) {
      const label = `『${change.label}』を${
        change.enabled ? "有効化" : "無効化"
      }しました`;
      this.deps.notifier.info(label);
      this.deps.sidebar.addHistory({
        direction: "system",
        icon: "info",
        label,
      });
    }
  }

  notifySentOperation(operation: string): void {
    if (this.operationBlocked) return;
    const meta = describeOperation(operation);
    if (!meta) return;
    this.deps.notifier.success(meta.label);
    this.deps.sidebar.addHistory({
      direction: "sent",
      icon: meta.icon,
      label: meta.label,
    });
  }

  private get userName(): string {
    return this.deps.settings.current().userName;
  }

  private get userIcon(): string {
    return this.deps.settings.current().userIcon;
  }
}

const now = Date.now;
