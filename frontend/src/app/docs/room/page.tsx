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
  DocSubheading,
  Ui,
} from "@/components/docs/DocsContent";
import { docMetadata } from "@/components/docs/metadata";

export const metadata: Metadata = docMetadata("room");

export default function RoomPage(): React.JSX.Element {
  return (
    <DocArticle
      slug="room"
      lead="ルームに入ると、プレイヤーの右側に d-party のサイドバーが、コントロールバーに d-party のボタンが加わります。ここでは視聴中に見える画面の各部分を説明します。"
    >
      <DocSection id="layout" title="画面の全体">
        <DocFigure
          name="player-watching"
          alt="視聴中のプレイヤー。右上に「『ゆうき』さんが×1.25 倍速」の通知、右側のサイドバーに操作の履歴、下のコントロールバーにシンクとリアクションのボタン"
          caption="視聴中の画面（ルームを作った「さくら」さんの画面）"
        />
        <DefinitionList
          items={[
            {
              term: "サイドバー（右）",
              description:
                "接続状態と参加人数、招待リンク・履歴・参加者・退室などのタブがあります。プレイヤーはサイドバーの分だけ横に縮みます。",
            },
            {
              term: "通知（右上）",
              description:
                "だれかの参加・退室や再生操作などを、3 秒ほど表示します。× で先に閉じることもできます。",
            },
            {
              term: "コントロールバー（下）",
              description: (
                <>
                  dアニメストアのボタンに加えて、シンクボタンとリアクションボタンが並びます（
                  <DocLink href="#controls">コントロールバーのボタン</DocLink>）。
                </>
              ),
            },
          ]}
        />
      </DocSection>

      <DocSection id="header" title="サイドバーの上部（接続状態・人数）">
        <DocFigure
          name="sidebar-header"
          alt="サイドバー上部。d-party のロゴ、緑の丸と「接続中」、人のアイコンと 3、縮小ボタン"
          caption="接続状態のバッジにマウスを乗せると状態の名前が出ます"
          maxWidth={320}
        />
        <p>
          ロゴの右には、サーバーとの接続状態を表す丸いバッジ、参加人数、サイドバーを縮小するボタンが並びます。接続状態は色で表され、マウスを乗せると名前が表示されます。
        </p>
        <DocFigure
          name="badge-states"
          alt="接続状態バッジの 4 つの状態。灰色の接続前、緑の接続中、赤の接続失敗、黄色のメンテナンス中"
          caption="接続状態の 4 種類"
          maxWidth={360}
        />
        <DefinitionList
          items={[
            {
              term: "⚪ 接続前",
              description:
                "まだルームを作成・参加していない状態です。ルームを作成する前のサイドバーはこの表示です。",
            },
            {
              term: "🟢 接続中",
              description:
                "サーバーにつながり、ルームに入っている状態です。ふだんはこの表示になります。",
            },
            {
              term: "🔴 接続失敗",
              description: (
                <>
                  ルームに入れなかったか、途中でサーバーとの接続が切れた状態です。同期は止まっています（
                  <DocLink href={`${docPath("troubleshooting")}#disconnected`}>対処</DocLink>）。
                </>
              ),
            },
            {
              term: "🟡 メンテナンス中",
              description: (
                <>
                  サイドバーを開いたときに d-party のサーバーへ接続できなかった状態です。メンテナンスや障害の可能性があります（
                  <DocLink href={`${docPath("troubleshooting")}#maintenance`}>対処</DocLink>）。
                </>
              ),
            },
          ]}
        />
        <p>
          人のアイコンの横の数字は、ルームに参加している人数です。拡張機能なしでタイマー画面を見ている人は数えません。
        </p>
      </DocSection>

      <DocSection id="announcements" title="運営からのお知らせ">
        <p>
          サイドバーの上部のすぐ下に、d-party の運営からの短いお知らせが表示されることがあります。メンテナンスの予定など、利用者に知ってほしいことを伝えるためのものです。お知らせがないときは何も表示されません。同じお知らせはツールバーの{" "}
          <DocLink href={`${docPath("settings")}#popup`}>ポップアップ</DocLink> にも表示されます。
        </p>
        <DocFigure
          name="sidebar-announcement"
          alt="サイドバーの上部の下に、三角の警告アイコンと「重要」の文字で始まるメンテナンスのお知らせが 1 行表示され、右端に × ボタンがある"
          caption="「重要」のお知らせが出ているサイドバー"
          maxWidth={320}
        />
        <DefinitionList
          items={[
            {
              term: "⚠ 重要",
              description:
                "メンテナンスなど、見落としてほしくないお知らせです。先頭に三角の警告アイコンと「重要」の文字が付きます。",
            },
            {
              term: "• お知らせ",
              description: "そのほかのお知らせです。先頭に小さな丸が付き、文字は控えめな灰色です。",
            },
          ]}
        />
        <ul className="list-disc space-y-2 pl-6">
          <li>
            右端の <Ui>×</Ui> を押すと、そのお知らせは閉じられ、二度と表示されません。サイドバーで閉じたお知らせはポップアップにも、ポップアップで閉じたお知らせはサイドバーにも表示されなくなります。
          </li>
          <li>
            閉じたことの記録はブラウザ（Chrome の拡張機能用ストレージ）に残るだけで、Chrome の同期の対象にもなりません。別の PC や、同じ PC でも別の Chrome プロファイルでは、同じお知らせがもう一度表示されます。
          </li>
          <li>
            お知らせは、使っている拡張機能のバージョンに合わせて配信されます。特定のバージョン向けのお知らせもあるので、一緒に見ている人と表示されるお知らせが違うことがあります。
          </li>
          <li>
            お知らせはサイドバーを表示したときに取得します。視聴中に新しく配信されたお知らせは、次にプレイヤーを開いたとき（または、縮小したサイドバーを元に戻したとき）に表示されます。取得できなかったときは何も表示されず、同時視聴には影響しません。
          </li>
        </ul>
      </DocSection>

      <DocSection id="collapse" title="サイドバーを縮小する・全画面にする">
        <p>
          右上の縮小ボタンを押すと、サイドバーが画面右端の小さなつまみになり、プレイヤーを広く使えます。つまみを押すと元に戻ります。縮小している間もルームには参加したままです。
        </p>
        <DocFigure
          name="player-collapsed"
          alt="サイドバーを縮小したプレイヤー。画面右端に d-party のロゴのついた小さなつまみだけが見える"
          caption="サイドバーを縮小した状態"
        />
        <p>
          プレイヤーを全画面表示にすると、サイドバーは自動的に隠れます。全画面を終えると再び表示されます。
        </p>
      </DocSection>

      <DocSection id="tabs" title="サイドバーのタブ">
        <p>
          ルームに入ると、サイドバーに <Ui>シェア</Ui>・<Ui>履歴</Ui>・<Ui>参加者</Ui>・<Ui>操作</Ui> の 4 つのタブが出ます。
        </p>

        <DocSubheading>シェア</DocSubheading>
        <p>
          招待リンクのコピーや、X・LINE・Facebook・メールでの共有、タイマーのみのURL の表示ができます。詳しくは{" "}
          <DocLink href={`${docPath("invite")}#share`}>招待リンクを送る</DocLink> を見てください。
        </p>

        <DocSubheading>履歴</DocSubheading>
        <p>
          ルームで起きたことが新しい順に並びます。左のマークで、だれの出来事かが分かります。
        </p>
        <DocFigureRow>
          <DocFigure
            name="sidebar-history"
            alt="履歴タブ。すべて・あなた・たけし・ゆうき の絞り込みボタンと、時刻つきの操作履歴"
            caption="履歴タブ"
            maxWidth={320}
          />
          <DocFigure
            name="sidebar-users"
            alt="参加者タブ。3人が参加中、さくら（YOU と王冠）、たけし、ゆうき"
            caption="参加者タブ"
            maxWidth={320}
          />
        </DocFigureRow>
        <DefinitionList
          items={[
            {
              term: "↗ 赤い矢印（送信）",
              description: (
                <>
                  自分の操作です。ポップアップの <Ui>自分の操作を通知</Ui> がオンのときに記録されます。
                </>
              ),
            },
            {
              term: "↙ 青い矢印（受信）",
              description:
                "ほかの参加者の操作です。名前とアイコン、再生・停止・スキップ・倍速・次のエピソードなどが表示されます。",
            },
            {
              term: "灰色のアイコン",
              description:
                "ルームの作成、入室・退室、シンク、ホスト権限の獲得、ルーム設定の変更、エラーなどの出来事です。",
            },
          ]}
        />
        <p>
          上の <Ui>すべて</Ui>・<Ui>あなた</Ui>・参加者の名前のボタンで、表示する履歴を絞り込めます。1 ページに入りきらないときは、下の矢印でページを切り替えます。履歴はサーバーには残らず、プレイヤーのタブを閉じたり再読み込みしたりしたとき、ルームが削除されたときに消えます。
        </p>

        <DocSubheading>参加者</DocSubheading>
        <p>
          ルームにいる人の一覧です。自分には赤い <Ui>YOU</Ui>、オーナー（ホスト）には王冠のマークが付きます。オーナーが退室して権限が引き継がれると、王冠も移ります。
        </p>

        <DocSubheading>操作</DocSubheading>
        <p id="control" className="scroll-mt-20">
          ルームからの退室と、ルームの詳細設定があります。オーナーには <Ui>ルームを削除</Ui>{" "}
          も表示されます。オーナー以外は詳細設定を見るだけで、変更はできません（「オーナーのみ変更可能」と表示されます）。
        </p>
        <DocFigureRow>
          <DocFigure
            name="sidebar-control-owner"
            alt="オーナーの操作タブ。退室する、ルームを削除（3秒長押し）、詳細設定の 3 つのスイッチ"
            caption="オーナーの操作タブ"
            maxWidth={320}
          />
          <DocFigure
            name="sidebar-delete-hold"
            alt="ルームを削除ボタンを長押ししている途中。ボタンの背景が左から赤く満ち、「押し続けて削除… 2」と表示"
            caption="ルームの削除は 3 秒間の長押し"
            maxWidth={320}
          />
        </DocFigureRow>
        <p>
          退室と削除については <DocLink href={docPath("leave")}>退室とルームの終了</DocLink>、
          詳細設定の意味は <DocLink href={`${docPath("create-room")}#settings`}>詳細設定</DocLink>{" "}
          を見てください。
        </p>
      </DocSection>

      <DocSection id="controls" title="コントロールバーのボタン">
        <DocFigure
          name="player-controls"
          alt="プレイヤー下部のコントロールバー。再生ボタンや時間表示の右に、シンク、いいね、お気に入り、笑顔、涙、ブーイング、追加したリアクションのボタンが並ぶ"
          caption="コントロールバー。時間表示の右に d-party のボタンが加わります。"
        />
        <DefinitionList
          items={[
            {
              term: "🔄 シンク",
              description: (
                <>
                  自分の再生位置・速度・再生中かどうかを、オーナー（ホスト）に合わせ直します（
                  <DocLink href={`${docPath("sync")}#sync-button`}>シンクボタン</DocLink>）。
                </>
              ),
            },
            {
              term: "リアクション",
              description: (
                <>
                  いいね・お気に入り・笑顔・涙・ブーイングと、ポップアップで追加したリアクションを、全員の画面に表示します（
                  <DocLink href={docPath("reactions")}>リアクション</DocLink>）。
                </>
              ),
            },
            {
              term: "ピクチャーインピクチャー",
              description: (
                <>
                  全画面ボタンの左にあります。動画を小さなウィンドウに切り出します。自分の画面だけの機能で、ルームがなくても使えます（
                  <DocLink href={`${docPath("settings")}#utility`}>設定</DocLink>）。
                </>
              ),
            },
          ]}
        />
      </DocSection>

      <DocSection id="notifications" title="通知の種類">
        <p>
          画面右上の通知は、色で種類が分かれています。
        </p>
        <DefinitionList
          items={[
            {
              term: "緑（成功）",
              description:
                "「ルームの作成に成功しました」「ルームに参加」など。自分の操作の通知（ポップアップの「自分の操作を通知」がオンのとき）もこの色です。",
            },
            {
              term: "青（お知らせ）",
              description:
                "「『たけし』さんが参加 🎉」「『ゆうき』さんが停止」「ルームのホスト権限を獲得」「再生状況をホストにシンク」、ルーム設定の変更など。",
            },
            {
              term: "赤（警告）",
              description:
                "「ルームが削除されました」「ルームに参加できませんでした」「サーバーとの通信が終了」「サーバーへの接続に失敗しました」「一方通行モードでは操作できません」など。",
            },
          ]}
        />
        <Callout variant="tip">
          <p>
            自分の操作まで通知されるとうるさい場合は、ポップアップの <Ui>自分の操作を通知</Ui>{" "}
            をオフにしてください（既定はオン）。ほかの人の操作の通知は常に表示されます。
          </p>
        </Callout>
      </DocSection>
    </DocArticle>
  );
}
