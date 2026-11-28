import { type Root, createRoot } from "react-dom/client";

import type { ReactionPlayOptions, ReactionView } from "@/application/ports";

import { ReactionLayer, hasAnimation } from "./react/reactions/ReactionLayer";
import { ReactionStore } from "./react/reactions/reactionStore";

/** Transparent layer over the player (`.videoWrapper` by default) that plays the Lottie animations. */
export class ReactionViewReact implements ReactionView {
  private readonly store = new ReactionStore();
  private host: HTMLElement | null = null;
  private root: Root | null = null;

  /**
   * `resolveContainer` はリアクションを重ねるプレイヤー要素を返す。既定は dアニメの
   * `.videoWrapper`。DMM など別サイトでは異なる要素（例: `#vodWrapper`）を渡す。
   */
  constructor(
    private readonly resolveContainer: () => HTMLElement | null = () =>
      document.querySelector<HTMLElement>(".videoWrapper"),
  ) {}

  play(id: string, opts?: ReactionPlayOptions): void {
    this.ensureMounted();
    if (!hasAnimation(id)) return;
    this.store.push({
      id,
      userName: opts?.userName,
      mode: opts?.mode ?? "normal",
    });
  }

  /**
   * 注入先ごと作り直されることがある（DMM TV は話を切り替えるとプレイヤーを描き直す）。
   * レイヤーがページから外れていたら、今のプレイヤーへ付け直す。
   */
  private ensureMounted(): void {
    if (this.host?.isConnected) return;
    const wrapper = this.resolveContainer();
    if (!wrapper) return;
    this.root?.unmount();
    if (getComputedStyle(wrapper).position === "static") {
      wrapper.style.position = "relative";
    }
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    wrapper.appendChild(host);
    this.host = host;
    this.root = createRoot(host);
    this.root.render(<ReactionLayer store={this.store} />);
  }
}
