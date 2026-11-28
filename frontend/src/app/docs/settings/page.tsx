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
      lead="ブラウザのツールバーにある d-party のアイコンを押すと、設定のポップアップが開きます。ポップアップ右上の「別タブ」を押すと、同じ設定を新しいタブの広い画面で開けます。変更はその場で保存され、多くの設定は開いている dアニメストアのページにもすぐに反映されます（表示名とアイコンは次にルームへ入ったときから）。"
    >
      <DocSection id="popup" title="ポップアップの構成">
        <p>
          ポップアップには 4 つのタブがあります。選んでいるタブだけ名前が表示され、ほかのタブはマウスを乗せると名前が出ます。いちばん下には拡張機能のバージョンが表示されます。右上の <Ui>別タブ</Ui> を押すと、同じ設定を新しいタブで開けます（
          <DocLink href="#settings-tab">別タブで開く</DocLink>）。
        </p>
        <DefinitionList
          items={[
            { term: "設定（歯車）", description: "表示名・アイコン、同時視聴の設定、便利機能の設定。" },
            { term: "リアクション（笑顔）", description: "エクストラリアクションの追加と削除。" },
            { term: "統計（グラフ）", description: "これまでに作成・参加したルームの数などの記録。" },
            { term: "情報（i）", description: "公式サイトや Chrome ウェブストアなどへのリンク。" },
          ]}
        />
        <p>
          タブの上には、d-party の運営からの短いお知らせが表示されることがあります（メンテナンスの予定など）。お知らせはポップアップを開くたびに取得し、ないときは何も表示されません。「重要」のお知らせは三角の警告アイコンと「重要」の文字で始まり、そのほかのお知らせは小さな丸と灰色の文字で表示されます。一度に表示されるのは最新の 1 件だけです。右端の <Ui>×</Ui> で閉じたお知らせは、ポップアップにもサイドバーにも二度と表示されず、ほかにもお知らせがあれば次のものが表示されます（
          <DocLink href={`${docPath("room")}#announcements`}>運営からのお知らせ</DocLink>）。
        </p>
        <DocFigure
          name="popup-announcements"
          alt="ポップアップのタブの上に、三角の警告アイコンと「重要」の文字で始まるメンテナンスのお知らせが 1 行表示されている"
          caption="タブの上に表示される運営からのお知らせ"
          maxWidth={360}
        />
        <Callout variant="note" title="設定の保存先">
          <p>
            設定はブラウザ（Chrome の拡張機能用ストレージ）に保存され、d-party のサーバーには送られません。Chrome の同期をオンにしていると、同じ Google アカウントのほかの PC にも同期されることがあります。表示名とアイコンだけは、ルームを作成・参加したときに d-party のサーバーへ送られ、参加者に表示されます（サーバーにも保存されます）。
          </p>
        </Callout>
      </DocSection>

      <DocSection id="settings-tab" title="別タブで開く（設定タブ）">
        <p>
          ポップアップ右上の <Ui>別タブ</Ui> を押すと、同じ設定が新しいタブで開きます（すでに開いていれば、そのタブに切り替わります）。左に <Ui>設定</Ui>・<Ui>リアクション</Ui>・<Ui>統計</Ui>・<Ui>情報</Ui> が並び、ポップアップのように枠を開け閉めしなくても、すべての設定を一度に見渡せます。エクストラリアクションの一覧も広く表示されます。
        </p>
        <p>
          ポップアップと設定タブは同じ設定を読み書きするので、どちらで変えても結果は同じです。ツールバーの d-party のアイコンを右クリックして <Ui>オプション</Ui> を選んでも開けます。
        </p>
        <DocFigure
          name="options-settings"
          alt="新しいタブで開いた設定。左に 設定・リアクション・統計・情報 の項目が並び、右にユーザー設定、同時視聴設定（リアクションの表示方法の 3 つの選択肢を含む）、ユーティリティ設定がすべて開いた状態で表示されている"
          caption="別タブで開いた設定（設定タブ）"
        />
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
          <Ui>同時視聴設定</Ui> を押すと開きます（設定タブでははじめから開いています）。ルームの中での表示に関する設定です。
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
                  通常表示（既定）・バッジ表示・左寄り表示から選びます（
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
                  既定はオン。作品ページの詳細画面の「視聴する」や、一覧の再生リンク・「続きから視聴する」を押したとき、プレイヤーを新しいタブで開きます。オフにすると dアニメストア本来の動きに戻り、詳細画面の「視聴する」ボタンの右端に、別タブで開くための小さなアイコン（マウスを乗せると「別タブで視聴する」と表示）が出ます。
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
          自分がこれまでに d-party をどれくらい使ったかの記録です。記録は設定と同じくブラウザ（Chrome の拡張機能用ストレージ）に保存され、d-party のサーバーには送られません。
        </p>
        <DocFigure
          name="popup-stats"
          alt="統計タブ。作成したルーム 8、参加したルーム 15、送ったリアクション 144、接続時間 26時間、リアクション内訳の棒グラフ"
          caption="統計タブ"
          maxWidth={360}
        />
        <DefinitionList
          items={[
            { term: "作成したルーム", description: "ルームを作成した回数。" },
            { term: "参加したルーム", description: "招待リンクからルームに参加した回数。" },
            {
              term: "送ったリアクション",
              description:
                "標準の 5 つのリアクションを送った回数と、その内訳。エクストラリアクションと、リアクション禁止のルームで押したものは数えません。",
            },
            {
              term: "接続時間",
              description: "ルームに接続していた時間の合計（1 時間以上は時間単位で表示）。",
            },
          ]}
        />
        <p>
          左下に計測を始めた日（「2026/4/3 から計測」など）が表示されます。<Ui>リセット</Ui> →{" "}
          <Ui>リセットする</Ui> で記録を 0 に戻せます。
        </p>
      </DocSection>

      <DocSection id="info" title="情報タブ">
        <p>
          d-party のホームページ、この利用マニュアル（<Ui>使い方</Ui>）、dアニメストアのトップ、Chrome ウェブストア（レビューの投稿もここから）、開発を支援する GitHub Sponsors へのリンクがあります。
        </p>
        <DocFigure
          name="popup-info"
          alt="情報タブ。ホームページ、使い方、dアニメストア、Chrome ウェブストア、寄付（GitHub Sponsors）へのリンク"
          caption="情報タブ"
          maxWidth={360}
        />
      </DocSection>
    </DocArticle>
  );
}
