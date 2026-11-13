import type { ActionGuard } from "@/application/ActionGuard";
import type { PlayerController } from "@/application/ports";
import type { PlayerOption, SyncOption } from "@/domain/protocol";

import { getParam } from "../dom/utils";

const video = () => document.getElementById("video") as HTMLVideoElement;
const click = (selector: string) =>
  document.querySelector<HTMLElement>(selector)?.click();

/** 「作品名 - 話数 - サブタイトル」。プレイヤーの戻るボタン横の表示から読む。 */
export function episodeTitle(): string {
  const text = (cls: string) =>
    document.getElementsByClassName(cls)[0]?.textContent ?? "";
  return `${text("backInfoTxt1")} - ${text("backInfoTxt2")} - ${text("backInfoTxt3")}`;
}

const SEEK_TOLERANCE_SECONDS = 0.5;

/** Drives the player by clicking its native controls. */
export class PlayerControllerDom implements PlayerController {
  constructor(private readonly guard: ActionGuard) {}

  getOption(): PlayerOption {
    const v = video();
    return {
      time: v.currentTime,
      src: v.getAttribute("src"),
      paused: v.paused,
      rate: v.playbackRate,
      part_id: getParam("partId") ?? "",
    };
  }

  getTitle(): string {
    return `${episodeTitle()} | dアニメストア`;
  }

  onAction(operation: string, option: SyncOption): void {
    switch (operation) {
      case "playing":
        this.playing();
        break;
      case "pause":
        this.pause();
        break;
      case "prev":
        this.prevButton();
        this.prevThumbnailButton();
        break;
      case "prev_thumbnail":
        this.prevThumbnailButton();
        break;
      case "next":
        this.nextButton();
        break;
      case "next_thumbnail":
        this.nextThumbnailButton();
        break;
      case "back_area":
        this.backArea();
        this.seek(option);
        break;
      case "seek":
        this.seek(option);
        break;
      case "ratechange":
        this.changeRate(option);
        break;
      case "sync":
        this.sync(option);
        break;
    }
  }

  private sync(option: SyncOption): void {
    // 小さなずれで毎回 seek すると音が飛ぶので、0.5 秒以上のときだけ seek する。
    if (Math.abs(video().currentTime - option.time) > SEEK_TOLERANCE_SECONDS) {
      this.seek(option);
    }
    this.guard.suppress();
    this.changeRate(option);
    this.guard.suppress();
    if (option.paused === "False") {
      this.playing();
    } else {
      this.pause();
    }
  }

  private playing(): void {
    if (video().paused) this.backArea();
  }

  private pause(): void {
    if (!video().paused) this.backArea();
  }

  private backArea(): void {
    click(".backArea");
  }

  private seek(option: SyncOption): void {
    this.guard.suppress();
    video().currentTime = option.time;
  }

  private changeRate(option: SyncOption): void {
    const rate = Number(option.rate);
    if (video().playbackRate !== rate) {
      video().playbackRate = rate;
    }
  }

  // prev and prev_thumbnail use the same native control.
  private showPrevThumbnail(): void {
    const popup = document.getElementById("prevPopupIn");
    popup?.classList.remove("hide");
    popup?.classList.add("show");
    document.getElementById("prevThumbButton")?.click();
  }

  private prevButton(): void {
    this.showPrevThumbnail();
  }

  private prevThumbnailButton(): void {
    this.showPrevThumbnail();
  }

  private nextButton(): void {
    click(".nextButton");
  }

  private nextThumbnailButton(): void {
    document.getElementById("nextThumbButton")?.click();
  }
}
