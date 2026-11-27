/**
 * 利用マニュアル（frontend /docs）のスクリーンショット用の場面。実物のサイドバー・
 * コントロールバーのボタン・リアクションを、架空のプレイヤーの上に並べる。
 * dアニメストアの実ページは使わない（プレイヤーの見た目は汎用のもの）。
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  MdForward30,
  MdFullscreen,
  MdPause,
  MdPlayArrow,
  MdReplay10,
  MdSkipNext,
  MdSpeed,
  MdVolumeUp,
} from "react-icons/md";

import { DEFAULT_SETTINGS, type ReactionDisplayMode } from "@/domain/settings";
import { mountPipButton } from "@/presentation/content/party/react/PipButton";
import { mountPlayerControls } from "@/presentation/content/party/react/PlayerControls";
import { ReactionLayer } from "@/presentation/content/party/react/reactions/ReactionLayer";
import { ReactionStore } from "@/presentation/content/party/react/reactions/reactionStore";
import { Sidebar } from "@/presentation/content/party/react/Sidebar";
import {
  SidebarStore,
  sidebarWidth,
} from "@/presentation/content/party/react/sidebarStore";
import { Toast, ToastBody, ToastClose, ToastIcon, ToastViewport, type ToastVariant } from "@d-party/ui";

import "../../public/css/player.css";

import {
  EPISODE_LENGTH,
  EPISODE_NO,
  EPISODE_SUB,
  NightCafeArt,
  SAKURA,
  SHARE_TITLE,
  SHARE_URL,
  TAKESHI,
  USERS,
  WORK_TITLE,
  YUUKI,
  atClock,
} from "./fixtures";

type ToastSpec = { variant: ToastVariant; message: string };
type ReactionSpec = { id: string; userName: string; mode: ReactionDisplayMode; delay: number };

const EXTRA = ["2604", "1f44f", "2615"];

function PlayerScene({
  store,
  time,
  playing = false,
  toasts = [],
  reactions = [],
  extControls = true,
}: {
  store: SidebarStore | null;
  time: string;
  playing?: boolean;
  toasts?: ToastSpec[];
  reactions?: ReactionSpec[];
  extControls?: boolean;
}): React.JSX.Element {
  const [emptyStore] = useState(() => new SidebarStore());
  const s = store ?? emptyStore;
  const state = useSyncExternalStore(s.subscribe, s.getSnapshot);
  const width = sidebarWidth(state);
  const spaceRef = useRef<HTMLDivElement>(null);
  const fsRef = useRef<HTMLDivElement>(null);
  const [reactionStore] = useState(() => new ReactionStore());

  useEffect(() => {
    const settings = { ...DEFAULT_SETTINGS, extraReactions: EXTRA };
    const subscribe = (cb: (v: typeof settings) => void) => {
      cb(settings);
      return () => undefined;
    };
    if (extControls && spaceRef.current) {
      mountPlayerControls({
        anchor: spaceRef.current,
        initialSettings: settings,
        subscribe,
        handlers: {
          onSync: () => undefined,
          onReaction: (id) =>
            reactionStore.push({ id, userName: "さくら", mode: "normal" }),
        },
      });
    }
    if (fsRef.current) {
      mountPipButton({
        fullscreenButton: fsRef.current,
        initialSettings: settings,
        subscribe,
        onToggle: () => undefined,
      });
    }
    const timers = reactions.map((r) =>
      window.setTimeout(() => reactionStore.push(r), r.delay),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen w-screen bg-black font-sans">
      <div className="videoWrapper relative min-w-0 flex-1 overflow-hidden">
        <NightCafeArt variant={0} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-5 pb-10 pt-4 text-white">
          <p className="text-xs text-white/70">{WORK_TITLE}</p>
          <p className="text-base font-semibold">
            {EPISODE_NO} {EPISODE_SUB}
          </p>
        </div>
        {!playing && (
          <div className="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white ring-2 ring-white/70">
            <MdPlayArrow className="size-12" />
          </div>
        )}
        <ReactionLayer store={reactionStore} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent pt-10">
          <div className="mx-4 h-1 rounded bg-white/25">
            <div
              className="h-full rounded bg-white/90"
              style={{ width: `${(toSec(time) / toSec(EPISODE_LENGTH)) * 100}%` }}
            />
          </div>
          <div className="flex h-[50px] items-center px-2 text-white/80">
            <Btn>{playing ? <MdPause /> : <MdPlayArrow />}</Btn>
            <Btn>
              <MdReplay10 />
            </Btn>
            <Btn>
              <MdForward30 />
            </Btn>
            <Btn>
              <MdSkipNext />
            </Btn>
            <Btn>
              <MdVolumeUp />
            </Btn>
            <span className="mx-2 font-mono text-xs tabular-nums text-white/80">
              {time} / {EPISODE_LENGTH}
            </span>
            <div ref={spaceRef} className="space flex-1" />
            <Btn>
              <MdSpeed />
            </Btn>
            <div ref={fsRef} className="fullscreen mainButton flex h-[50px] w-[44px] items-center justify-center">
              <MdFullscreen className="size-[26px] text-white/60" />
            </div>
          </div>
        </div>
      </div>
      <div style={{ width, flex: "0 0 auto", height: "100%", overflow: "hidden" }}>
        {store && (
          <Sidebar
            store={store}
            onCreateRoom={() => undefined}
            onLeave={() => undefined}
            onDeleteRoom={() => undefined}
            onUpdateRoomSettings={(v) => store.setRoomSettings(v)}
            onTabChange={() => undefined}
          />
        )}
      </div>
      <ToastViewport style={{ right: `calc(${width}px + 1rem)` }}>
        {toasts.map((t, i) => (
          <Toast key={i} variant={t.variant}>
            <ToastIcon variant={t.variant} />
            <ToastBody>{t.message}</ToastBody>
            <ToastClose />
          </Toast>
        ))}
      </ToastViewport>
    </div>
  );
}

function toSec(t: string): number {
  const [m, sec] = t.split(":").map(Number);
  return m * 60 + sec;
}

function Btn({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-[50px] w-[44px] items-center justify-center [&_svg]:size-6">
      {children}
    </div>
  );
}

const T = (hms: string) => `2026-11-27T${hms}+09:00`;

function hostRoom(): SidebarStore {
  const store = new SidebarStore();
  store.setMode("create");
  store.setJoined(true);
  store.setConnectionStatus("connected");
  store.setShareLink(SHARE_URL);
  store.setShareTitle(SHARE_TITLE);
  store.setSelfUserId(SAKURA.user_id);
  store.updateUsers(USERS);
  return store;
}

function addHostHistory(store: SidebarStore): void {
  atClock(T("21:00:05"), () =>
    store.addHistory({ direction: "system", icon: "party", label: "ルームを作成しました" }),
  );
  atClock(T("21:01:40"), () =>
    store.addHistory({
      direction: "system",
      icon: "join",
      label: "『たけし』さんが入室",
      user: TAKESHI.user_name,
      userIcon: TAKESHI.user_icon,
    }),
  );
  atClock(T("21:02:15"), () =>
    store.addHistory({
      direction: "system",
      icon: "join",
      label: "『ゆうき』さんが入室",
      user: YUUKI.user_name,
      userIcon: YUUKI.user_icon,
    }),
  );
  atClock(T("21:03:02"), () =>
    store.addHistory({ direction: "sent", icon: "play", label: "再生" }),
  );
  atClock(T("21:08:30"), () =>
    store.addHistory({
      direction: "received",
      icon: "pause",
      label: "停止",
      user: TAKESHI.user_name,
      userIcon: TAKESHI.user_icon,
    }),
  );
  atClock(T("21:09:05"), () =>
    store.addHistory({
      direction: "received",
      icon: "play",
      label: "再生",
      user: TAKESHI.user_name,
      userIcon: TAKESHI.user_icon,
    }),
  );
  atClock(T("21:11:47"), () =>
    store.addHistory({
      direction: "received",
      icon: "skip",
      label: "スキップ",
      user: YUUKI.user_name,
      userIcon: YUUKI.user_icon,
    }),
  );
  atClock(T("21:12:20"), () =>
    store.addHistory({
      direction: "received",
      icon: "rate",
      label: "×1.25 倍速",
      user: YUUKI.user_name,
      userIcon: YUUKI.user_icon,
    }),
  );
  atClock(T("21:12:31"), () =>
    store.addHistory({ direction: "sent", icon: "rate", label: "×1 倍速" }),
  );
}

const meta: Meta = {
  title: "Manual/Player",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

/** 作品ページの「パーティールームを作成」から開いた直後。 */
export const Create: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("create");
    store.setShareTitle(SHARE_TITLE);
    return <PlayerScene store={store} time="00:00" extControls={false} />;
  },
};

