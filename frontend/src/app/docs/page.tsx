import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

import { DOC_CHAPTERS, docPath } from "@/components/docs/chapters";
import {
  Callout,
  DocFigure,
  DocLink,
  Step,
  Steps,
  Ui,
} from "@/components/docs/DocsContent";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  path: "/docs",
  title: "利用マニュアル",
  description:
    "d-party の詳しい利用マニュアル。拡張機能のインストール、ルームの作り方と招待、サイドバーの見方、再生の同期のしくみ、リアクション、設定、退室、よくあるトラブルまでをスクリーンショットつきで解説します。",
});

export default function DocsIndexPage(): React.JSX.Element {
  return (
    <article className="min-w-0">
      <header className="mb-8 border-b border-border pb-6">
        <p className="text-sm font-medium text-primary">d-party</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">利用マニュアル</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          d-party は、dアニメストアの動画を友だちと「同時に」見るための PC 向けブラウザ拡張機能です。
          このマニュアルでは、インストールからルームの作成・招待、視聴中の画面の見方、困ったときの対処までを順に説明します。
          ざっと流れだけ知りたい場合は{" "}
          <DocLink href="/usage">使い方</DocLink> のページもどうぞ。
        </p>
      </header>

      <DocFigure
        name="player-watching"
        alt="dアニメストアのプレイヤーの右側に d-party のサイドバーが表示され、参加者の操作履歴が並んでいる画面"
        caption="視聴中の画面。プレイヤーの右に d-party のサイドバー、下のコントロールバーにシンクとリアクションのボタンが加わります（画面はイメージです）。"
        priority
      />

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">3 分でわかる流れ</h2>
        <Steps>
          <Step title="拡張機能を入れる">
            <p className="text-muted-foreground">
              PC の Google Chrome か Microsoft Edge に d-party をインストールします。参加する人も全員必要です。
              → <DocLink href={docPath("getting-started")}>はじめる準備</DocLink>
            </p>
          </Step>
          <Step title="ルームを作る">
            <p className="text-muted-foreground">
              dアニメストアの作品ページで、見たい話の <Ui>パーティールームを作成</Ui>{" "}
              ボタンを押し、サイドバーの <Ui>ルームを作成</Ui> を押します。
              → <DocLink href={docPath("create-room")}>ルームを作る</DocLink>
            </p>
          </Step>
          <Step title="リンクを送る">
            <p className="text-muted-foreground">
              サイドバーに出る招待リンクを、LINE や Discord などで友だちに送ります。受け取った人はリンクを開くだけで参加できます。
              → <DocLink href={docPath("invite")}>招待と参加</DocLink>
            </p>
          </Step>
          <Step title="一緒に再生する">
            <p className="text-muted-foreground">
              だれかが再生・一時停止・シークすると、全員のプレイヤーが同じように動きます。
              → <DocLink href={docPath("sync")}>再生の同期</DocLink>
            </p>
          </Step>
        </Steps>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">目次</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {DOC_CHAPTERS.map((chapter, i) => (
            <li key={chapter.slug}>
              <Link
                href={docPath(chapter.slug)}
                className="group flex h-full flex-col gap-1.5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold group-hover:text-primary">
                    <span className="mr-2 text-primary">{i + 1}.</span>
                    {chapter.title}
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {chapter.description}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          プライバシーについて
        </h2>
        <p className="leading-relaxed text-muted-foreground">
          d-party はアカウント登録なしで使えます。ルームを作成・参加すると、ポップアップで設定した表示名とアイコン、見ている作品のタイトルと再生状態（再生 / 一時停止・再生位置・速度）がサーバーを通じてルームの参加者へ送られます。
          dアニメストアのログイン情報や決済情報、動画そのものは送りません。そのほかの設定とポップアップの「統計」はブラウザに保存され、d-party のサーバーには送られません。
        </p>
        <Callout variant="note" title="招待リンクを知っている人について">
          <p>
            招待リンク（とタイマーの URL）を知っている人は、拡張機能がなくてもタイマー画面から作品のタイトルと再生位置を見られます。SNS などで公開するときは、知らない人が参加する可能性があることも覚えておいてください。
          </p>
        </Callout>
        <p className="leading-relaxed text-muted-foreground">
          取得する情報・保存期間・権限の詳細は{" "}
          <DocLink href="/privacy">プライバシーポリシー</DocLink> をご覧ください。
        </p>
      </section>
    </article>
  );
}
