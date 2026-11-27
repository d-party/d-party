import type { Metadata } from "next";

import { docPath } from "@/components/docs/chapters";
import {
  Callout,
  DefinitionList,
  DocArticle,
  DocFigure,
  DocFigureRow,
  DocLink,
  DocSection,
  Ui,
} from "@/components/docs/DocsContent";
import { docMetadata } from "@/components/docs/metadata";

export const metadata: Metadata = docMetadata("settings");

export default function SettingsPage(): React.JSX.Element {
  return (
    <DocArticle
      slug="settings"
      lead="ブラウザのツールバーにある d-party のアイコンを押すと、設定のポップアップが開きます。変更はその場で保存され、開いている dアニメストアのページにもすぐに反映されます。"
    >
      <DocSection id="popup" title="ポップアップの構成">
        <p>
          ポップアップには 4 つのタブがあります。選んでいるタブだけ名前が表示され、ほかのタブはマウスを乗せると名前が出ます。いちばん下には拡張機能のバージョンが表示されます。
        </p>
        <DefinitionList
          items={[
            { term: "⚙ 設定", description: "表示名・アイコン、同時視聴の設定、便利機能の設定。" },
            { term: "☺ リアクション", description: "エクストラリアクションの追加と削除。" },
            { term: "📊 統計", description: "これまでに作成・参加したルームの数などの記録。" },
            { term: "ⓘ 情報", description: "公式サイトや Chrome ウェブストアなどへのリンク。" },
          ]}
        />
        <Callout variant="note" title="設定の保存先">
          <p>
            設定はブラウザ（Chrome の拡張機能用ストレージ）に保存され、d-party のサーバーには送られません。Chrome の同期をオンにしていると、同じ Google アカウントのほかの PC にも同期されることがあります。表示名とアイコンだけは、ルームに入ったときに参加者へ送られます。
          </p>
        </Callout>
      </DocSection>

      <DocSection id="user" title="ユーザー設定（表示名とアイコン）">
        <p>
          ルームで表示される名前（15 文字以下）とアイコンです。鉛筆のボタンで編集し、名前は <Ui>✓</Ui>{" "}
          で確定、アイコンは選んだ時点で保存されます。何も設定しないと表示名は「ユーザー」になります。変更はルームを作成・参加したときに使われるので、入室中に変えた場合は次のルームから反映されます。
        </p>
        <DocFigureRow>
          <DocFigure
            name="popup-settings"
            alt="設定タブ。ユーザー設定、同時視聴設定、ユーティリティ設定の 3 つの枠"
            caption="設定タブ"
            maxWidth={360}
          />
          <DocFigure
            name="popup-profile-edit"
            alt="ユーザー設定の編集画面。表示名の入力欄とアイコンの一覧"
            caption="表示名とアイコンの編集"
            maxWidth={360}
          />
        </DocFigureRow>
      </DocSection>

      <DocSection id="sync-settings" title="同時視聴設定">
        <p>
          <Ui>同時視聴設定</Ui> を押すと開きます。ルームの中での表示に関する設定です。
        </p>
        <DocFigure
          name="popup-sync-settings"
          alt="同時視聴設定を開いたポップアップ。リアクションを表示、リアクションボタンを表示、自分の操作を通知のスイッチと、リアクションの表示方法の 3 つの選択肢"
          caption="同時視聴設定（リアクションの表示方法を開いた状態）"
          maxWidth={360}
        />
        <DefinitionList
          items={[
            {
              term: "リアクションを表示",
              description: "ほかの人から届いたリアクションを表示します。既定はオン。",
            },
            {
              term: "リアクションボタンを表示",
              description: "コントロールバーにリアクションのボタンを出します。既定はオン。",
            },
            {
              term: "自分の操作を通知",
              description:
                "自分が再生・停止・スキップなどをしたときにも、自分の画面に通知を出して履歴に残します。既定はオン。",
            },
            {
              term: "リアクションの表示方法",
              description: (
                <>
                  通常表示・バッジ表示・左寄り表示から選びます（
                  <DocLink href={`${docPath("reactions")}#display`}>表示方法を選ぶ</DocLink>）。
                </>
              ),
            },
          ]}
        />
      </DocSection>

      <DocSection id="utility" title="ユーティリティ設定">
        <p>ルームに関係なく、dアニメストアを少し便利にする設定です。</p>
        <DocFigure
          name="popup-utility-settings"
          alt="ユーティリティ設定を開いたポップアップ。動画は全て別タブで開く、ピクチャーインピクチャーを有効 の 2 つのスイッチ"
          caption="ユーティリティ設定"
          maxWidth={360}
        />
        <DefinitionList
          items={[
            {
              term: "動画は全て別タブで開く",
              description: (
                <>
                  既定はオン。作品ページの詳細画面の「視聴する」や、一覧の再生リンク・「続きから視聴する」を押したとき、プレイヤーを新しいタブで開きます。オフにすると dアニメストア本来の動きに戻り、詳細画面の「視聴する」の右に <Ui>別タブで視聴する</Ui> ボタンが出ます。
                </>
              ),
            },
            {
              term: "ピクチャーインピクチャーを有効",
              description:
                "既定はオン。プレイヤーの全画面ボタンの左にピクチャーインピクチャーのボタンを出します。押すと動画が小さなウィンドウに切り出され、ほかの作業をしながら見られます。もう一度押すと戻ります。",
            },
          ]}
        />
      </DocSection>

      <DocSection id="reaction-tab" title="リアクションタブ">
        <p>
          エクストラリアクションを追加・削除します。使い方は{" "}
          <DocLink href={`${docPath("reactions")}#extra`}>リアクションを追加する</DocLink>{" "}
          を見てください。
        </p>
      </DocSection>

      <DocSection id="stats" title="統計タブ">
        <p>
          自分がこれまでに d-party をどれくらい使ったかの記録です。記録はこのブラウザの中だけに保存され、サーバーには送られません。
        </p>
        <DocFigureRow>
          <DocFigure
            name="popup-stats"
            alt="統計タブ。作成したルーム 8、参加したルーム 15、送ったリアクション 144、接続時間 26時間、リアクション内訳の棒グラフ"
            caption="統計タブ"
            maxWidth={360}
          />
          <DocFigure
            name="popup-info"
            alt="情報タブ。ホームページ、使い方、dアニメストア、Chrome ウェブストア、寄付（GitHub Sponsors）へのリンク"
            caption="情報タブ"
            maxWidth={360}
          />
        </DocFigureRow>
        <DefinitionList
          items={[
            { term: "作成したルーム", description: "ルームを作成した回数。" },
            { term: "参加したルーム", description: "招待リンクからルームに参加した回数。" },
            {
              term: "送ったリアクション",
              description:
                "標準の 5 つのリアクションを送った回数と、その内訳。エクストラリアクションは数えません。",
            },
            {
              term: "接続時間",
              description: "ルームに接続していた時間の合計（1 時間以上は時間単位で表示）。",
            },
          ]}
        />
        <p>
          左下にいつから計測しているかが表示されます。<Ui>リセット</Ui> →{" "}
          <Ui>リセットする</Ui> で記録を 0 に戻せます。
        </p>
      </DocSection>

      <DocSection id="info" title="情報タブ">
        <p>
          d-party のホームページ、使い方ページ、dアニメストアのトップ、Chrome ウェブストア（レビューの投稿もここから）、開発を支援する GitHub Sponsors へのリンクがあります。
        </p>
      </DocSection>
    </DocArticle>
  );
}
