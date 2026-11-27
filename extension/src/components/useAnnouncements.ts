import { useCallback, useEffect, useState } from "react";

import {
  type Announcement,
  undismissed,
  withDismissed,
} from "@/domain/announcement";
import { ChromeDismissedAnnouncementsRepository } from "@/infrastructure/storage/ChromeDismissedAnnouncementsRepository";

const repo = new ChromeDismissedAnnouncementsRepository();

export interface UseAnnouncements {
  /** 閉じていないもの。取得や読み込みが終わるまでは空。 */
  announcements: Announcement[];
  dismiss: (id: number) => void;
}

/**
 * `load` で配信中のアナウンスを 1 度取り、閉じた ID（`chrome.storage.local`）で除く。
 * 別のコンテキスト（ポップアップ ⇔ サイドバー）で閉じたものにも追従する。
 * `load` は失敗しても空の配列で解決する前提（UI を壊さない）。
 */
export function useAnnouncements(
  load: () => Promise<Announcement[]>,
): UseAnnouncements {
  const [all, setAll] = useState<Announcement[]>([]);
  // 読み込むまでは null。閉じたはずのものが一瞬見えないよう、それまで何も出さない。
  const [dismissedIds, setDismissedIds] = useState<readonly number[] | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    load().then(
      (announcements) => {
        if (active) setAll(announcements);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    let active = true;
    const apply = (ids: readonly number[]): void => {
      if (active) setDismissedIds(ids);
    };
    let unsubscribe = (): void => undefined;
    try {
      unsubscribe = repo.onChange(apply);
      // 拡張機能を再読み込みした後の content script では storage が使えない。
      // そのときは閉じた記録が無いものとして出し、× はその場でだけ効く。
      repo.getAll().then(apply, () => apply([]));
    } catch {
      apply([]);
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setDismissedIds((current) => withDismissed(current ?? [], id));
    repo.add(id).catch(() => undefined);
  }, []);

  return {
    announcements: dismissedIds === null ? [] : undismissed(all, dismissedIds),
    dismiss,
  };
}
