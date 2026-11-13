import { ActionGuard } from "@/application/ActionGuard";
import type { SettingsProvider, StatsRecorder } from "@/application/ports";
import { RoomSession } from "@/application/RoomSession";
import { DEFAULT_SETTINGS, type Settings } from "@/domain/settings";
import type { ReactionType } from "@/domain/reactions";
import { ReactNotifier } from "@/infrastructure/notifier/ReactNotifier";
import { ChromePersonalStatsRepository } from "@/infrastructure/storage/ChromePersonalStatsRepository";
import { ChromeStorageSettingsRepository } from "@/infrastructure/storage/ChromeStorageSettingsRepository";
import { WEBSOCKET_ENDPOINT, lobbyUrl } from "@/infrastructure/env";
import { PartyWebSocketClient } from "@/infrastructure/ws/PartyWebSocketClient";

import { getParam, toHttpUrl } from "../dom/utils";
import { PlayerControllerDom, episodeTitle } from "./PlayerControllerDom";
import { mountSidebar } from "./react/mountSidebar";
import { mountPipButton } from "./react/PipButton";
import { mountPlayerControls } from "./react/PlayerControls";
import type { SidebarTab } from "./react/sidebarStore";
import { ReactionViewReact } from "./ReactionViewReact";

/** Player page (sc_d_pc): wires the player and the sidebar to a {@link RoomSession}. */

const video = () => document.getElementById("video") as HTMLVideoElement;
const byClass = (cls: string) =>
  document.getElementsByClassName(cls)[0] as HTMLElement | undefined;

const settingsRepo = new ChromeStorageSettingsRepository();
let currentSettings: Settings = DEFAULT_SETTINGS;
const settings: SettingsProvider = { current: () => currentSettings };

/**
 * Delivers the current value right away (the initial load may still be pending), then changes.
 * 拡張機能を再読み込みした後のページでは読み出しが失敗する。そのときは手元の値のまま続ける。
 */
const subscribeSettings = (cb: (s: Settings) => void): (() => void) => {
  settingsRepo.getAll().then(cb, () => undefined);
  return settingsRepo.onChange(cb);
};
subscribeSettings((s) => (currentSettings = s));

const statsRepo = new ChromePersonalStatsRepository();
const stats: StatsRecorder = {
  roomCreated: () => void statsRepo.incrementRoomsCreated(),
  roomJoined: () => void statsRepo.incrementRoomsJoined(),
  reactionSent: (type: ReactionType) => void statsRepo.incrementReaction(type),
  connectionEnded: (durationMs: number) =>
    void statsRepo.addConnectionMs(durationMs),
};

const guard = new ActionGuard();
const reactions = new ReactionViewReact();
const player = new PlayerControllerDom(guard);
const client = new PartyWebSocketClient(WEBSOCKET_ENDPOINT);

// Mode comes from the URL (?party=create|join).
const partyParam = getParam("party");
const mode =
  partyParam === "create" || partyParam === "join" ? partyParam : "normal";

const PLAY_KEYS = new Set(["Space", "Enter", "NumpadEnter", "KeyK"]);
const SKIP_KEYS = new Set([
  "KeyJ",
  "KeyL",
  "ArrowRight",
  "ArrowLeft",
  ...Array.from({ length: 10 }, (_, n) => [`Digit${n}`, `Numpad${n}`]).flat(),
]);
// シークバーと、送り・戻しの各ボタン。
const SKIP_CONTROL_CLASSES = [
  "seekArea",
  "skipButton",
  "skip10Button",
  "skip30Button",
  "backButton",
  "back10Button",
  "back30Button",
];

const { store: sidebarStore, controller: sidebarController } = mountSidebar({
  onCreateRoom: () => {
    addControlButtons();
    bindPlayerEvents();
    // タイトルは OGP 用。取れなければ空文字。
    session.createRoom(
      getParam("partId") ?? "",
      episodeTitle(),
      sidebarStore.getSnapshot().draftRoomSettings,
    );
  },
  onLeave: () => {
    if (!session.inRoom) return;
    session.leave();
    sidebarStore.hide();
  },
  onDeleteRoom: () => {
    if (!session.inRoom) return;
    session.deleteRoom();
  },
  onUpdateRoomSettings: (roomSettings) => {
    if (!session.inRoom) return;
    session.updateSetting(roomSettings);
  },
  onTabChange: (tab: SidebarTab) => {
    if (tab === "users") session.requestUserList();
  },
});