/** 作成画面の詳細設定（撮影時に詳細設定を開く）。 */
export const CreateSettings: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("create");
    store.setDraftRoomSettings({ oneWay: true, ownerLeaveDelete: false, disableReaction: false });
    return <PlayerScene store={store} time="00:00" extControls={false} />;
  },
};

/** ルームを作成した直後（シェアタブ）。 */
export const Created: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("create");
    store.setJoined(true);
    store.setConnectionStatus("connected");
    store.setShareLink(SHARE_URL);
    store.setShareTitle(SHARE_TITLE);
    store.setSelfUserId(SAKURA.user_id);
    store.updateUsers([SAKURA]);
    atClock(T("21:00:05"), () =>
      store.addHistory({ direction: "system", icon: "party", label: "ルームを作成しました" }),
    );
    return (
      <PlayerScene
        store={store}
        time="00:00"
        toasts={[{ variant: "success", message: "ルームの作成に成功しました" }]}
      />
    );
  },
};

/** 参加者がそろったところ。 */
export const Joined: Story = {
  render: () => {
    const store = hostRoom();
    store.setActiveTab("users");
    return (
      <PlayerScene
        store={store}
        time="00:00"
        toasts={[
          { variant: "info", message: "『たけし』さんが参加 🎉" },
          { variant: "info", message: "『ゆうき』さんが参加 🎉" },
        ]}
      />
    );
  },
};

