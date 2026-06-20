import type { Metadata } from "next";
import Link from "next/link";

import { Faq, type FaqEntry } from "@/components/qa/Faq";
import { D_ANIME_STORE_URL } from "@/infrastructure/env";

export const metadata: Metadata = {
  title: "Q&A",
  description: "d-party のよくある質問と回答。",
};

const ENTRIES: FaqEntry[] = [
  {
    question: "d-party は無料ですか？",
    answer:
      "はい、完全無料・広告なしで使えます。別途必要なのは dアニメストアの月額利用料のみで、d-party に課金はありません。",
  },
  {
    question: "対応しているブラウザは？",
    answer:
      "PC 版の Google Chrome のみ対応しています。スマートフォン版 Chrome やその他のブラウザでは利用できません。",
  },
  {
    question: "dアニメストアの契約は必要ですか？",
    answer: (
      <>
        必要です。本家本元の{" "}
        <a
          href={D_ANIME_STORE_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary underline-offset-4 hover:underline"
        >
          dアニメストア
        </a>
        のアカウントが必要で、「dアニメストア for Prime
        Video」や「dアニメストア ニコニコ支店」では利用できません。
      </>
    ),
  },
  {
    question: "スマートフォンで使えますか？",
    answer:
      "使えません。d-party は Chrome 拡張機能のため、PC の Google Chrome でご利用ください。",
  },
  {
    question: "何人で一緒に視聴できますか？",
    answer:
      "複数人で同じルームに参加して同時視聴できます。ルームリンクを共有した友達と一緒に楽しめます。",
  },
  {
    question: "再生はどのように同期されますか？",
    answer:
      "ルーム参加者のプレイヤーの再生・一時停止・シーク（巻き戻し/早送り）が自動的に同期されます。「せーの」で合わせる必要はありません。",
  },
  {
    question: "ルームのリンクは安全ですか？",
    answer:
      "招待リンクは完全にランダムで生成されます。ルームから人がいなくなれば自動的に無効化され、第三者が勝手に参加することはありません。",
  },
  {
    question: "招待された人もインストールが必要ですか？",
    answer: (
      <>
        必要です。リンクを開くと自動的にプレイヤーが開くため、参加者も事前に d-party
        をインストールしておく必要があります。手順は{" "}
        <Link
          href="/usage"
          className="text-primary underline-offset-4 hover:underline"
        >
          使い方ページ
        </Link>{" "}
        をご覧ください。
      </>
    ),
  },
  {
    question: "アップデートはどうなりますか？",
    answer:
      "インストールはすぐ完了し、再起動は不要です。アップデートも自動的に行われるため、常に最新の状態で利用できます。",
  },
  {
    question: "不具合の報告や要望はどこへ送ればいい？",
    answer: (
      <>
        <a
          href="https://forms.gle/kKPbAPGY96rbaKgK8"
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary underline-offset-4 hover:underline"
        >
          ご意見フォーム
        </a>{" "}
        または{" "}
        <a
          href="https://github.com/d-Party"
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary underline-offset-4 hover:underline"
        >
          GitHub
        </a>{" "}
        までお寄せください。
      </>
    ),
  },
];

export default function QaPage(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Q&amp;A</h1>
        <p className="mt-3 text-muted-foreground">よくある質問と回答</p>
      </header>

      <Faq entries={ENTRIES} />
    </section>
  );
}
