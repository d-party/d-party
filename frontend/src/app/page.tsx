import { Download } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CHROME_WEBSTORE_URL } from "@/infrastructure/env";

/** Landing page — ported from web/templates/index.html. */
export default function HomePage(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 text-center">
      <div className="mx-auto w-2/3 max-w-md">
        <Logo className="h-auto w-full" />
      </div>

      <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
        d-party
      </h1>

      <h2 className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl">
        dアニメストアでもウォッチパーティーができる
        <br />
        完全無料の Google Chrome 向け拡張機能
      </h2>

      <p className="mx-auto mt-6 max-w-2xl text-left leading-relaxed text-foreground/90">
        作品数が豊富なdアニメストアで友達と一緒に同時視聴がしたいと思ったことはありませんか？
        「せーの」なんて掛け声で再生のタイミングを同期していませんでしたか？もうそんな面倒ごとは必要ありません！
        <br />
        『d-party』を使えばルーム参加者のプレイヤーの再生状況を自動的にシンクしてくれます。
        <br />
        途中で動画を止めてトイレに行ったり、ちょっと巻き戻しをして語り合いがもっと簡単になります。
        <br />
        完全無料・広告無しの『d-party』を使ってみてください。
      </p>

      <div className="mt-10">
        <Button asChild size="lg" className="h-12 px-8 text-base">
          <a href={CHROME_WEBSTORE_URL} target="_blank" rel="noreferrer noopener">
            <Download />
            今すぐインストール
          </a>
        </Button>
      </div>
    </section>
  );
}
