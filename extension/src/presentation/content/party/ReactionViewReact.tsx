import { createRoot } from "react-dom/client";

import type { ReactionPlayOptions, ReactionView } from "@/application/ports";

import { ReactionLayer, hasAnimation } from "./react/reactions/ReactionLayer";
import { ReactionStore } from "./react/reactions/reactionStore";

/** Transparent layer over the player (`.videoWrapper` by default) that plays the Lottie animations. */
export class ReactionViewReact implements ReactionView {
  private readonly store = new ReactionStore();
  private mounted = false;

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

  private ensureMounted(): void {
    if (this.mounted) return;
    const wrapper = this.resolveContainer();
    if (!wrapper) return;
    if (getComputedStyle(wrapper).position === "static") {
      wrapper.style.position = "relative";
    }
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    wrapper.appendChild(host);
    this.mounted = true;
    createRoot(host).render(<ReactionLayer store={this.store} />);
  }
}
