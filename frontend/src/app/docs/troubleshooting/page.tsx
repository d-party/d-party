import type { Metadata } from "next";

import { docPath } from "@/components/docs/chapters";
import {
  DocArticle,
  DocFigure,
  DocLink,
  DocSection,
  Ui,
} from "@/components/docs/DocsContent";
import { docMetadata } from "@/components/docs/metadata";
import {
  CHROME_WEBSTORE_URL,
  FEEDBACK_FORM_URL,
  GITHUB_REPO_URL,
} from "@/lib/links";

export const metadata: Metadata = docMetadata("troubleshooting");

const PROBLEMS = [
  { id: "no-sidebar", title: "サイドバーが表示されない" },
  { id: "room-not-found", title: "「ルームが見つかりませんでした」と出る" },
  { id: "outdated", title: "「拡張機能が見つかりませんでした」「拡張機能が最新ではありません」と出る" },
  { id: "join-failed", title: "「ルームに参加できませんでした」と出る" },
  { id: "disconnected", title: "「サーバーとの通信が終了」と出た・接続失敗になった" },
  { id: "maintenance", title: "接続状態が「メンテナンス中」になっている" },
  { id: "out-of-sync", title: "再生がずれる・合わない" },
  { id: "cannot-operate", title: "「一方通行モードでは操作できません」と出る" },
  { id: "no-reactions", title: "リアクションが表示されない・送れない" },
  { id: "name", title: "名前が「ユーザー」のまま・変わらない" },
  { id: "after-update", title: "拡張機能を更新したあと動きがおかしい" },
  { id: "contact", title: "それでも解決しないとき" },
] as const;

