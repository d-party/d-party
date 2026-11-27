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

/** リンクを 1 つ含むお知らせ（`[テキスト](https://…)`）。 */
export const SAMPLE_LINK: Announcement = {
  id: 3,
  level: "info",
  message:
    "同時視聴の使い方をまとめました。[マニュアルを見る](https://d-party.net/docs)",
};

/** リンクを 2 つ含む重要なお知らせ。 */
export const SAMPLE_WARNING_LINKS: Announcement = {
  id: 4,
  level: "warning",
  message:
    "12/3 2:00〜6:00 はメンテナンスです。[詳細](https://d-party.net/news/maintenance)・[よくある質問](https://d-party.net/docs#faq)",
};

/** `announcements` をすぐ返す `load`。 */
export function loadOf(
  ...announcements: Announcement[]
): () => Promise<Announcement[]> {
  return () => Promise.resolve(announcements);
}
