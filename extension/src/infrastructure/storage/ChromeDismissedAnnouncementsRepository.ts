import { withDismissed } from "@/domain/announcement";

/**
 * 閉じたアナウンスの ID（`chrome.storage.local`）。端末ごとの表示状態なので sync には
 * 置かない。ポップアップとサイドバーの content script が同じ値を読み書きする。
 */
const KEY = "dismissedAnnouncementIds";

function parse(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((id): id is number => Number.isInteger(id))
    : [];
}

export class ChromeDismissedAnnouncementsRepository {
  async getAll(): Promise<number[]> {
    const stored = await chrome.storage.local.get(KEY);
    return parse(stored[KEY]);
  }

  async add(id: number): Promise<void> {
    const current = await this.getAll();
    await chrome.storage.local.set({ [KEY]: withDismissed(current, id) });
  }

  /** 別のコンテキスト（ポップアップ ⇔ サイドバー）で閉じたものにも追従する。 */
  onChange(listener: (ids: number[]) => void): () => void {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (KEY in changes) listener(parse(changes[KEY].newValue));
    };
    chrome.storage.local.onChanged.addListener(handler);
    return () => chrome.storage.local.onChanged.removeListener(handler);
  }
}
