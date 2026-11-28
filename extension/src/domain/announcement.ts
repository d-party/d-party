/**
 * 運営からのアナウンス（backend `GET /api/v1/announcements` の配信中の行）。
 * × で閉じたものは ID を覚えておき、ポップアップでもサイドバーでも二度と出さない。
 */

export type AnnouncementLevel = "info" | "warning";

export interface Announcement {
  id: number;
  message: string;
  level: AnnouncementLevel;
}

/**
 * 覚えておく「閉じた ID」の上限。配信は期限で終わるので、古いものから忘れても
 * もう一度出ることはない。上限は storage を太らせないためだけのもの。
 */
export const MAX_DISMISSED_ANNOUNCEMENTS = 100;

/**
 * 画面に出す 1 件。閉じていないもののうち、受け取った順（backend は開始が新しい順）の先頭。
 * 出ているものを閉じると、次に新しいものが繰り上がる。無ければ `null`。
 */
export function currentAnnouncement(
  announcements: readonly Announcement[],
  dismissedIds: readonly number[],
): Announcement | null {
  const dismissed = new Set(dismissedIds);
  return announcements.find(({ id }) => !dismissed.has(id)) ?? null;
}

/** `id` を末尾に足す（重複は除き、古いものから上限を超えた分を捨てる）。 */
export function withDismissed(
  dismissedIds: readonly number[],
  id: number,
): number[] {
  return [...dismissedIds.filter((value) => value !== id), id].slice(
    -MAX_DISMISSED_ANNOUNCEMENTS,
  );
}