// Keep toasts over the player, not under the sidebar.
const notifier = new ReactNotifier(sidebarStore);

const session = new RoomSession({
  client,
  shareLinkFor: lobbyUrl,
  player,
  sidebar: sidebarController,
  reactions,
  notifier,
  settings,
  guard,
  stats,
});

sidebarStore.setMode(mode);
if (mode === "join") sidebarStore.setJoined(true);

let playerEventsBound = false;

window.addEventListener("load", () => {
  // join は loadeddata の後でプライミングする。
  if (mode === "create") primePausedOverlay();
  nextPageAnotherTab();
});

mountPipControl();

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    sidebarStore.hide();
  } else if (mode !== "normal") {
    sidebarStore.show();
  }
});

video().addEventListener("loadeddata", () => {
  const title = document.querySelector("title");
  if (title) title.textContent = player.getTitle();
  sidebarStore.setShareTitle(episodeTitle());
});

video().addEventListener(
  "loadeddata",
  () => {
    if (mode !== "join") return;
    addControlButtons();
    bindPlayerEvents();
    // inRoom が false のうちにプライミングし、その再生・停止をルームへ流さない。
    primePausedOverlay(() => session.joinRoom(getParam("room_id") ?? ""));
  },
  { once: true },
);

function bindPlayerEvents(): void {
  if (playerEventsBound) return;
  playerEventsBound = true;
  const v = video();

  const active = () => guard.available && session.inRoom;
  const announce = (operation: string) => {
    session.sendActionNotification(operation);
    if (!currentSettings.selfNotification)
      session.notifySentOperation(operation);
  };

  v.addEventListener("playing", () => {
    v.setAttribute("autoplay", "");
    if (active()) session.sendVideoOperation("playing");
    guard.allow();
  });
  v.addEventListener("pause", () => {
    if (active() && v.duration !== v.currentTime)
      session.sendVideoOperation("pause");
    guard.allow();
  });
  v.addEventListener("loadeddata", () => {
    if (active()) session.sendVideoOperation("loaded");
    guard.allow();
  });
  v.addEventListener("seeking", () => {
    if (active()) session.sendVideoOperation("seek");
    guard.allow();
  });
  v.addEventListener("ratechange", () => {
    if (active() && v.playbackRate !== 0)
      session.sendVideoOperation("ratechange");
    guard.allow();
  });

  bindById("nextThumbinner", () => {
    if (active()) {
      session.sendVideoOperation("next_thumbnail");
      announce("next");
    }
  });
  bindClass("nextButton", () => {
    if (active()) {
      session.sendVideoOperation("next");
      announce("next");
    }
  });
  bindClass("prevButton", () => {
    const prevPopup = document.getElementById("prevPopupInReTop");
    if (active() && !prevPopup?.classList.contains("show")) {
      session.sendVideoOperation("prev");
    }
  });
  bindById("prevThumbinner", () => {
    if (active()) session.sendVideoOperation("prev_thumbnail");
  });

  bindClass("backArea", () => {
    if (active()) announce(v.paused ? "stop" : "play");
  });

  for (const cls of SKIP_CONTROL_CLASSES) {
    bindClass(cls, () => {
      if (session.inRoom) announce("skip");
    });
  }

  document.querySelectorAll<HTMLElement>("#speed span").forEach((speed) => {
    speed.onclick = () => {
      if (session.inRoom) announce(`ratechange${speed.dataset.value}`);
    };
  });

  window.addEventListener("keydown", (event) => {
    if (PLAY_KEYS.has(event.code)) {
      if (active()) announce(v.paused ? "stop" : "play");
    } else if (SKIP_KEYS.has(event.code)) {
      if (session.inRoom) announce("skip");
    }
  });
}

