import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  loadOf,
  SAMPLE_INFO,
  SAMPLE_LINK,
  SAMPLE_WARNING,
  SAMPLE_WARNING_LINKS,
} from "@/components/announcementSamples";
import type { Announcement } from "@/domain/announcement";
import type { User } from "@/domain/protocol";
import { installChromeMock } from "@/presentation/popup/storybookChromeMock";

import { Sidebar } from "./Sidebar";
import { SidebarStore } from "./sidebarStore";

const SAMPLE_USERS: User[] = [
  { user_id: "1", user_name: "たかし", user_icon: "FaCat", is_host: true },
  { user_id: "2", user_name: "はなこ", user_icon: "FaUserNinja" },
  // user_icon を持たない旧バックエンド互換のユーザー（既定アイコンにフォールバック）。
  { user_id: "3", user_name: "AnonymousUser" },
];

const SAMPLE_URL =
  "http://localhost/anime-store/lobby/4f1c2e9a-1234-4abc-9def-0123456789ab";
const SAMPLE_TITLE = "Dr.STONE SCIENCE FUTURE - 第1話 - RYUSUI VS. SENKU";
const SAMPLE_DMM_URL =
  "http://localhost/dmm-tv/lobby/4f1c2e9a-1234-4abc-9def-0123456789ab";

function frame(
  store: SidebarStore,
  {
    showTimerUrl = true,
    loadAnnouncements,
  }: {
    showTimerUrl?: boolean;
    loadAnnouncements?: () => Promise<Announcement[]>;
  } = {},
) {
  return (
    <div className="flex h-[560px] justify-end bg-neutral-300 p-3">
      <Sidebar
        store={store}
        showTimerUrl={showTimerUrl}
        onCreateRoom={() => store.setJoined(true)}
        onLeave={() => store.hide()}
        onDeleteRoom={() => store.resetToCreate()}
        onUpdateRoomSettings={(settings) => store.setRoomSettings(settings)}
        onTabChange={() => {}}
        loadAnnouncements={loadAnnouncements}
      />
    </div>
  );
}

const meta: Meta<typeof Sidebar> = {
  title: "Party/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj<typeof Sidebar>;

/** Create mode: the "host a room" call to action. */
export const CreateMode: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("create");
    return frame(store);
  },
};

/** Health check failed: the create button is disabled with a tooltip. */
export const CreateModeMaintenance: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("create");
    store.setConnectionStatus("maintenance");
    return frame(store);
  },
};

/** Joined room, share tab with an invite link. */
export const ShareTab: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setConnectionStatus("connected");
    store.setShareLink(SAMPLE_URL);
    store.setShareTitle(SAMPLE_TITLE);
    store.updateUsers(SAMPLE_USERS);
    store.setActiveTab("share");
    return frame(store);
  },
};

/** DMM TV のルームの共有タブ。タイマー画面が無いので「タイマーのみの URL」は出さない。 */
export const ShareTabDmm: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setShareLink(SAMPLE_DMM_URL);
    store.setShareTitle(SAMPLE_TITLE);
    store.updateUsers(SAMPLE_USERS);
    store.setActiveTab("share");
    return frame(store, { showTimerUrl: false });
  },
};

/** History tab with a few events. */
export const HistoryTab: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setConnectionStatus("connected");
    store.updateUsers(SAMPLE_USERS);
    store.addHistory({
      direction: "system",
      icon: "party",
      label: "ルームを作成しました",
    });
    store.addHistory({
      direction: "system",
      icon: "join",
      label: "『たかし』さんが入室",
      user: "たかし",
      userIcon: "FaCat",
    });
    store.addHistory({ direction: "sent", icon: "play", label: "再生" });
    store.addHistory({
      direction: "received",
      icon: "pause",
      label: "停止",
      user: "たかし",
      userIcon: "FaCat",
    });
    store.addHistory({
      direction: "received",
      icon: "rate",
      label: "×1.5 倍速",
      user: "はなこ",
      userIcon: "FaUserNinja",
    });
    store.addHistory({
      direction: "system",
      icon: "sync",
      label: "再生状況をホストにシンクしました",
    });
    store.addHistory({
      direction: "system",
      icon: "join",
      label: "『はなこ』さんが入室",
      user: "はなこ",
      userIcon: "FaUserNinja",
    });
    store.setActiveTab("history");
    return frame(store);
  },
};

