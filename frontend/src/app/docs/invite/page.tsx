import type { Metadata } from "next";

import { docPath } from "@/components/docs/chapters";
import {
  Callout,
  DefinitionList,
  DocArticle,
  DocFigure,
  DocLink,
  DocSection,
  DocSubheading,
  Step,
  Steps,
  Ui,
} from "@/components/docs/DocsContent";
import { docMetadata } from "@/components/docs/metadata";

export const metadata: Metadata = docMetadata("invite");

export default function InvitePage(): React.JSX.Element {
  return (
    <DocArticle
      slug="invite"
      lead="ルームを作ったら、招待リンクを友だちに送ります。受け取った人はリンクを開くだけで、同じ話のプレイヤーが開いてルームに参加できます。"
    >
      <DocSection id="share" title="招待リンクを送る（ルームを作った人）">
        <p>
          ルームを作ると、サイドバーの <Ui>シェア</Ui> タブに招待リンクが表示されます。リンクは{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            https://d-party.net/anime-store/lobby/…
          </code>{" "}
          （DMM TV のルームは{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            https://d-party.net/dmm-tv/lobby/…
          </code>
          ）の形で、ルームごとにランダムに作られます。
        </p>
        <DefinitionList
          items={[
            {
              term: "リンクの欄",
              description:
                "押すとリンクがクリップボードにコピーされ、右のアイコンがチェックに変わります。Discord やメッセージアプリに貼り付けて送りましょう。",
            },
            {
              term: "X / LINE / Facebook",
              description:
                "それぞれの共有画面が小さなウィンドウで開きます。X では「dアニメストアで『作品名 - 話数 - サブタイトル』を一緒に見ませんか？ 拡張機能『d-party』を使ってパーティーに参加してください」という文とリンク、ハッシュタグ（#dアニメストア #dパーティー）が入力された状態になります。DMM TV のルームでは「DMM TV で『…』を一緒に見ませんか？」とハッシュタグ #DMMTV になります。",
            },
            {
              term: "メール",
              description:
                "メールアプリが開き、件名と本文に招待の文とリンクが入ります。",
            },
            {
              term: "タイマーのみのURL",
              description: (
                <>
                  開くと、拡張機能がなくても再生中の作品名と再生位置だけを見られる URL が表示されます（
                  <DocLink href="#timer">タイマー画面</DocLink>）。dアニメストアのルームだけで、DMM TV のルームでは表示されません。
                </>
              ),
            },
          ]}
        />
        <DocFigure
          name="sidebar-share-timer"
          alt="サイドバーのシェアタブ。招待リンク、タイマーのみのURL、X・LINE・Facebook・メールの共有ボタンが並ぶ"
          caption="「シェア」タブ（タイマーのみのURL を開いた状態）"
          maxWidth={320}
        />
        <Callout variant="note" title="リンクの安全性">
          <p>
            招待リンクは推測できないランダムな文字列で、ルームが終わると使えなくなります。リンクにはルームの ID 以外の個人情報は含まれません。ただし、リンクを知っている人はだれでも参加できるので、SNS で公開すると知らない人が入ってくることがあります。
          </p>
        </Callout>
      </DocSection>

      <DocSection id="join" title="招待リンクから参加する（招待された人）">
        <Steps>
          <Step title="PC の Chrome / Edge でリンクを開く">
            <p>
              リンクを開くと d-party のページが表示され、「ルームに接続しています」と出ます。この間に拡張機能が入っているか、バージョンが対応しているかを確かめています。
            </p>
          </Step>
          <Step title="プレイヤーへ自動で移動する">
            <p>
              確認できると、ルームで見ている話のプレイヤー（dアニメストアか DMM TV の再生ページ）へ自動で移動し、ルームに参加します。「ルームに参加」と通知され、再生位置・速度・再生中かどうかがすぐにオーナー（ホスト）に合わせられます。
            </p>
          </Step>
          <Step title="あとはホストと一緒に視聴する">
            <p>
              ルームにいる人には「『たけし』さんが参加 🎉」のように通知されます。画面の見方は{" "}
              <DocLink href={docPath("room")}>ルームの画面</DocLink> へ。
            </p>
          </Step>
        </Steps>
        <DocFigure
          name="lobby-checking"
          alt="d-party のページに読み込み中の円と「ルームに接続しています」の文字が表示されている"
          caption="招待リンクを開いたときの画面"
        />
        <DocFigure
          name="player-guest-joined"
          alt="招待された人のプレイヤー。右上に「ルームに参加」の通知、サイドバーの参加者タブに自分（たけし）とオーナー（さくら）が表示されている"
          caption="参加したところ（招待された「たけし」さんの画面）"
        />
        <DocFigure
          name="player-joined"
          alt="ルームを作った人のプレイヤー。右上に「『ゆうき』さんが参加」の通知、サイドバーの参加者タブに 3 人が並ぶ"
          caption="ルームを作った「さくら」さんの画面。参加があるたびに通知されます。"
        />
        <Callout variant="warning" title="dアニメストア・DMM TV にログインしておく">
          <p>
            移動先は、ルームを作った人が見ているサービス（dアニメストアか DMM TV）のプレイヤーです。ログインしていない・契約していない場合は動画を再生できません。参加する前にログインしておきましょう。
          </p>
        </Callout>
      </DocSection>

      <DocSection id="no-extension" title="拡張機能が見つからないとき">
        <p>
          リンクを開いても拡張機能から応答がない場合（入っていない、無効になっている、スマートフォンで開いた など）は、約 30 秒後に「拡張機能が見つかりませんでした」と表示され、次の選択肢が出ます。拡張機能が古い場合は、数秒で「拡張機能が最新ではありません」と表示されます。
        </p>
        <DocFigure
          name="lobby-no-extension"
          alt="「拡張機能が見つかりませんでした」の表示と、タイマーを見る・ポップアップで開く・インストールする の 3 つのボタン"
          caption="拡張機能が見つからないときの選択肢"
        />
        <DefinitionList
          items={[
            {
              term: "タイマーを見る",
              description: "同じタブでタイマー画面を開きます。",
            },
            {
              term: "ポップアップで開く",
              description:
                "小さな別ウィンドウでタイマーを開きます。ポップアップがブロックされた場合は同じタブで開きます。",
            },
            {
              term: "インストールする / アップデートする",
              description:
                "Chrome ウェブストアの d-party のページを開きます。インストールやアップデートのあと、もう一度招待リンクを開いてください。",
            },
          ]}
        />
        <p>
          DMM TV のルームの招待リンクでは、タイマー画面がないので <Ui>インストールする / アップデートする</Ui>{" "}
          だけが出ます。
        </p>
        <p>
          リンクが間違っているか、ルームがすでに終わっている場合は「ルームが見つかりませんでした」と表示されます（
          <DocLink href={`${docPath("troubleshooting")}#room-not-found`}>対処</DocLink>）。
        </p>
      </DocSection>

      <DocSection id="timer" title="タイマー画面（拡張機能なしで再生位置を見る）">
        <p>
          タイマー画面は、拡張機能を入れられない人や、別の端末で dアニメストアを見ている人のための画面です。いまのところ dアニメストアのルームだけで使えます。ルームの今の作品名・再生位置・再生中かどうかを表示します。開くには、招待リンクの末尾に{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">?timer=true</code>{" "}
          が付いた「タイマーのみのURL」を使うか、上の画面で <Ui>タイマーを見る</Ui> を押します。
        </p>
        <DocFigure
          name="timer"
          alt="タイマー画面。「同期中」の表示、作品名「星降る町の喫茶店 - 第3話 - 流れ星のブレンド | dアニメストア」、大きな再生位置 08:43、「再生中」の表示"
          caption="タイマー画面。ホストの再生に合わせて時間が進みます。"
        />
        <DocSubheading>ポップアップ表示</DocSubheading>
        <p>
          <Ui>別窓（ポップアップ）で開く</Ui> を押すと、タイマーだけの小さなウィンドウが開きます。別のアプリやテレビで動画を流しながら、手元で位置を合わせたいときに便利です。
        </p>
        <DocFigure
          name="timer-popup"
          alt="小さなウィンドウに表示されたタイマー。同期中、作品名、08:43、再生中"
          caption="ポップアップのタイマー"
          maxWidth={380}
        />
        <ul className="list-disc space-y-2 pl-6">
          <li>
            タイマー画面は見るだけです。再生の操作やリアクションはできず、参加者の一覧や人数にも数えられません。
          </li>
          <li>
            ホストは 5 秒ごとに再生状況を送っているので、開いてから最大 5 秒ほどで時間が表示されます。
          </li>
          <li>
            ルームが削除されたときや、通信が切れてつなぎ直せなかったときは「配信が終了しました」と表示されます。参加者が全員退室したときは終了が知らされず、再生中だった場合は「同期中」のまま時間が進み続けます。表示がおかしいと思ったらページを開き直してください（終わったルームなら「ルームが見つかりませんでした」になります）。
          </li>
        </ul>
      </DocSection>
    </DocArticle>
  );
}
