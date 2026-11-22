import { Lottie } from "lottie-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { ReactionIcon } from "@/components/reactionIcons";
import { EXTRA_REACTIONS } from "@/domain/extraReactions";
import { DEFAULT_REACTIONS } from "@/domain/reactions";

import { EXTRA_ANIMATIONS } from "./extraAnimations";
import cryData from "./lottie/cry.json";
import favData from "./lottie/fav.json";
import middleFingerData from "./lottie/middle_finger.json";
import smileData from "./lottie/smile.json";
import thumbsUpData from "./lottie/thumbs_up.json";
import type { ReactionEntry, ReactionStore } from "./reactionStore";

/** id → Lottie。既定 5 種（リアクション名）とエクストラ（Noto コードポイント）。 */
const ANIMATIONS: Readonly<Record<string, object>> = {
  fav: favData,
  middle_finger: middleFingerData,
  thumbs_up: thumbsUpData,
  smile: smileData,
  cry: cryData,
  ...EXTRA_ANIMATIONS,
};

/** id → react-icons キー。バッジ表示で使う。 */
const REACT_ICON_BY_ID: Readonly<Record<string, string>> = Object.fromEntries(
  [...DEFAULT_REACTIONS, ...EXTRA_REACTIONS].map((r) => [r.id, r.reactIcon]),
);

/** `id` は他の参加者から届く。`constructor` などの継承プロパティを素材と見なさない。 */
export function hasAnimation(id: string): boolean {
  return Object.hasOwn(ANIMATIONS, id);
}

const SIZE_PX = 72;
const LEFT_SIZE_PX = 44;
/** 通常表示: 上昇 → 静止 → フェードアウトの各時間。 */
const RISE_MS = 1500;
const NORMAL_HOLD_MS = 900;
const NORMAL_FADE_MS = 500;
/** 左寄り表示が画面最下部→最上部を上りきるまでの時間。 */
const LEFT_TRAVEL_MS = 5000;
const BADGE_MS = 4000;

interface ItemProps {
  entry: ReactionEntry;
  /** `ReactionStore.remove`。参照が変わらないので effect の依存に置ける。 */
  onDone: (key: number) => void;
}

export function ReactionLayer({ store }: { store: ReactionStore }) {
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot);

  const floating = entries.filter((e) => e.mode !== "badge");
  const badges = entries.filter((e) => e.mode === "badge");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 5,
      }}
    >
      {floating.map((e) =>
        e.mode === "left" ? (
          <LeftItem key={e.key} entry={e} onDone={store.remove} />
        ) : (
          <NormalItem key={e.key} entry={e} onDone={store.remove} />
        ),
      )}

      {/* 右下に積み、新しいものほど下に出す。コントロールバーに重ならないよう少し上げる。 */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 64,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
          maxWidth: "60%",
        }}
      >
        {badges.map((e) => (
          <BadgeItem key={e.key} entry={e} onDone={store.remove} />
        ))}
      </div>
    </div>
  );
}

/** 下から浮上し、最上部で少し止まってからフェードアウトする。 */
function NormalItem({ entry, onDone }: ItemProps) {
  const [bottom, setBottom] = useState(entry.bottomStartPx);
  const [opacity, setOpacity] = useState(1);

  // entry も onDone も変わらないので、タイマーはマウント時に 1 回だけ張られる。
  useEffect(() => {
    const raf = requestAnimationFrame(() => setBottom(entry.bottomEndPx));
    const fade = window.setTimeout(
      () => setOpacity(0),
      RISE_MS + NORMAL_HOLD_MS,
    );
    const done = window.setTimeout(
      () => onDone(entry.key),
      RISE_MS + NORMAL_HOLD_MS + NORMAL_FADE_MS,
    );
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [entry, onDone]);

  return (
    <div
      style={{
        position: "absolute",
        left: `${entry.leftPct}%`,
        bottom: `${bottom}px`,
        width: SIZE_PX,
        height: SIZE_PX,
        transform: "translateX(-50%)",
        opacity,
        transition: `bottom ${RISE_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${NORMAL_FADE_MS}ms ease-out`,
        pointerEvents: "none",
      }}
    >
      <Lottie src={ANIMATIONS[entry.id]} loop={false} autoplay />
    </div>
  );
}

/** 左寄り表示: 左側をゆっくり上りながら左右に揺れる（rAF で毎フレーム更新）。 */
function LeftItem({ entry, onDone }: ItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  // 位置と不透明度は ref で直接書く。JSX の style に置くと、親の再レンダーで
  // 再適用されて全アイコンが最下部に戻る。
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const startedAt = performance.now();
    let raf = 0;
    const apply = (t: number): void => {
      const bottomPct = t * 100; // 最下部 → 最上部
      const x =
        entry.baseLeftPct +
        entry.ampPct * Math.sin(t * entry.cycles * Math.PI * 2 + entry.phase);
      const fadeIn = Math.min(1, t / 0.06);
      const fadeOut = t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1;
      el.style.bottom = `${bottomPct}%`;
      el.style.left = `${x}%`;
      el.style.opacity = String(Math.min(fadeIn, fadeOut));
    };
    apply(0); // 初期位置を paint 前に確定（チラつき防止）。
    const tick = (now: number): void => {
      const t = (now - startedAt) / LEFT_TRAVEL_MS; // 0 → 1
      if (t >= 1) {
        onDone(entry.key);
        return;
      }
      apply(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [entry, onDone]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        width: LEFT_SIZE_PX,
        height: LEFT_SIZE_PX,
        transform: "translateX(-50%)",
        pointerEvents: "none",
      }}
    >
      <Lottie src={ANIMATIONS[entry.id]} loop autoplay />
    </div>
  );
}

/** バッジ表示: 「ユーザー名 : リアクション」を右下に小さく出す。 */
function BadgeItem({ entry, onDone }: ItemProps) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const rafIn = requestAnimationFrame(() => setOpacity(1));
    const fadeOut = window.setTimeout(() => setOpacity(0), BADGE_MS - 400);
    const done = window.setTimeout(() => onDone(entry.key), BADGE_MS);
    return () => {
      cancelAnimationFrame(rafIn);
      clearTimeout(fadeOut);
      clearTimeout(done);
    };
  }, [entry.key, onDone]);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        maxWidth: "100%",
        padding: "4px 8px",
        borderRadius: 8,
        background: "rgba(17, 17, 17, 0.85)",
        color: "#fff",
        fontSize: 12,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
        opacity,
        transition: "opacity 300ms ease",
      }}
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 160,
        }}
      >
        {entry.userName || "ゲスト"}
      </span>
      <span style={{ opacity: 0.6 }}>:</span>
      <span style={{ display: "inline-flex", fontSize: 16 }}>
        <ReactionIcon iconKey={REACT_ICON_BY_ID[entry.id]} />
      </span>
    </div>
  );
}