/** ゲスト（たけし）として招待リンクから参加した直後。 */
export const GuestJoined: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setConnectionStatus("connected");
    store.setShareLink(SHARE_URL);
    store.setShareTitle(SHARE_TITLE);
    store.setSelfUserId(TAKESHI.user_id);
    store.updateUsers([SAKURA, TAKESHI]);
    store.setActiveTab("users");
    return (
      <PlayerScene
        store={store}
        time="00:00"
        toasts={[{ variant: "success", message: "ルームに参加" }]}
      />
    );
  },
};

/** 視聴中: 操作の通知。 */
export const Watching: Story = {
  render: () => {
    const store = hostRoom();
    addHostHistory(store);
    store.setActiveTab("history");
    return (
      <PlayerScene
        store={store}
        time="08:42"
        playing
        toasts={[{ variant: "info", message: "『ゆうき』さんが×1.25 倍速" }]}
      />
    );
  },
};

export const Reactions: Story = {
  render: () => {
    const store = hostRoom();
    addHostHistory(store);
    store.setActiveTab("users");
    return (
      <PlayerScene
        store={store}
        time="08:42"
        playing
        reactions={[
          { id: "smile", userName: "たけし", mode: "normal", delay: 0 },
          { id: "fav", userName: "ゆうき", mode: "normal", delay: 150 },
          { id: "2604", userName: "さくら", mode: "normal", delay: 300 },
          { id: "thumbs_up", userName: "たけし", mode: "normal", delay: 450 },
          { id: "1f44f", userName: "ゆうき", mode: "normal", delay: 600 },
        ]}
      />
    );
  },
};

export const ReactionsBadge: Story = {
  render: () => {
    const store = hostRoom();
    store.setCollapsed(true);
    return (
      <PlayerScene
        store={store}
        time="08:42"
        playing
        reactions={[
          { id: "smile", userName: "たけし", mode: "badge", delay: 0 },
          { id: "fav", userName: "ゆうき", mode: "badge", delay: 100 },
          { id: "2615", userName: "さくら", mode: "badge", delay: 200 },
        ]}
      />
    );
  },
};

