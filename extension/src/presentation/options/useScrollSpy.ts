import { useCallback, useEffect, useRef, useState } from "react";

/** 見出しがビューポートの上からこの割合の線を越えた項目を、表示中とみなす。 */
const ACTIVE_LINE_RATIO = 1 / 3;
/**
 * `scrollend` が届かなかったときに、自分で始めたスクロールの印を外すまでの時間。
 * 長い距離のなめらかなスクロールより長くとる。
 */
const SCROLL_END_FALLBACK_MS = 3000;

export interface ScrollSpy<T extends string> {
  /** いま表示している項目。 */
  active: T;
  /** その項目までスクロールする（メニューを押したとき）。 */
  scrollTo: (id: T) => void;
}

/**
 * ページのスクロール位置から、いま表示している項目（`ids` と同じ id の要素）を決める。
 *
 * - 見出しが上から 1/3 の線を越えた最後の項目を表示中とする。最下部まで来たら最後の項目。
 * - `scrollTo` で移ったときは、押した項目を表示中のままにする。下の方の項目は上端まで
 *   スクロールできず、位置から決めると別の項目になるため。利用者が次にスクロールしたら
 *   位置からの判定に戻す。
 * - 表示中の項目は URL の `#` に持ち、開いたときはその項目までスクロールする。
 *
 * キーボードのフォーカスはスクロールでは動かさない（押したときだけ、移った先へ移す）。
 */
export function useScrollSpy<T extends string>(
  ids: readonly T[],
  { smooth }: { smooth: boolean },
): ScrollSpy<T> {
  const [active, setActive] = useState<T>(() => idFromHash(ids) ?? ids[0]);
  // `scrollTo` で押した項目。利用者が次にスクロールするまで、位置からの判定より優先する。
  const pinned = useRef<T | null>(null);
  // 自分で始めたスクロール（開いたときと `scrollTo`）の行き先の位置。null でなければその最中で、
  // その間の scroll イベントは利用者の操作ではないので `pinned` を外さない。
  const scrollGoal = useRef<number | null>(null);
  const fallback = useRef<number | undefined>(undefined);

  const endOwnScroll = useCallback((): void => {
    scrollGoal.current = null;
    window.clearTimeout(fallback.current);
  }, []);

  /** `target` を上端へスクロールする。位置が変わるなら、終わるまで「自分のスクロール」として扱う。 */
  const scrollToTarget = useCallback(
    (target: HTMLElement, behavior: ScrollBehavior): void => {
      const goal = scrollTopFor(target);
      if (Math.abs(goal - window.scrollY) >= 1) {
        scrollGoal.current = goal;
        window.clearTimeout(fallback.current);
        fallback.current = window.setTimeout(endOwnScroll, SCROLL_END_FALLBACK_MS);
      }
      target.scrollIntoView({ behavior, block: "start" });
    },
    [endOwnScroll],
  );

  useEffect(() => {
    const update = (): void => {
      if (pinned.current === null) setActive(activeFromScroll(ids));
    };
    let frame = 0;
    const onScroll = (): void => {
      const goal = scrollGoal.current;
      if (goal !== null) {
        // 自分のスクロールの途中。行き先に着いたら終わりとする（scrollend の遅れを待たない）。
        if (Math.abs(window.scrollY - goal) < 1) endOwnScroll();
        return;
      }
      pinned.current = null;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    // 利用者が途中で止めたときなど、行き先に着かずに終わったとき。
    const onScrollEnd = endOwnScroll;

    const initialId = idFromHash(ids);
    const initial = initialId && document.getElementById(initialId);
    if (initialId && initial) {
      pinned.current = initialId;
      scrollToTarget(initial, "auto");
    } else {
      update();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", onScrollEnd);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", onScrollEnd);
      window.removeEventListener("resize", update);
    };
  }, [ids, scrollToTarget, endOwnScroll]);

  useEffect(() => {
    if (window.location.hash !== `#${active}`) {
      history.replaceState(null, "", `#${active}`);
    }
  }, [active]);

  const scrollTo = useCallback(
    (id: T): void => {
      const target = document.getElementById(id);
      if (!target) return;
      pinned.current = id;
      setActive(id);
      scrollToTarget(target, smooth ? "smooth" : "auto");
      // 次の Tab が移った先から始まるよう、フォーカスも移す（tabIndex={-1} の要素）。
      target.focus({ preventScroll: true });
    },
    [smooth, scrollToTarget],
  );

  return { active, scrollTo };
}

function idFromHash<T extends string>(ids: readonly T[]): T | undefined {
  const hash = window.location.hash.slice(1);
  return ids.find((id) => id === hash);
}

function activeFromScroll<T extends string>(ids: readonly T[]): T {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll > 1 && window.scrollY >= maxScroll - 1) return ids[ids.length - 1];
  const line = window.innerHeight * ACTIVE_LINE_RATIO;
  let current = ids[0];
  for (const id of ids) {
    const top = document.getElementById(id)?.getBoundingClientRect().top;
    if (top !== undefined && top <= line) current = id;
  }
  return current;
}

/** `scrollIntoView({ block: "start" })` で行き着くスクロール位置（`scroll-margin-top` と最下部を考える）。 */
function scrollTopFor(target: HTMLElement): number {
  const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const top = target.getBoundingClientRect().top + window.scrollY - margin;
  return Math.max(0, Math.min(maxScroll, top));
}