export default function TroubleshootingPage(): React.JSX.Element {
  return (
    <DocArticle
      slug="troubleshooting"
      lead="うまく動かないときに確かめてほしいことをまとめました。表示されたメッセージから探してください。"
    >
      <nav aria-label="トラブルの一覧" className="rounded-lg border border-border bg-card p-4">
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {PROBLEMS.map((problem) => (
            <li key={problem.id}>
              <a
                href={`#${problem.id}`}
                className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                {problem.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <DocSection id="no-sidebar" title="サイドバーが表示されない">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            サイドバーは、作品ページの <Ui>パーティールームを作成</Ui>{" "}
            から開いたときと、招待リンクから参加したときだけ表示されます。ふつうの「視聴する」から開いたプレイヤーには出ません（
            <DocLink href={`${docPath("create-room")}#episode-buttons`}>作品ページのボタン</DocLink>）。
          </li>
          <li>
            作品ページにボタンが出ていない場合は、拡張機能が有効になっているか、ブラウザの拡張機能の管理画面で確かめてください。PC 版の Chrome / Edge 以外では動きません。
          </li>
          <li>
            プレイヤーを全画面にしているとサイドバーは隠れます。全画面を終えてください。縮小してつまみだけになっている場合は、右端のつまみを押すと開きます。
          </li>
          <li>それでも出ない場合は、プレイヤーのタブを再読み込みしてください。</li>
        </ul>
      </DocSection>

      <DocSection id="room-not-found" title="「ルームが見つかりませんでした」と出る">
        <p>
          招待リンクのルームがもう終わっているか、リンクが途中で切れています。ルームは、全員が退室して約 1 分たったとき、オーナーが削除したとき、自動削除がオンのルームでオーナーが退室したとき、作成から 48 時間たったときに終わります（
          <DocLink href={`${docPath("leave")}#end`}>ルームが終わる条件</DocLink>）。リンクを最後までコピーできているか確かめ、だめなら新しいリンクを送ってもらってください。d-party のサーバーに障害が起きているときも同じ表示になります。
        </p>
      </DocSection>

      <DocSection
        id="outdated"
        title="「拡張機能が見つかりませんでした」「拡張機能が最新ではありません」と出る"
      >
        <p>
          「見つかりませんでした」は、招待リンクを開いてから約 30 秒たっても拡張機能が応答しなかったときの表示です。「最新ではありません」は、拡張機能のバージョンが古く今のサーバーに対応していないか、バージョンを確かめる通信に失敗したときに出ます。
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            見つからない場合：PC の Chrome / Edge で開いているか、d-party が{" "}
            <DocLink href={CHROME_WEBSTORE_URL}>インストール</DocLink>{" "}
            され有効になっているかを確かめてください。
          </li>
          <li>
            最新でない場合：アップデートは通常ブラウザが自動で行います。ブラウザを再起動すると更新されることがあります。拡張機能の管理画面でデベロッパーモードをオンにすると表示される「更新」ボタンでも、すぐに更新できます。
          </li>
          <li>
            拡張機能を入れられない人は、同じ画面の <Ui>タイマーを見る</Ui>{" "}
            で再生位置だけを見られます（
            <DocLink href={`${docPath("invite")}#timer`}>タイマー画面</DocLink>）。
          </li>
        </ul>
      </DocSection>

      <DocSection id="join-failed" title="「ルームに参加できませんでした」と出る">
        <p>
          プレイヤーを開いたあと、ルームに入ろうとした時点でルームが終わっていました（ルームが終わったあとにプレイヤーのタブを再読み込みしたときなど）。続けて「サーバーへの接続に失敗しました」も表示され、接続状態は赤い「接続失敗」になり、どちらも履歴に記録されます。新しい招待リンクをもらって開き直してください。
        </p>
        <DocFigure
          name="player-failed"
          alt="プレイヤーの右上に「ルームに参加できませんでした」と「サーバーへの接続に失敗しました」の警告、サイドバーの接続状態が赤、履歴に同じ 2 つの文言"
          caption="ルームに参加できなかったとき"
        />
      </DocSection>

      <DocSection
        id="disconnected"
        title="「サーバーとの通信が終了」と出た・接続失敗になった"
      >
        <p>
          ルームに入っている間にサーバーとの接続が切れました（ネットワークの切断、PC のスリープ、サーバーの再起動など）。「サーバーへの接続に失敗しました」は、最初の接続ができなかったときや、ルームに参加できなかったとき（
          <DocLink href="#join-failed">上の項目</DocLink>）の表示です。どちらの場合も自動ではつなぎ直さないので、次のようにしてください。
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>参加者は、招待リンクを開き直すとルームに戻れます。</li>
          <li>
            オーナーも招待リンクから入り直せますが、オーナーの権限はほかの参加者に移っています（「オーナー退室時にルーム自動削除」がオンのルームは、その時点で削除されています）。全員が抜けていた場合は、ルームは約 1 分で閉じられるので、新しくルームを作り直してください。
          </li>
          <li>
            自分で <Ui>退室する</Ui> を押した直後にも「サーバーとの通信が終了」と表示されます。これは問題ありません。
          </li>
        </ul>
      </DocSection>

      <DocSection id="maintenance" title="接続状態が「メンテナンス中」になっている">
        <p>
          サイドバーを開いたときに d-party のサーバーへ接続できませんでした。サーバーのメンテナンスや障害、または自分のネットワークの問題が考えられます。しばらく待ってからプレイヤーを開き直してください。
        </p>
      </DocSection>

      <DocSection id="out-of-sync" title="再生がずれる・合わない">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            コントロールバーの <Ui>🔄</Ui>{" "}
            （シンク）ボタンを押すと、ホストの再生状況に合わせ直せます（
            <DocLink href={`${docPath("sync")}#sync-button`}>シンクボタン</DocLink>）。
          </li>
          <li>
            ホストは 5 秒ごとに再生状況を送っているので、少しのずれは数秒で直ります。0.5 秒以下のずれは、音が途切れないようにあえて直していません。
          </li>
          <li>
            読み込みが遅い（通信が不安定な）人がいると、その人だけ遅れることがあります。
          </li>
          <li>
            人数が多いほど同期はずれやすくなります。動作を確かめているのは 10 人程度までです。
          </li>
        </ul>
      </DocSection>

      <DocSection id="cannot-operate" title="「一方通行モードでは操作できません」と出る">
        <p>
          ルームが一方通行モードになっていて、オーナー以外は動画を操作できません。操作するとオーナーの再生状況に戻されます。設定はサイドバーの <Ui>操作</Ui>{" "}
          タブで確認でき、変えられるのはオーナーだけです（
          <DocLink href={`${docPath("sync")}#one-way`}>一方通行モード</DocLink>）。
        </p>
      </DocSection>

      <DocSection id="no-reactions" title="リアクションが表示されない・送れない">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            ほかの人のリアクションが見えない：ポップアップの <Ui>リアクションを表示</Ui>{" "}
            がオフになっていないか確かめてください。
          </li>
          <li>
            ボタンがない：ポップアップの <Ui>リアクションボタンを表示</Ui>{" "}
            がオフになっていないか確かめてください。ボタンは、ルームを作成・参加したプレイヤーにだけ表示されます。
          </li>
          <li>
            自分の画面にしか出ない：ルームで <Ui>リアクションを禁止する</Ui>{" "}
            がオンになっています。
          </li>
        </ul>
      </DocSection>

      <DocSection id="name" title="名前が「ユーザー」のまま・変わらない">
        <p>
          ポップアップで表示名を設定していないと「ユーザー」になります。表示名とアイコンはルームに入ったときに送られるので、入室中に変えたときは、一度退室して招待リンクから入り直すと反映されます。ただし、オーナーが入り直すとオーナーの権限はほかの参加者に移ります（
          <DocLink href={`${docPath("getting-started")}#profile`}>表示名とアイコンを決める</DocLink>）。
        </p>
      </DocSection>

      <DocSection id="after-update" title="拡張機能を更新したあと動きがおかしい">
        <p>
          拡張機能が更新・再読み込みされると、それより前から開いていた dアニメストアのタブでは設定の読み込みなどがうまくいかないことがあります。dアニメストアのタブを再読み込みしてください。
        </p>
      </DocSection>

      <DocSection id="contact" title="それでも解決しないとき">
        <p>
          <DocLink href="/qa">Q&amp;A</DocLink> もあわせてご覧ください。不具合の報告や要望は{" "}
          <DocLink href={FEEDBACK_FORM_URL}>ご意見フォーム</DocLink> か{" "}
          <DocLink href={`${GITHUB_REPO_URL}/issues`}>GitHub の Issue</DocLink>{" "}
          で受け付けています。ブラウザの種類、拡張機能のバージョン（ポップアップの下に表示）、表示されたメッセージを書いていただけると調べやすくなります。
        </p>
        <p>
          取得している情報については <DocLink href="/privacy">プライバシーポリシー</DocLink>{" "}
          をご覧ください。
        </p>
      </DocSection>
    </DocArticle>
  );
}
