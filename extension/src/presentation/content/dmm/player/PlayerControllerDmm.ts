import type { ActionGuard } from "@/application/ActionGuard";
import type { ActionSource, PlayerController } from "@/application/ports";
import type { PlayerOption, SyncOption } from "@/domain/protocol";

import { getParam } from "../../dom/utils";

/**
 * DMM TV のオンデマンドプレイヤーを駆動する {@link PlayerController} 実装。
 *
 * dアニメストア（{@link ../../party/PlayerControllerDom}）がネイティブのコントロール
 * class をクリックして操作するのに対し、DMM は主プレイヤーが標準の
 * ``HTMLVideoElement``（`video[aria-label="OnDemandPlayerV2"]`、MSE の blob 再生）
 * なので、**video 要素を直接操作**するのが最も確実。再生/停止・シーク・速度はいずれも
 * 標準 API（play/pause・currentTime・playbackRate）で駆動する。
 *
 * サービス固有なのはこの「プレイヤー駆動」部分だけで、同期のオーケストレーション
 * （{@link RoomSession}）・WS・プロトコルは dアニメと完全共通。
 */

/** 再生ページ。`?season=..&content=..` で再生する話が決まる。 */
export const PLAYBACK_PATH = "/vod/playback/on-demand/";

// 主プレイヤーの安定セレクタ。詳細ページの装飾用 `<video class="hidden">` 等を拾わない
// よう aria-label を第一候補にし、フォールバックで #vodWrapper 配下 → 任意の video。
const VIDEO_SELECTORS = [
  'video[aria-label="OnDemandPlayerV2"]',
  "#vodWrapper video",
  "video",
];

// DMM は Tailwind のユーティリティクラスだけで要素を組んでいて、見た目のクラスは版で変わる。
// 役割の分かる属性（grid-area の名前・id・role）を起点にする。
const TITLE_SELECTORS = {
  // プレイヤー上部のコントローラの話数名（`<div class="grid-area-title …">#7 しゅきぴと…</div>`）。
  // 無ければプレイヤーの下の作品情報の見出し（`<div role="heading">#7 …</div>`）。
  episode: ['[class~="grid-area-title"]', '#detail-header [role="heading"]'],
  // プレイヤーの下の作品情報の 1 行目（`<span class="mr-xs">作品名</span><span>2022年</span>…`）。
  series: ["#detail-header span.mr-xs"],
};

/** Chrome が受け付ける playbackRate の上限。 */
const MAX_PLAYBACK_RATE = 16;

/** `season/content`（どちらも英数字の id）。他の参加者から届く値なので、形を確かめてから URL に使う。 */
const PART_ID_PATTERN = /^[\w-]+(?:\/[\w-]+)?$/;

export function findDmmVideo(): HTMLVideoElement | null {
  for (const selector of VIDEO_SELECTORS) {
    const el = document.querySelector<HTMLVideoElement>(selector);
    if (el) return el;
  }
  return null;
}

/**
 * DMM のエピソード識別子。再生ページ URL は `?season=..&content=..` の**両方**で
 * 再生対象が決まるため、part_id には `season/content` をまとめて載せる（join 時に
 * バックエンドがこれを分解して再生ページの URL を復元する）。season が無ければ content のみ。
 */
export function dmmPartId(): string {
  const season = getParam("season");
  const content = getParam("content") ?? "";
  return season ? `${season}/${content}` : content;
}

