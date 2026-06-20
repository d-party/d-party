import type { Metadata } from "next";
import Image from "next/image";
import {
  ChevronDown,
  Download,
  ExternalLink,
  Mail,
  PartyPopper,
  Play,
  Share2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CHROME_WEBSTORE_URL,
  D_ANIME_STORE_URL,
  GOOGLE_CHROME_URL,
} from "@/infrastructure/env";

export const metadata: Metadata = {
  title: "使い方",
  description: "d-party でウォッチパーティーを始めるまでのステップガイド。",
};

type Step = {
  title: string;
  description: React.ReactNode;
  media: React.ReactNode;
};

const STEPS: Step[] = [
  {
    title: "PCにGoogle Chromeをインストール",
    description:
      "まずはd-partyが唯一対応しているブラウザ『Google Chrome』をインストールしてください。Google Chromeの拡張機能は残念ながらスマートフォン版ではまだ利用できません。そのため、PCにGoogle Chromeをインストールしましょう。",
    media: (
      <Button asChild size="lg" variant="secondary">
        <a href={GOOGLE_CHROME_URL} target="_blank" rel="noreferrer noopener">
          <ExternalLink />
          Google Chrome
        </a>
      </Button>
    ),
  },
  {
    title: "dアニメストアを契約",
    description: (
      <>
        もしもまだであれば、dアニメストアのアカウントを作成してください。dアニメストア
        for Prime Video や dアニメストア
        ニコニコ支店では使えません。本家本元の
        <a
          href={D_ANIME_STORE_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary underline-offset-4 hover:underline"
        >
          dアニメストア
        </a>
        のアカウントを作成してサブスクリプションを契約してください。
      </>
    ),
    media: (
      <Image
        src="/logo/d-anime.png"
        alt="dアニメストア"
        width={200}
        height={80}
        className="h-auto w-40"
      />
    ),
  },
  {
    title: "dアニメストアにログイン",
    description:
      "dアニメストアにログインしてください。特に久しぶりの人はログインが切れてしまっていることがあります。念のためトップページからログインできることを確認しましょう。",
    media: (
      <Image
        src="/img/usage/step3-login.png"
        alt="ログイン画面"
        width={320}
        height={200}
        className="h-auto w-full rounded-md border border-border"
      />
    ),
  },
  {
    title: "d-partyをインストール",
    description:
      "Chrome ウェブストアからd-partyをインストールしましょう。インストールはすぐに完了し、再起動なども必要ありません。d-partyのアップデートは自動的に行われます。ちなみにd-partyには『別タブで動画を開く』など、dアニメストアをちょっと便利に使える機能も入っています。",
    media: (
      <Button asChild size="lg">
        <a href={CHROME_WEBSTORE_URL} target="_blank" rel="noreferrer noopener">
          <Download />
          今すぐインストール
        </a>
      </Button>
    ),
  },
  {
    title: "d-partyの設定を行う",
    description:
      "デフォルト設定でも使用可能ですが、d-partyの設定を行いましょう。とりあえず名前だけでも設定しておくと便利かもしれません。この名前はルーム入室時に適用されます。匿名でルームに入りたい場合はそのままにしておきましょう。",
    media: null,
  },
  {
    title: "一緒に視聴したいアニメのページに移動",
    description: (
      <>
        次に、一緒に視聴したいアニメのページに移動します。すると
        <PartyPopper className="mx-1 inline size-4 align-text-bottom" />と
        <Play className="mx-1 inline size-4 align-text-bottom" />
        が各話ごとに表示されているはずです。
        <PartyPopper className="mx-1 inline size-4 align-text-bottom" />
        をクリックしてプレイヤーを別タブで表示しましょう。すると普段のプレイヤーの右横にd-partyのサイドバーが表示されます。
      </>
    ),
    media: (
      <Image
        src="/img/usage/step6-anime-discription.png"
        alt="アニメページ"
        width={320}
        height={200}
        className="h-auto w-full rounded-md border border-border"
      />
    ),
  },
  {
    title: "ルームのリンクを共有する",
    description:
      "ルームを作成すると、サイドバーにルームリンクが生成されます。Discord や X、メールを使って、ルームのリンクを参加者に共有しましょう。このリンクは完全にランダムで生成されており、ルーム内の人がいなくなれば自動的に使えなくなります。そのため、第三者が勝手にルームに参加することはありません。受け取ったユーザーは、リンクをクリックすると自動的にプレイヤーが開かれます（事前にd-partyのインストールが必要です）。",
    media: (
      <div className="flex items-center gap-4 text-muted-foreground">
        <Share2 className="size-7" />
        <Mail className="size-7" />
      </div>
    ),
  },
  {
    title: "みんなでパーティーを楽しみましょう",
    description:
      "全員がルームにそろったら動画の再生を開始してパーティーを楽しみましょう！",
    media: <span className="text-5xl">🎉</span>,
  },
];

export default function UsagePage(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-10 text-center text-3xl font-bold">使い方</h1>

      <ol className="space-y-2">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <div className="grid items-center gap-6 rounded-lg border border-border bg-card p-6 md:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-xl font-semibold">
                  <span className="mr-2 text-primary">{index + 1}.</span>
                  {step.title}
                </h2>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
              {step.media ? (
                <div className="flex justify-center md:justify-end">
                  {step.media}
                </div>
              ) : null}
            </div>
            {index < STEPS.length - 1 ? (
              <div className="flex justify-center py-2 text-muted-foreground">
                <ChevronDown className="size-6" />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
