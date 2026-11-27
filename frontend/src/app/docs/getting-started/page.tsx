import type { Metadata } from "next";

import { docPath } from "@/components/docs/chapters";
import {
  Callout,
  DocArticle,
  DocFigure,
  DocFigureRow,
  DocLink,
  DocSection,
  Step,
  Steps,
  Ui,
} from "@/components/docs/DocsContent";
import { docMetadata } from "@/components/docs/metadata";
import {
  CHROME_WEBSTORE_URL,
  D_ANIME_STORE_URL,
  GOOGLE_CHROME_URL,
  MICROSOFT_EDGE_URL,
} from "@/lib/links";

export const metadata: Metadata = docMetadata("getting-started");

export default function GettingStartedPage(): React.JSX.Element {
  return (
    <DocArticle
      slug="getting-started"
      lead="d-party を使い始める前に必要なものと、拡張機能のインストール、最初にしておきたい表示名とアイコンの設定を説明します。ルームを作る人も、招待されて参加する人も同じ準備が必要です。"
    >
      <DocSection id="requirements" title="必要なもの">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong className="text-foreground">PC の Google Chrome または Microsoft Edge</strong>
            ：d-party は Chrome 拡張機能です。
            <DocLink href={GOOGLE_CHROME_URL}>Chrome</DocLink> と{" "}
            <DocLink href={MICROSOFT_EDGE_URL}>Edge</DocLink>{" "}
            の PC 版で動きます。スマートフォンやタブレットのブラウザ、アプリでは使えません。
          </li>
          <li>
            <strong className="text-foreground">dアニメストアの契約とログイン</strong>
            ：本家の <DocLink href={D_ANIME_STORE_URL}>dアニメストア</DocLink>{" "}
            のアカウントが必要です。「dアニメストア for Prime Video」や「dアニメストア ニコニコ支店」では使えません。
            しばらく使っていなかった場合はログインが切れていることがあるので、先にトップページからログインできるか確かめておきましょう。
          </li>
          <li>
            <strong className="text-foreground">参加する全員の準備</strong>
            ：一緒に見る人もそれぞれ dアニメストアを契約し、d-party をインストールしておく必要があります。
            拡張機能がない人は、再生位置だけを表示する{" "}
            <DocLink href={`${docPath("invite")}#timer`}>タイマー画面</DocLink> を使えます。
          </li>
        </ul>
        <Callout variant="tip" title="料金">
          <p>d-party は無料で、広告もありません。必要なのは dアニメストアの月額料金だけです。</p>
        </Callout>
      </DocSection>

      <DocSection id="install" title="拡張機能をインストールする">
        <Steps>
          <Step title="Chrome ウェブストアを開く">
            <p>
              Chrome または Edge で{" "}
              <DocLink href={CHROME_WEBSTORE_URL}>Chrome ウェブストアの d-party のページ</DocLink>{" "}
              を開きます。Edge の場合は「他のストアからの拡張機能を許可」を求められたら許可してください。
            </p>
          </Step>
          <Step title={<>「Chrome に追加」を押す</>}>
            <p>確認のダイアログで拡張機能を追加します。インストールはすぐに終わり、ブラウザの再起動は要りません。インストールの前から開いていた dアニメストアのタブは、再読み込みすると d-party が使えるようになります。</p>
          </Step>
          <Step title="利用マニュアルが開く">
            <p>
              初めてインストールしたときだけ、この <DocLink href="/docs">利用マニュアル</DocLink>{" "}
              のトップページが新しいタブで自動的に開きます。開けばインストールは完了です。
            </p>
          </Step>
          <Step title="ツールバーに固定する（おすすめ）">
            <p>
              ブラウザ右上の拡張機能メニュー（パズルのピースのアイコン）から d-party をピン留めしておくと、設定のポップアップをすぐに開けます。
            </p>
          </Step>
        </Steps>
        <Callout variant="note" title="アップデート">
          <p>
            d-party のアップデートはブラウザが自動で行います。古いバージョンのままだと招待リンクを開いたときに「拡張機能が最新ではありません」と表示されることがあります（
            <DocLink href={`${docPath("troubleshooting")}#outdated`}>対処</DocLink>）。
          </p>
        </Callout>
      </DocSection>

      <DocSection id="profile" title="表示名とアイコンを決める">
        <p>
          ルームの参加者一覧や通知には、ポップアップで設定した表示名とアイコンが使われます。最初は表示名が「ユーザー」になっているので、ルームに入る前に変えておくとだれがだれか分かりやすくなります。
        </p>
        <Steps>
          <Step title="ツールバーの d-party のアイコンを押す">
            <p>
              設定のポップアップが開きます。<Ui>設定</Ui> タブの <Ui>ユーザー設定</Ui> に今の表示名とアイコンが表示されています。
            </p>
          </Step>
          <Step title="鉛筆のボタンを押して編集する">
            <p>
              表示名（15 文字以下）を入力し、右の <Ui>✓</Ui> で確定します。アイコンは一覧から選んだ時点で保存されます。
            </p>
          </Step>
        </Steps>
        <DocFigureRow>
          <DocFigure
            name="popup-settings"
            alt="d-party のポップアップの設定タブ。ユーザー設定に表示名「さくら」と猫のアイコンが表示されている"
            caption="ポップアップの「設定」タブ"
            maxWidth={360}
          />
          <DocFigure
            name="popup-profile-edit"
            alt="表示名の入力欄と、アイコンを選ぶ一覧が表示されたユーザー設定の編集画面"
            caption="表示名とアイコンの編集"
            maxWidth={360}
          />
        </DocFigureRow>
        <Callout variant="warning" title="変更が反映されるタイミング">
          <p>
            表示名とアイコンは、ルームを作成・参加したときにルームへ送られます。ルームに入ったあとで変えた場合は、次にルームへ入ったときから反映されます。
          </p>
        </Callout>
        <p>
          ポップアップのほかの設定は <DocLink href={docPath("settings")}>拡張機能の設定</DocLink>{" "}
          で詳しく説明しています。準備ができたら、次は{" "}
          <DocLink href={docPath("create-room")}>ルームを作りましょう</DocLink>。
        </p>
      </DocSection>
    </DocArticle>
  );
}
