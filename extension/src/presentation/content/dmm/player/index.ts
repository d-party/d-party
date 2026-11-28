import { ActionGuard } from "@/application/ActionGuard";
import type { SettingsProvider, StatsRecorder } from "@/application/ports";
import { RoomSession } from "@/application/RoomSession";
import { DEFAULT_SETTINGS, type Settings } from "@/domain/settings";
import type { ReactionType } from "@/domain/reactions";
import { ReactNotifier } from "@/infrastructure/notifier/ReactNotifier";
import { ChromePersonalStatsRepository } from "@/infrastructure/storage/ChromePersonalStatsRepository";
import { ChromeStorageSettingsRepository } from "@/infrastructure/storage/ChromeStorageSettingsRepository";
import { DMM_WEBSOCKET_ENDPOINT, dmmLobbyUrl } from "@/infrastructure/env";
import { PartyWebSocketClient } from "@/infrastructure/ws/PartyWebSocketClient";

import { getParam } from "../../dom/utils";
import { mountDmmPartyButton } from "../../dom/dmmPartyButton";
import { mountSidebar } from "../../party/react/mountSidebar";
import { mountPlayerControls } from "../../party/react/PlayerControls";
import { sidebarWidth, type SidebarTab } from "../../party/react/sidebarStore";
import { ReactionViewReact } from "../../party/ReactionViewReact";
import {
  PlayerControllerDmm,
  dmmEpisodeTitle,
  dmmPartId,
  findDmmVideo,
} from "./PlayerControllerDmm";

/**
 * Content script for the DMM TV playback page
 * (`https://tv.dmm.com/vod/playback/on-demand/*`).
 *
 * dアニメストアの `content/party/index.ts` に対応する DMM 版の合成ルート。共通層
 * （{@link RoomSession}・{@link PartyWebSocketClient}・sidebar・reactions・stats・
 * settings）はそのまま再利用し、**サービス固有のプレイヤー駆動だけ**を
 * {@link PlayerControllerDmm} に差し替える。dアニメの `party/index.ts` には手を入れない
 * （実サイトでしか検証できず回帰リスクがあるため、意図的に別ファイルで実装）。
 *
 * DMM は React の SPA で、プレイヤーは後から描かれ、話を切り替えると（「次のエピソード」・
 * エピソード選択）URL と video 要素が置き換わる。content script は再実行されないので、
 * DOM の変化を見張って video のイベント・操作ボタン・サイドバーの配置を付け直す
 * （`syncWithDom`）。ゲストはホストの操作に載る part_id の変化で別の話へ移る
 * （`PlayerControllerDmm.followEpisode`）。
 */

// DMM の実 DOM に依存する箇所はここへ集約（実機での微調整を一箇所で行えるように）。
// 見た目の Tailwind クラスは版で変わるので、役割の分かる属性（name・aria-label・id）を使う。
const SELECTORS = {
  // 操作ボタン（sync + リアクション）を差し込むアンカー候補。先に見つかった要素の
  // セル（`div.group`）が属するコントロールの並び（`div.grid.grid-flow-col`）の末尾へ足す。
  // コントロールバーは video 初期化後に現れる。
  controlAnchors: [
    'button[name="再生・停止を切り替えるボタン"]',
    'button[aria-label="再生・停止を切り替えるボタン"]',
    'button[aria-label="フルスクリーン"]',
  ],
  // プレイヤー全体。video・上下のコントローラ・中央の再生ボタンをすべて含む。
  player: "#vodWrapper",
};

const CONTROLS_HOST_ID = "d-party-player-controls";

// --- settings (kept live) ---------------------------------------------------
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

// --- personal stats (client-only) -------------------------------------------
const statsRepo = new ChromePersonalStatsRepository();
const stats: StatsRecorder = {
  roomCreated: () => void statsRepo.incrementRoomsCreated(),
  roomJoined: () => void statsRepo.incrementRoomsJoined(),
  reactionSent: (type: ReactionType) => void statsRepo.incrementReaction(type),
  connectionEnded: (durationMs: number) =>
    void statsRepo.addConnectionMs(durationMs),
};

// --- composition root -------------------------------------------------------
const getPlayerContainer = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(SELECTORS.player) ??
  findDmmVideo()?.parentElement ??
  null;

const guard = new ActionGuard();
const reactions = new ReactionViewReact(getPlayerContainer);
const player = new PlayerControllerDmm({ guard, roomId: currentRoomId });
const client = new PartyWebSocketClient(DMM_WEBSOCKET_ENDPOINT);

