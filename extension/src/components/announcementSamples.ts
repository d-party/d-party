/** Storybook 用の架空のアナウンス。 */
import type { Announcement } from "@/domain/announcement";

export const SAMPLE_WARNING: Announcement = {
  id: 1,
  level: "warning",
  message: "12/3（水）2:00〜6:00 はメンテナンスのため同時視聴を利用できません",
};

export const SAMPLE_INFO: Announcement = {
  id: 2,
  level: "info",
  message: "リアクションに新しいスタンプを追加しました。設定タブから選べます",
};

/** `announcements` をすぐ返す `load`。 */
export function loadOf(
  ...announcements: Announcement[]
): () => Promise<Announcement[]> {
  return () => Promise.resolve(announcements);
}
