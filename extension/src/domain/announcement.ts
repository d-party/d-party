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

/** 閉じていないものだけを、受け取った順のまま返す。 */
export function undismissed(
  announcements: readonly Announcement[],
  dismissedIds: readonly number[],
): Announcement[] {
  const dismissed = new Set(dismissedIds);
  return announcements.filter(({ id }) => !dismissed.has(id));
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