// Mode comes from the URL (?party=create|join).
const partyParam = getParam("party");
const mode: "create" | "join" | "normal" =
  partyParam === "create"
    ? "create"
    : partyParam === "join"
      ? "join"
      : "normal";

const { store: sidebarStore, controller: sidebarController } = mountSidebar({
  onCreateRoom: () => {
    // ボタンは無効化しているが、サーバが応答しない間は念のためここでも止める。
    if (sidebarStore.getSnapshot().connectionStatus === "maintenance") return;
    addControlButtons();
    bindPlayerEvents();
    session.createRoom(
      dmmPartId(),
      shareTitle(),
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
  // DMM のロビーにはタイマー画面（?timer=true）が無いので、タイマーのみの URL は出さない。
  showTimerUrl: false,
});

const notifier = new ReactNotifier(sidebarStore);

const session = new RoomSession({
  client,
  player,
  sidebar: sidebarController,
  reactions,
  notifier,
  settings,
  guard,
  stats,
  // 共有リンクは DMM 用ロビーへ。
  shareLinkFor: dmmLobbyUrl,
});

sidebarStore.setMode(mode);
if (mode === "join") sidebarStore.setJoined(true);

// 通常視聴（normal）では、お気に入り/シェアのアクション行に「パーティー作成」アイコンを
// 出し、クリックでその場で作成サイドバーを開く（?party=create への遷移・リロード不要）。
// setMode("create") は visible も true にするため、これだけで作成パネルが開く。
if (mode === "normal") {
  mountDmmPartyButton({ onClick: () => sidebarStore.setMode("create") });
}

/**
 * 今いるルームの id。ゲストは URL（`?room_id=`）、ホストは共有リンク（`/dmm-tv/lobby/<id>`）
 * から取る。入室前は null。
 */
function currentRoomId(): string | null {
  const fromUrl = getParam("room_id");
  if (fromUrl) return fromUrl;
  const shareUrl = sidebarStore.getSnapshot().shareUrl;
  if (!shareUrl) return null;
  try {
    return new URL(shareUrl).pathname.split("/").filter(Boolean).pop() ?? null;
  } catch {
    return null;
  }
}

// DMM は React SPA でプレイヤーがビューポート基準（w-full / h-dvh / fixed のコントローラ）
// なので DOM は再配置しない。サイドバーは「プレイヤー領域の右横」にだけ並べたいので:
//   1) プレイヤー要素だけ幅を詰めて動画を左へ寄せる（html 全体ではなくプレイヤーだけを
//      詰めるので、動画下の説明・エピソード一覧は全幅のまま影響しない）。padding ではなく
//      width を使うのは、ヘッダー等の overlay が position:absolute; w-full で #vodWrapper の
//      padding box を参照し padding では縮まないため（width なら abspos の overlay も縮む）。
//   2) サイドバー本体を position:absolute でプレイヤーの document 座標に合わせて置く
//      （fixed だとスクロールしても付いてきて下の要素にも被るため、absolute にして
//       プレイヤーの高さぶんだけ表示し、スクロールで一緒に流れて消えるようにする）。
// 固定コントローラ（上部/下部バー）の右寄せだけは CSS（dmm-player.css）が担当する。

// DMM のルート <html> font-size が 16px でないと、Shadow DOM 内 Tailwind v4 の
// rem/spacing 基準がズレて UI が小さくなる（rem・spacing は Shadow DOM でも
// ドキュメントルートの font-size を参照）。host に px 値の CSS 変数を載せて 16px 相当へ
// 固定する（カスタムプロパティは Shadow 境界を越えて継承）。サイドバーとトースト
// 双方のホストに適用する。body には載せない（DMM 自身の Tailwind --spacing を壊さないため）。
const SHADOW_SCALE_VARS: Record<string, string> = {
  "--spacing": "4px", // = 0.25rem@16px。幅/余白/アイコン（size-*）等 spacing スケール
  "--text-xs": "12px",
  "--text-sm": "14px",
  "--text-base": "16px",
  "--text-lg": "18px",
  "--text-xl": "20px",
  "--text-2xl": "24px",
};
const applyShadowScale = (host: HTMLElement): void => {
  for (const [name, value] of Object.entries(SHADOW_SCALE_VARS)) {
    host.style.setProperty(name, value);
  }
};

let sidebarNormalized = false;
const normalizeSidebarScale = (host: HTMLElement): void => {
  if (sidebarNormalized || !host.shadowRoot) return;
  sidebarNormalized = true;
  applyShadowScale(host);
  // 保険としてサイドバー本体（w-80）を width:100% にしてホスト幅を満たす
  // （万一 w-80 が spacing 由来でなく固定 rem でも、ホスト幅に合わせる）。
  const style = document.createElement("style");
  style.textContent = `[class~="w-80"]{width:100%!important;}`;
  host.shadowRoot.appendChild(style);
};

// トーストのホスト（#d-party-toast-host）は初回トースト時に遅延生成されるので、
// body への追加を監視して同じスケール補正を当てる（トーストも Shadow DOM の
// Tailwind なので、未補正だと dアニメより小さく見える）。
const normalizeToastHost = (): void => {
  const toastHost = document.getElementById("d-party-toast-host");
  if (toastHost) applyShadowScale(toastHost);
};
normalizeToastHost();
const toastHostObserver = new MutationObserver(() => {
  if (document.getElementById("d-party-toast-host")) {
    normalizeToastHost();
    toastHostObserver.disconnect();
  }
});
toastHostObserver.observe(document.body, { childList: true });

const layoutDmmSidebar = (): void => {
  const host = document.getElementById("d-party-sidebar-host");
  const playerEl = getPlayerContainer();
  const width = sidebarWidth(sidebarStore.getSnapshot());

  if (!host || !playerEl) return;
  normalizeSidebarScale(host);

  // ホスト幅はサイドバーの本来幅（px 定数）。中身は上の normalize で必ずこの幅を満たす。
  host.style.width = `${width}px`;

  // 1) プレイヤーだけ幅を詰める（border-box）。abspos; w-full のヘッダー overlay も
  //    #vodWrapper の幅を参照するので width なら一緒に縮む（padding だと縮まない）。
  playerEl.style.boxSizing = "border-box";
  if (width > 0) {
    playerEl.style.width = `calc(100% - ${width}px)`;
    playerEl.style.right = "auto"; // abspos で right:0 のときも左寄せを保つ
  } else {
    playerEl.style.width = "";
    playerEl.style.right = "";
  }

  // 2) サイドバーをプレイヤーの document 座標へ absolute で配置（スクロール追従しない）。
  //    left を「詰めたあとのプレイヤーの右端（rect.right）」に合わせる。余白幅もホスト幅も
  //    同じ値から導くので、隙間・はみ出しなく収まる。
  const rect = playerEl.getBoundingClientRect();
  host.style.position = "absolute";
  host.style.top = `${rect.top + window.scrollY}px`;
  host.style.left = `${rect.right + window.scrollX}px`;
  host.style.right = "auto";
  host.style.bottom = "auto";
  host.style.height = `${rect.height || window.innerHeight}px`;
};
layoutDmmSidebar();
sidebarStore.subscribe(layoutDmmSidebar);
window.addEventListener("resize", layoutDmmSidebar);

// --- DOM の変化への追従 -------------------------------------------------------
// video 要素・コントロールバー・プレイヤー全体は後から描かれ、話を切り替えると作り直される。
// 1 つの MutationObserver で見張り、変わっていたらそれぞれ付け直す。

/** これまでに見た主プレイヤーの video。別の要素に変わったら話が切り替わったとみなす。 */
let seenVideo: HTMLVideoElement | null = null;
/** 再生イベントを購読している video。 */
let wiredVideo: HTMLVideoElement | null = null;
/** ルームに入っていて、video が変わっても再生イベントを購読し続けるか。 */
let wireWanted = false;
/** 操作ボタンを出していて、コントロールバーが描き直されても出し直すか。 */
let controlsWanted = false;
/** 大きさの変化を見ているプレイヤー要素。 */
let observedPlayer: HTMLElement | null = null;
// プレイヤーは初期化後にリサイズすることがあるので、サイドバーの配置を追従させる。
const playerResize = new ResizeObserver(layoutDmmSidebar);

function syncWithDom(): void {
  const v = findDmmVideo();
  if (v && v !== seenVideo) onVideo(v, seenVideo === null);

  const playerEl = getPlayerContainer();
  if (playerEl && playerEl !== observedPlayer) {
    if (observedPlayer) playerResize.unobserve(observedPlayer);
    playerResize.observe(playerEl);
    observedPlayer = playerEl;
    layoutDmmSidebar();
  }

  if (controlsWanted && !document.getElementById(CONTROLS_HOST_ID)) {
    mountControls();
  }

  // 話数名は話の切り替えで変わる（video の置き換えより遅れて描かれることがある）。
  const title = shareTitle();
  if (title !== sidebarStore.getSnapshot().shareTitle) {
    sidebarStore.setShareTitle(title);
  }
}

/** 主プレイヤーの video が現れた（`first`）か、別の要素に置き換わった。 */
function onVideo(v: HTMLVideoElement, first: boolean): void {
  seenVideo = v;
  layoutDmmSidebar();
  if (wireWanted) wirePlayerEvents(v);
  if (first && mode === "join") {
    addControlButtons();
    bindPlayerEvents();
    session.joinRoom(getParam("room_id") ?? "");
    armGuestAutoplayCatchUp();
  }
  // create は「ルーム作成」ボタン（onCreateRoom）で発火する。normal は何もしない。
}

syncWithDom();
new MutationObserver(syncWithDom).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// フルスクリーン中はサイドバーを隠す（dアニメと同じ挙動）。
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    sidebarStore.hide();
  } else if (mode !== "normal") {
    sidebarStore.show();
  }
});

