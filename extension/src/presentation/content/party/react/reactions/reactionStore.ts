import type { ReactionDisplayMode } from "@/domain/settings";

export interface ReactionPush {
  id: string;
  userName?: string;
  mode: ReactionDisplayMode;
}

/** 1 回の再生。乱数で決める軌道は追加時に固定し、以後は変えない。 */
export interface ReactionEntry extends ReactionPush {
  key: number;
  /** 通常表示: 開始/終了の bottom(px)、左位置(%)。 */
  leftPct: number;
  bottomStartPx: number;
  bottomEndPx: number;
  /** 左寄り表示: 基準左位置(%)・揺れ振幅(%)・周波数・位相。 */
  baseLeftPct: number;
  ampPct: number;
  cycles: number;
  phase: number;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

/**
 * 再生中のリアクション。`useSyncExternalStore` で読む。レイヤのマウント前に
 * 積まれた分も、最初の描画でそのまま再生される。
 */
export class ReactionStore {
  private entries: readonly ReactionEntry[] = [];
  private seq = 0;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): readonly ReactionEntry[] => this.entries;

  push(reaction: ReactionPush): void {
    const start = 120 + randInt(-30, 30);
    this.entries = [
      ...this.entries,
      {
        ...reaction,
        key: ++this.seq,
        leftPct: randInt(5, 95),
        bottomStartPx: start,
        bottomEndPx: start + 240,
        baseLeftPct: 12 + rand(-3, 3),
        ampPct: rand(1.5, 3),
        cycles: rand(1.5, 2.5),
        phase: rand(0, Math.PI * 2),
      },
    ];
    this.emit();
  }

  remove = (key: number): void => {
    this.entries = this.entries.filter((e) => e.key !== key);
    this.emit();
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