/** `season/content` の part_id から再生ページの URL を組む。`extra` はクエリに足す。 */
export function playbackUrl(
  partId: string,
  extra: Record<string, string> = {},
): string {
  const slash = partId.indexOf("/");
  const season = slash >= 0 ? partId.slice(0, slash) : "";
  const content = slash >= 0 ? partId.slice(slash + 1) : partId;
  const url = new URL(PLAYBACK_PATH, window.location.origin);
  if (season) url.searchParams.set("season", season);
  if (content) url.searchParams.set("content", content);
  for (const [key, value] of Object.entries(extra)) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

/**
 * 「作品名 - 話数名」。dアニメストアの「作品名 - 話数 - サブタイトル」に合わせる。
 * DOM から取れなければ document.title（`話数名 | 作品名 (アニメ/2022年)｜…DMM TV`）から組む。
 */
export function dmmEpisodeTitle(): string {
  const episode = firstText(TITLE_SELECTORS.episode);
  const series = firstText(TITLE_SELECTORS.series);
  if (series && episode) return `${series} - ${episode}`;
  return titleFromDocument() || series || episode;
}

function firstText(selectors: readonly string[]): string {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function titleFromDocument(): string {
  // 全角の「｜」より後ろはサイト名。前半は「話数名 | 作品名 (アニメ/2022年)」。
  const main = document.title.split("｜")[0] ?? "";
  const [episode = "", series = ""] = main.split(" | ").map((s) => s.trim());
  if (!episode) return "";
  if (!series) return episode;
  return `${series.replace(/\s*\([^()]*\)\s*$/, "")} - ${episode}`;
}

export interface PlayerControllerDmmDeps {
  guard: ActionGuard;
  /** 今いるルームの id。別の話へ追従するときの URL に付ける。入室していなければ null。 */
  roomId: () => string | null;
}

export class PlayerControllerDmm implements PlayerController {
  // 別の話へ移り始めたら、ページが切り替わるまで届く操作を無視する。
  private following = false;

  constructor(private readonly deps: PlayerControllerDmmDeps) {}

  private video(): HTMLVideoElement | null {
    return findDmmVideo();
  }

  getOption(): PlayerOption {
    const v = this.video();
    return {
      time: v?.currentTime ?? 0,
      src: v?.currentSrc ?? v?.getAttribute("src") ?? null,
      paused: v?.paused ?? true,
      rate: v?.playbackRate ?? 1,
      // DMM は `season/content` でエピソードを識別する（join 復元のため両方を載せる）。
      part_id: dmmPartId(),
    };
  }

  getTitle(): string {
    return `${dmmEpisodeTitle() || document.title} | DMM TV`;
  }

  onAction(operation: string, option: SyncOption, source?: ActionSource): void {
    if (this.following) return;
    // 別の話の操作は自分のプレイヤーには当てない。ホストのものならその話へ移る。
    if (this.isOtherEpisode(option)) {
      if (source?.fromHost) this.followEpisode(option.part_id);
      return;
    }
    switch (operation) {
      case "playing":
        this.play();
        break;
      case "pause":
        this.pause();
        break;
      case "seek":
        this.seek(option);
        break;
      case "ratechange":
        this.changeRate(option);
        break;
      case "sync":
        this.onSync(option);
        break;
      // next/prev（話の切り替え）はホストの操作に載る part_id の変化として届き、
      // followEpisode が扱う。
    }
  }

  private isOtherEpisode(option: SyncOption): boolean {
    const partId = option.part_id;
    return (
      typeof partId === "string" &&
      PART_ID_PATTERN.test(partId) &&
      partId !== dmmPartId()
    );
  }

  /**
   * ホストが別の話を再生しているので、その話の再生ページへ移って入り直す。
   *
   * DMM の話の切り替え（「次のエピソード」・エピソード選択）は SPA の遷移で、ホストの
   * content script は生き続け、以後の操作は新しい `season/content` を part_id に載せて届く。
   * dアニメストアでは `next` でゲストのプレイヤーも次の話へ進むので、それに当たる追従を
   * ページ遷移で行う（`party=join&room_id=` 付きで開くと、読み込み後に自動で入り直す）。
   * ゲストの操作には追従しない（ホスト以外は自分の話を変えても他の人を動かさない）。
   */
  private followEpisode(partId: string): void {
    const roomId = this.deps.roomId();
    if (!roomId) return;
    this.following = true;
    window.location.href = playbackUrl(partId, {
      party: "join",
      room_id: roomId,
    });
  }

  onSync(option: SyncOption): void {
    const v = this.video();
    if (!v) return;
    // drift が小さいときに毎回 seek すると音飛び・ジッタの原因になるので、0.5s 以上
    // ズレているときだけ seek する。レートと再生/停止状態は常に合わせる。
    if (Math.abs(v.currentTime - option.time) > 0.5) {
      this.seek(option);
    }
    this.deps.guard.suppress();
    this.changeRate(option);
    this.deps.guard.suppress();
    if (option.paused === "False") {
      this.play();
    } else {
      this.pause();
    }
  }

  private play(): void {
    const v = this.video();
    if (!v || !v.paused) return;
    this.deps.guard.suppress();
    // MSE/自動再生ポリシーで reject されることがあるため握りつぶす（ユーザーは
    // create/join 時点で操作済みなので通常は許可される）。
    void v.play().catch(() => {});
  }

  private pause(): void {
    const v = this.video();
    if (!v || v.paused) return;
    this.deps.guard.suppress();
    v.pause();
  }

  private seek(option: SyncOption): void {
    const v = this.video();
    // 他の参加者から届いた値。有限でない値を currentTime に入れると例外になる。
    if (!v || !Number.isFinite(option.time)) return;
    this.deps.guard.suppress();
    v.currentTime = option.time;
  }

  private changeRate(option: SyncOption): void {
    const v = this.video();
    if (!v) return;
    const rate = Number(option.rate);
    // 範囲外の値を playbackRate に入れると例外になる。
    if (!(rate > 0 && rate <= MAX_PLAYBACK_RATE)) return;
    if (v.playbackRate !== rate) {
      v.playbackRate = rate;
    }
  }
}