export const ReactionsLeft: Story = {
  render: () => {
    const store = hostRoom();
    store.setCollapsed(true);
    return (
      <PlayerScene
        store={store}
        time="08:42"
        playing
        reactions={[
          { id: "smile", userName: "たけし", mode: "left", delay: 0 },
          { id: "fav", userName: "ゆうき", mode: "left", delay: 700 },
          { id: "2604", userName: "さくら", mode: "left", delay: 1400 },
          { id: "thumbs_up", userName: "たけし", mode: "left", delay: 2100 },
        ]}
      />
    );
  },
};

/** サイドバーを縮小した状態。 */
export const Collapsed: Story = {
  render: () => {
    const store = hostRoom();
    store.setCollapsed(true);
    return <PlayerScene store={store} time="08:42" playing />;
  },
};

/** 手動シンク。 */
export const Synced: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setConnectionStatus("connected");
    store.setShareLink(SHARE_URL);
    store.setShareTitle(SHARE_TITLE);
    store.setSelfUserId(TAKESHI.user_id);
    store.updateUsers(USERS);
    atClock(T("21:13:58"), () =>
      store.addHistory({
        direction: "system",
        icon: "sync",
        label: "再生状況をホストにシンクしました",
      }),
    );
    store.setActiveTab("history");
    return (
      <PlayerScene
        store={store}
        time="09:20"
        playing
        toasts={[{ variant: "info", message: "再生状況をホストにシンク" }]}
      />
    );
  },
};

/** 一方通行モードのゲスト（たけし）。 */
export const OneWayGuest: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setJoined(true);
    store.setConnectionStatus("connected");
    store.setShareLink(SHARE_URL);
    store.setShareTitle(SHARE_TITLE);
    store.setSelfUserId(TAKESHI.user_id);
    store.updateUsers(USERS);
    store.setRoomSettings({ oneWay: true, ownerLeaveDelete: false, disableReaction: false });
    store.setActiveTab("control");
    return (
      <PlayerScene
        store={store}
        time="09:20"
        playing
        toasts={[
          { variant: "info", message: "『一方通行モード』を有効化しました" },
          { variant: "alert", message: "一方通行モードでは操作できません" },
        ]}
      />
    );
  },
};

/** オーナーの操作タブ。 */
export const OwnerControl: Story = {
  render: () => {
    const store = hostRoom();
    store.setActiveTab("control");
    return <PlayerScene store={store} time="23:40" />;
  },
};

/** ルームが削除されたあと（作成画面に戻る）。 */
export const Deleted: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.resetToCreate();
    return (
      <PlayerScene
        store={store}
        time="23:40"
        toasts={[{ variant: "alert", message: "ルームが削除されました" }]}
      />
    );
  },
};

/** 接続失敗。 */
export const Failed: Story = {
  render: () => {
    const store = new SidebarStore();
    store.setMode("join");
    store.setConnectionStatus("failed");
    atClock(T("21:30:12"), () =>
      store.addHistory({
        direction: "system",
        icon: "error",
        label: "ルームに参加できませんでした",
      }),
    );
    store.setActiveTab("history");
    return (
      <PlayerScene
        store={store}
        time="00:00"
        toasts={[{ variant: "alert", message: "ルームに参加できませんでした" }]}
      />
    );
  },
};

/** 接続状態バッジ 4 種（ラベルを常に表示）。 */
export const Badges: Story = {
  render: () => (
    <div className="flex flex-col gap-2 bg-neutral-200 p-4 [&_[role=status]>span:last-child]:ml-1.5 [&_[role=status]>span:last-child]:max-w-[8rem] [&_[role=status]>span:last-child]:opacity-100">
      {(["idle", "connected", "failed", "maintenance"] as const).map((status) => (
        <BadgeRow key={status} status={status} />
      ))}
    </div>
  ),
};

function BadgeRow({ status }: { status: "idle" | "connected" | "failed" | "maintenance" }) {
  const store = new SidebarStore();
  store.setMode("join");
  store.setJoined(true);
  store.setConnectionStatus(status);
  if (status === "connected") store.updateUsers(USERS);
  return (
    <div className="badge-row h-[46px] w-80 overflow-hidden">
      <Sidebar
        store={store}
        onCreateRoom={() => undefined}
        onLeave={() => undefined}
        onDeleteRoom={() => undefined}
        onUpdateRoomSettings={() => undefined}
        onTabChange={() => undefined}
      />
    </div>
  );
}
