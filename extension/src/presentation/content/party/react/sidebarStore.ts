import type { SidebarView } from "@/application/ports";
import type { ConnectionStatus } from "@/domain/connectionStatus";
import type { HistoryEntryInput } from "@/domain/history";
import type { User } from "@/domain/protocol";
import {
  type RoomSettings,
  DEFAULT_ROOM_SETTINGS,
} from "@/domain/roomSettings";

export type SidebarTab = "share" | "history" | "users" | "control";

export interface HistoryEntry extends HistoryEntryInput {
  id: number;
  time: string;
}

export interface SidebarState {
  /** Hidden outside a party and in fullscreen. */
  visible: boolean;
  collapsed: boolean;
  mode: "create" | "join" | "normal";
  joined: boolean;
  connectionStatus: ConnectionStatus;
  activeTab: SidebarTab;
  shareUrl: string;
  shareTitle: string;
  users: User[];
  selfUserId: string;
  history: HistoryEntry[];
  roomSettings: RoomSettings;
  /** ルーム作成前に選んでいる設定。 */
  draftRoomSettings: RoomSettings;
}

const INITIAL_STATE: SidebarState = {
  visible: false,
  collapsed: false,
  mode: "normal",
  joined: false,
  connectionStatus: "idle",
  activeTab: "share",
  shareUrl: "",
  shareTitle: "",
  users: [],
  selfUserId: "",
  history: [],
  roomSettings: DEFAULT_ROOM_SETTINGS,
  draftRoomSettings: DEFAULT_ROOM_SETTINGS,
};

/** External store read with `useSyncExternalStore`. Snapshots are immutable. */
export class SidebarStore {
  private state: SidebarState = INITIAL_STATE;
  private seq = 0;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SidebarState => this.state;

  private patch(next: Partial<SidebarState>): void {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }

  setMode(mode: SidebarState["mode"]): void {
    this.patch({ mode, visible: mode !== "normal" });
  }
  setJoined(joined: boolean): void {
    this.patch({ joined });
  }
  setConnectionStatus(status: ConnectionStatus): void {
    this.patch({ connectionStatus: status });
  }
  setActiveTab(activeTab: SidebarTab): void {
    this.patch({ activeTab });
  }
  setShareLink(shareUrl: string): void {
    this.patch({ shareUrl });
  }
  setShareTitle(shareTitle: string): void {
    this.patch({ shareTitle });
  }
  updateUsers(users: User[]): void {
    this.patch({ users });
  }
  setSelfUserId(selfUserId: string): void {
    this.patch({ selfUserId });
  }
  setRoomSettings(roomSettings: RoomSettings): void {
    this.patch({ roomSettings });
  }
  setDraftRoomSettings(draftRoomSettings: RoomSettings): void {
    this.patch({ draftRoomSettings });
  }
  show(): void {
    this.patch({ visible: true });
  }
  hide(): void {
    this.patch({ visible: false });
  }
  setCollapsed(collapsed: boolean): void {
    this.patch({ collapsed });
  }
  toggleCollapsed(): void {
    this.patch({ collapsed: !this.state.collapsed });
  }
  resetToCreate(): void {
    this.patch({
      mode: "create",
      visible: true,
      joined: false,
      connectionStatus: "idle",
      activeTab: "share",
      shareUrl: "",
      users: [],
      selfUserId: "",
      history: [],
      roomSettings: DEFAULT_ROOM_SETTINGS,
      draftRoomSettings: DEFAULT_ROOM_SETTINGS,
    });
  }

  addHistory(entry: HistoryEntryInput): void {
    this.patch({
      history: [
        ...this.state.history,
        { ...entry, id: ++this.seq, time: formatTime() },
      ],
    });
  }
}

export class SidebarController implements SidebarView {
  constructor(private readonly store: SidebarStore) {}

  setShareLink(roomUrl: string): void {
    this.store.setShareLink(roomUrl);
  }
  setJoined(joined: boolean): void {
    this.store.setJoined(joined);
  }
  setSelfUserId(userId: string): void {
    this.store.setSelfUserId(userId);
  }
  setConnectionStatus(status: ConnectionStatus): void {
    this.store.setConnectionStatus(status);
  }
  showSharePanel(): void {
    this.store.setActiveTab("share");
  }
  addHistory(entry: HistoryEntryInput): void {
    this.store.addHistory(entry);
  }
  updateUserList(users: User[]): void {
    this.store.updateUsers(users);
  }
  setRoomSettings(settings: RoomSettings): void {
    this.store.setRoomSettings(settings);
  }
  resetToCreate(): void {
    this.store.resetToCreate();
  }
}

function formatTime(): string {
  const now = new Date();
  const pad = (value: number) => ("0" + value).slice(-2);
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