/** 作品タイトル（サイドバー共有表示・OGP 用）。取得できなければ document.title。 */
function shareTitle(): string {
  return dmmEpisodeTitle() || document.title;
}

/**
 * 遷移してきたゲスト向けの自動再生ガード対策。
 *
 * ロビーからリダイレクトで来たゲストは、再生ページ上でまだユーザー操作をしていないため、
 * ブラウザの自動再生ポリシーにより join 時 sync の `play()` が拒否される（DMM は中央の
 * 「再生ボタン」を出したまま止まる）＝「一度自分でクリックしないと同期が始まらない」。
 *
 * そこで最初のユーザー操作（どこでもクリック/タップ）を一度だけ拾い、ホストの現在状態へ
 * sync し直す。その操作でブラウザの user activation が付与され、直後の `play()` が通る。
 * ゲスト自身の再生は video_operation "playing" を送るが、受信側の "playing" は `play()` を
 * 呼ぶだけで seek しないため、ホストや他参加者を巻き戻さない（無害）。
 */
function armGuestAutoplayCatchUp(): void {
  const catchUp = (): void => {
    if (session.inRoom) session.requestSync({ manual: false });
  };
  window.addEventListener("pointerdown", catchUp, {
    once: true,
    capture: true,
  });
}

// --- player event wiring ----------------------------------------------------
// DMM の主プレイヤーは標準 HTMLVideoElement なので、ネイティブのメディアイベントを
// そのまま購読して同期する（dアニメのようにコントロール class をフックしない）。
// イベントは要素に付くので、話の切り替えで video が置き換わったら新しい要素へ付け直す。
function bindPlayerEvents(): void {
  wireWanted = true;
  const v = findDmmVideo();
  if (v) wirePlayerEvents(v);
}