/**
 * 同期前の動画を「停止＋中央 ▶」で見せる。
 *
 * ▶ オーバーレイ（#pauseInfo）は「再生中 → 一時停止」の遷移でしか出ないので、
 * ミュートで再生してから .backArea のネイティブ一時停止を通す。
 *
 * pause イベントは非同期に届く。先に `done`（inRoom を true にする）を呼ぶと、
 * この一時停止が自分の操作としてルームへ流れ、ホストまで止まる。だから pause を
 * 観測してから `done` を呼ぶ。再生できないときはそのまま `done` を呼ぶ。
 */
function primePausedOverlay(done?: () => void): void {
  const v = video();
  const wasMuted = v.muted;
  v.muted = true;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    v.muted = wasMuted;
    done?.();
  };
  const pauseNow = () => {
    if (v.paused) {
      finish();
      return;
    }
    const onPaused = () => {
      v.removeEventListener("pause", onPaused);
      finish();
    };
    v.addEventListener("pause", onPaused);
    byClass("backArea")?.click(); // ネイティブ一時停止 → ▶ を描画
    // pause が来なくても join はする。
    window.setTimeout(finish, 800);
  };
  if (!v.paused) {
    pauseNow();
    return;
  }
  const onPlaying = () => {
    v.removeEventListener("playing", onPlaying);
    pauseNow();
  };
  v.addEventListener("playing", onPlaying);
  void v.play().catch(() => finish());
}

function bindById(id: string, handler: () => void): void {
  const el = document.getElementById(id);
  if (el) el.onclick = handler;
}

function bindClass(cls: string, handler: () => void): void {
  const el = byClass(cls);
  if (el) el.onclick = handler;
}

function addControlButtons(): void {
  const space = document.getElementsByClassName("space")[0];
  if (!space) return;
  mountPlayerControls({
    anchor: space,
    initialSettings: currentSettings,
    subscribe: subscribeSettings,
    handlers: {
      onSync: () => {
        if (guard.available && session.inRoom) session.requestSync();
      },
      onReaction: (type) => {
        if (!session.inRoom) return;
        reactions.play(type, {
          userName: currentSettings.userName,
          mode: currentSettings.reactionDisplay,
        });
        session.sendReaction(type);
      },
    },
  });
}

/** Local only; not sent to the room. */
async function togglePictureInPicture(): Promise<void> {
  const v = video();
  if (!document.pictureInPictureEnabled || v.disablePictureInPicture) {
    notifier.alert(
      "このブラウザ／動画ではピクチャーインピクチャーを利用できません",
    );
    return;
  }
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await v.requestPictureInPicture();
    }
  } catch {
    notifier.alert("ピクチャーインピクチャーの切り替えに失敗しました");
  }
}

/**
 * Left of the native fullscreen button. The control bar is built after the video
 * initializes, so wait for that button.
 */
function mountPipControl(): void {
  const mount = (fullscreenButton: Element): void => {
    mountPipButton({
      fullscreenButton,
      initialSettings: currentSettings,
      subscribe: subscribeSettings,
      onToggle: () => void togglePictureInPicture(),
    });
  };

  // `.fullscreen` is also set on containers in fullscreen mode.
  const findButton = () => document.querySelector(".fullscreen.mainButton");

  const existing = findButton();
  if (existing) {
    mount(existing);
    return;
  }
  const observer = new MutationObserver(() => {
    const el = findButton();
    if (el) {
      observer.disconnect();
      mount(el);
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function nextPageAnotherTab(): void {
  const callback = () => {
    // ページの CSP がインライン script を禁じるので、ページ側のハンドラは外さず
    // onclick を直接差し替える。
    document.querySelectorAll<HTMLElement>(".recommend").forEach((item) => {
      item.onclick = () => {
        // javascript: などを踏まないよう http(s) に限る。
        const raw = item.querySelector("input")?.getAttribute("value");
        const next = raw ? toHttpUrl(raw) : null;
        if (next) window.location.href = next;
      };
    });
  };
  const target = document.querySelector("#swiper-wrapper");
  if (currentSettings.autoAnotherTab && target) {
    new MutationObserver(callback).observe(target, {
      childList: true,
      subtree: true,
    });
  }
}
