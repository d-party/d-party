/** 利用マニュアル（/docs）の章。並びがそのまま目次と「前へ / 次へ」の順になる。 */
export type DocChapter = {
  slug: string;
  title: string;
  /** 目次カードとメタデータの説明。 */
  description: string;
};

export const DOC_CHAPTERS = [
  {
    slug: "getting-started",
    title: "はじめる準備",
    description:
      "対応ブラウザ、dアニメストア・DMM TV の契約、拡張機能のインストール、表示名とアイコンの設定まで。",
  },
  {
    slug: "create-room",
    title: "ルームを作る",
    description:
      "dアニメストア・DMM TV の作品ページのボタンからパーティールームを作成する手順と、作成前に選べる詳細設定。",
  },
  {
    slug: "invite",
    title: "招待と参加",
    description:
      "招待リンクの共有、リンクから参加したときの流れ、拡張機能がない人向けのタイマー画面。",
  },
  {
    slug: "room",
    title: "ルームの画面",
    description:
      "サイドバーの接続状態・参加人数・運営からのお知らせ・各タブ（シェア / 履歴 / 参加者 / 操作）と通知の見方。",
  },
  {
    slug: "sync",
    title: "再生の同期",
    description:
      "どの操作が全員に同期されるか、ホストへのシンク、ホスト権限、一方通行モードのしくみ。",
  },
  {
    slug: "reactions",
    title: "リアクション",
    description:
      "動画の上にリアクションを飛ばす方法、エクストラリアクションの追加、3 種類の表示方法。",
  },
  {
    slug: "settings",
    title: "拡張機能の設定",
    description:
      "ツールバーのポップアップで変えられる設定（ユーザー・同時視聴・ユーティリティ・統計）。",
  },
  {
    slug: "leave",
    title: "退室とルームの終了",
    description:
      "ルームからの退室、オーナーによるルームの削除、ルームが自動的に閉じられる条件。",
  },
  {
    slug: "troubleshooting",
    title: "困ったときは",
    description:
      "サイドバーが出ない、参加できない、再生がずれるなど、よくあるトラブルと対処。",
  },
] as const satisfies readonly DocChapter[];

export type DocSlug = (typeof DOC_CHAPTERS)[number]["slug"];

export const DOCS_PATH = "/docs";

export function docPath(slug: DocSlug): string {
  return `${DOCS_PATH}/${slug}`;
}

export function findChapter(slug: DocSlug): DocChapter & { index: number } {
  const index = DOC_CHAPTERS.findIndex((chapter) => chapter.slug === slug);
  return { ...DOC_CHAPTERS[index], index };
}