function wirePlayerEvents(v: HTMLVideoElement): void {
  if (wiredVideo === v) return;
  wiredVideo = v;

  const active = () => guard.available && session.inRoom;
  // ルームへ操作を通知し（他の参加者へ operation_notification）、自己通知が無効なら
  // 送信者にもトーストを出す（dアニメの announce と同じ）。プレイヤーの sync 自体は
  // sendVideoOperation が担うので、ここでは「通知」だけを担当する。
  const announce = (operation: string) => {
    session.sendActionNotification(operation);
    if (!currentSettings.selfNotification)
      session.notifySentOperation(operation);
  };

  v.addEventListener("playing", () => {
    if (active()) {
      session.sendVideoOperation("playing");
      announce("play");
    }
    guard.allow();
  });
  v.addEventListener("pause", () => {
    if (active() && v.duration !== v.currentTime) {
      session.sendVideoOperation("pause");
      announce("stop");
    }
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
}

/**
 * sync + リアクションのインライン操作ボタンを DMM のコントロールバーへ差し込む。
 * バーは video 初期化後に描かれ、話の切り替えで描き直されるので、`syncWithDom` が
 * 無くなっていれば出し直す。
 */
function addControlButtons(): void {
  controlsWanted = true;
  mountControls();
}

function mountControls(): void {
  const anchor = findControlAnchor();
  if (!anchor) return;
  // DMM: 再生ボタンは `<div class="group relative inline-block">` のセルに入っていて、
  // 再生・10 秒戻し・10 秒送り・音量のセルが `<div class="grid grid-flow-col">` に並ぶ。
  // セルの直前に display:contents で挿すとセルの中で縦積みになるので、いったんセルの前に
  // マウントしてから並びの末尾（音量の右）へ移す。横並びは dmm-player.css がホストを
  // flex にして保つ。
  const cell = anchor.closest("div.group") ?? anchor;
  mountPlayerControls({
    anchor: cell,
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
  const controls = document.getElementById(CONTROLS_HOST_ID);
  const row = cell.parentElement;
  if (controls && row && controls.parentElement === row) {
    row.appendChild(controls);
  }
}

function findControlAnchor(): Element | null {
  for (const selector of SELECTORS.controlAnchors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}
