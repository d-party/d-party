import type { Metadata } from "next";

import { docPath } from "@/components/docs/chapters";
import {
  Callout,
  DefinitionList,
  DocArticle,
  DocFigure,
  DocLink,
  DocSection,
  Kbd,
  Ui,
} from "@/components/docs/DocsContent";
import { docMetadata } from "@/components/docs/metadata";

export const metadata: Metadata = docMetadata("sync");

export default function SyncPage(): React.JSX.Element {
  return (
    <DocArticle
      slug="sync"
      lead="ルームの中では、だれかがプレイヤーを操作すると全員のプレイヤーが同じように動きます。「せーの」で合わせる必要はありません。ここでは、何が同期されるのか、ずれたときにどう直るのかを説明します。"
    >
      <DocSection id="how" title="同期のしくみ">
        <p>
          d-party が送っているのは動画の映像ではなく、「何秒の位置で再生中か」「速度は何倍か」といったプレイヤーの状態だけです。動画はそれぞれが自分の dアニメストアのアカウントで再生し、d-party のサーバーがその状態をルームの全員へ中継します。
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            ルームを作った人が<strong className="text-foreground">ホスト（オーナー）</strong>です。ホストは 5 秒ごとに自分の再生状況を送り、ほかの参加者のプレイヤーはそれに合わせます。0.5 秒を超えてずれていれば再生位置を合わせ、速度や再生 / 一時停止もそろえます。
          </li>
          <li>
            招待リンクから参加したときは、入った直後に自動でホストの再生状況に合わせます。
          </li>
          <li>
            通信が遅いなどで一時的にずれても、次にホストの再生状況が届いたときに直ります。
          </li>
        </ul>
      </DocSection>

      <DocSection id="synced" title="同期される操作">
        <p>
          ルームの参加者のだれかが次の操作をすると、全員のプレイヤーに反映されます（一方通行モードではオーナーの操作だけ）。
        </p>
        <DefinitionList
          items={[
            {
              term: "再生 / 一時停止",
              description: (
                <>
                  画面のクリックや再生ボタン、キーボードの <Kbd>Space</Kbd>・<Kbd>Enter</Kbd>・<Kbd>K</Kbd>{" "}
                  など、どの方法で操作しても同期されます。
                </>
              ),
            },
            {
              term: "シーク（早送り・巻き戻し）",
              description: (
                <>
                  シークバーのクリック、プレイヤーの送り・戻しのボタン、<Kbd>J</Kbd>・<Kbd>L</Kbd>・
                  <Kbd>←</Kbd>・<Kbd>→</Kbd>・数字キーでの移動が同期されます。
                </>
              ),
            },
            {
              term: "再生速度",
              description: "速度メニューで変えた倍率が全員に反映されます。",
            },
            {
              term: "次の話 / 前の話",
              description:
                "プレイヤーの「次へ」「前へ」のボタンや、再生終了後のサムネイルから話を移ると、全員が同じ話へ移ります。",
            },
          ]}
        />
        <p>
          操作した人以外には「『たけし』さんが停止」「『ゆうき』さんがスキップ」「『ゆうき』さんが×1.25 倍速」「『さくら』さんが次のエピソード」のような通知が出て、サイドバーの{" "}
          <DocLink href={`${docPath("room")}#tabs`}>履歴</DocLink> にも残ります（前の話への移動と、サムネイルからの移動は同期だけされ、通知は出ません）。
        </p>
        <Callout variant="note" title="同期されないもの">
          <p>
            音量や画質、全画面表示、ピクチャーインピクチャー、サイドバーの縮小は、それぞれの画面だけの設定です。
          </p>
        </Callout>
      </DocSection>

      <DocSection id="sync-button" title="シンクボタンで合わせ直す">
        <p>
          ずれが気になるときは、コントロールバーの <Ui>🔄</Ui>{" "}
          （シンク）ボタンを押します。ホストに今の再生状況を問い合わせ、自分のプレイヤーをそれに合わせます。合わせ終わると「再生状況をホストにシンク」と通知され、履歴にも残ります。ホスト自身が押しても何も起きません。
        </p>
        <DocFigure
          name="player-synced"
          alt="シンクボタンを押したあとのプレイヤー。右上に「再生状況をホストにシンク」の通知、履歴のいちばん上に「再生状況をホストにシンクしました」"
          caption="シンクボタンを押したところ（参加者「たけし」さんの画面）"
        />
      </DocSection>

      <DocSection id="host" title="ホスト（オーナー）の権限">
        <p>
          参加者一覧で王冠のマークが付いている人がホストです。ホストだけが次のことをできます。
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>5 秒ごとの再生状況の送信（全員のずれの基準になります）</li>
          <li>
            ルームの詳細設定の変更（
            <DocLink href={`${docPath("create-room")}#settings`}>詳細設定</DocLink>）
          </li>
          <li>
            ルームの削除（<DocLink href={`${docPath("leave")}#delete`}>ルームを削除する</DocLink>）
          </li>
        </ul>
        <p>
          ホストが退室すると、残っている参加者のうちいちばん早く入室した人にホスト権限が引き継がれ、その人に「ルームのホスト権限を獲得」と通知されます。ただし「オーナー退室時にルーム自動削除」がオンのルームでは、ホストの退室と同時にルームが削除されます。
        </p>
      </DocSection>

      <DocSection id="one-way" title="一方通行モード">
        <p>
          ルームの詳細設定で <Ui>一方通行モード</Ui>{" "}
          をオンにすると、動画を操作できるのはオーナーだけになります。オーナー以外が再生・一時停止・シーク・速度変更などをすると「一方通行モードでは操作できません」と表示され、プレイヤーはオーナーの再生状況に戻されます。リアクションは送れます。
        </p>
        <DocFigure
          name="player-one-way-guest"
          alt="一方通行モードのルームの参加者の画面。右上に「『一方通行モード』を有効化しました」と「一方通行モードでは操作できません」の通知、サイドバーの操作タブで一方通行モードのスイッチがオンになっている"
          caption="一方通行モードのルームで、参加者が操作しようとしたところ"
        />
      </DocSection>
    </DocArticle>
  );
}