/** Participants tab. Self is also the owner, so the "you" + 王冠 badges co-exist. */
export const UsersTab: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setConnectionStatus("connected");
    store.updateUsers(SAMPLE_USERS);
    store.setSelfUserId("1");
    store.setActiveTab("users");
    return frame(store);
  },
};

/** Control tab as a guest: only the leave action is available. */
export const ControlTab: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setConnectionStatus("connected");
    store.updateUsers(SAMPLE_USERS);
    store.setSelfUserId("2");
    store.setActiveTab("control");
    return frame(store);
  },
};

/** Control tab as the owner: the hold-to-delete room action is shown. */
export const OwnerControlTab: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setConnectionStatus("connected");
    store.updateUsers(SAMPLE_USERS);
    store.setSelfUserId("1");
    store.setActiveTab("control");
    return frame(store);
  },
};

/** Collapsed (minimised) handle. */
export const Collapsed: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setConnectionStatus("connected");
    store.setCollapsed(true);
    return frame(store);
  },
};

/** 配信中のアナウンスはヘッダーの下に出す（ルーム作成前）。 */
export const CreateModeWithAnnouncement: Story = {
  render: () => {
    installChromeMock();
    const store = new SidebarStore();
    store.setMode("create");
    return frame(store, { loadAnnouncements: loadOf(SAMPLE_WARNING) });
  },
};

/** 入室後もヘッダーの下に出す。ポップアップで閉じたものはここでも出ない。 */
export const ShareTabWithAnnouncement: Story = {
  render: () => {
    installChromeMock();
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setShareLink(SAMPLE_URL);
    store.setShareTitle(SAMPLE_TITLE);
    store.updateUsers(SAMPLE_USERS);
    store.setActiveTab("share");
    return frame(store, { loadAnnouncements: loadOf(SAMPLE_WARNING) });
  },
};

/** 重要とお知らせが同時に配信されているとき（入室後）。 */
export const ShareTabWithAnnouncements: Story = {
  render: () => {
    installChromeMock();
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setShareLink(SAMPLE_URL);
    store.setShareTitle(SAMPLE_TITLE);
    store.updateUsers(SAMPLE_USERS);
    store.setActiveTab("share");
    return frame(store, {
      loadAnnouncements: loadOf(SAMPLE_WARNING, SAMPLE_INFO),
    });
  },
};

/** DMM TV の再生ページでも、ヘッダーの下に出す（共有タブにタイマーのみの URL は出さない）。 */
export const ShareTabDmmWithAnnouncements: Story = {
  render: () => {
    installChromeMock();
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setShareLink(SAMPLE_DMM_URL);
    store.setShareTitle(SAMPLE_TITLE);
    store.updateUsers(SAMPLE_USERS);
    store.setActiveTab("share");
    return frame(store, {
      showTimerUrl: false,
      loadAnnouncements: loadOf(SAMPLE_WARNING, SAMPLE_INFO),
    });
  },
};

/** 本文のリンク（`[テキスト](https://…)`）。ページの上でも新しいタブで開く。 */
export const ShareTabWithLinkAnnouncements: Story = {
  render: () => {
    installChromeMock();
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setShareLink(SAMPLE_URL);
    store.setShareTitle(SAMPLE_TITLE);
    store.updateUsers(SAMPLE_USERS);
    store.setActiveTab("share");
    return frame(store, {
      loadAnnouncements: loadOf(SAMPLE_WARNING_LINKS, SAMPLE_LINK),
    });
  },
};
