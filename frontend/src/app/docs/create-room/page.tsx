import type { Metadata } from "next";

import { docPath } from "@/components/docs/chapters";
import {
  Callout,
  DefinitionList,
  DocArticle,
  DocFigure,
  DocLink,
  DocSection,
  Step,
  Steps,
  Ui,
} from "@/components/docs/DocsContent";
import { docMetadata } from "@/components/docs/metadata";

export const metadata: Metadata = docMetadata("create-room");

export default function CreateRoomPage(): React.JSX.Element {
  return (
    <DocArticle
      slug="create-room"
      lead="一緒に見る作品と話数を決めたら、ルーム（パーティールーム）を作ります。ルームを作った人がそのルームのオーナー（ホスト）になります。"
    >
      <DocSection id="episode-buttons" title="作品ページのボタン（dアニメストア）">
        <p>
          d-party を入れた状態で dアニメストアの作品ページ（話数の一覧が並ぶページ）を開くと、各話のカードの右下に 2 つのボタンが追加されます。マウスを乗せるとボタンの名前が表示されます。
        </p>
        <DocFigure
          name="store-episode-list"
          alt="作品ページのエピソード一覧。各話のカード右下に再生ボタンとパーティールーム作成ボタンが並び、第3話のボタンに「パーティールームを作成」の吹き出しが出ている"
          caption="各話の右下に「別タブで再生」と「パーティールームを作成」が並びます（架空の作品・画面はイメージです）。"
        />
        <DefinitionList
          items={[
            {
              term: "▶ 別タブで再生",
              description:
                "その話のプレイヤーを新しいタブで開きます。ひとりで見るとき用で、ルームは作られません。",
            },
            {
              term: "👥 パーティールームを作成",
              description:
                "その話のプレイヤーを新しいタブで開き、右側にルーム作成用のサイドバーを表示します。",
            },
          ]}
        />
      </DocSection>

      <DocSection id="dmm-tv" title="作品ページのボタン（DMM TV）">
        <p>
          DMM TV では、作品ページ（作品の詳細とエピソードの一覧が並ぶページ）の、お気に入りやシェアのボタンが並ぶ行に{" "}
          <Ui>パーティールームを作成</Ui>{" "}
          のボタン（👥）が 1 つ追加されます。マウスを乗せるとボタンの名前が表示されます。
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            押すと、その作品のいま選んでいる話（話を選んでいなければ最初の話）の再生ページが<strong className="text-foreground">同じタブで</strong>開き、右側にルーム作成用のサイドバーが表示されます。新しいタブでは開きません。
          </li>
          <li>
            dアニメストアの「別タブで再生」にあたるボタンはありません。ひとりで見るときは DMM TV のふだんの再生ボタンを使います。
          </li>
        </ul>
        <p>
          ここから先の手順（サイドバーでルームを作る・詳細設定・招待）は dアニメストアと同じです。
        </p>
      </DocSection>

      <DocSection id="create" title="ルームを作成する">
        <Steps>
          <Step title={<>見たい話の <Ui>パーティールームを作成</Ui> を押す</>}>
            <p>
              プレイヤーが開き（dアニメストアは新しいタブ、DMM TV は同じタブ）、右側に d-party のサイドバーが表示されます。動画は一時停止した状態で始まります。
            </p>
          </Step>
          <Step title="必要なら詳細設定を選ぶ">
            <p>
              <Ui>＋ 詳細設定</Ui> を開くと、ルームのルールを 3 つ選べます（下の
              <DocLink href="#settings">「詳細設定」</DocLink>）。何も変えなければ、全員が自由に操作できる通常のルームになります。
            </p>
          </Step>
          <Step title={<><Ui>ルームを作成</Ui> を押す</>}>
            <p>
              サーバーに接続してルームが作られ、「ルームの作成に成功しました」と通知されます。サイドバーは <Ui>シェア</Ui> タブに切り替わり、招待リンクが表示されます。
            </p>
          </Step>
        </Steps>
        <DocFigure
          name="player-create"
          alt="プレイヤーの右側に「パーティールームを作成」と「ルームを作成」ボタンがあるサイドバーが表示されている"
          caption="パーティールームを作成した直後のプレイヤー。サイドバーの「ルームを作成」を押すとルームができます。"
        />
        <DocFigure
          name="player-room-created"
          alt="ルーム作成後のプレイヤー。右上に「ルームの作成に成功しました」の通知、サイドバーに招待リンクと共有ボタンが表示されている"
          caption="ルームを作成したところ。コントロールバーにシンクとリアクションのボタンが加わります。"
        />
        <Callout variant="tip" title="作成したら">
          <p>
            次は招待リンクを友だちに送りましょう。送り方は{" "}
            <DocLink href={docPath("invite")}>招待と参加</DocLink> で説明しています。全員がそろうまでは再生せずに待っておくのがおすすめです。
          </p>
        </Callout>
      </DocSection>

      <DocSection id="settings" title="詳細設定">
        <p>
          ルームを作る前に <Ui>＋ 詳細設定</Ui> を開くと、次の 3 つのスイッチがあります。作成後も、オーナーはサイドバーの{" "}
          <Ui>操作</Ui> タブから変更できます（<DocLink href={`${docPath("room")}#control`}>操作タブ</DocLink>）。設定が変わると、ほかの参加者には「『一方通行モード』を有効化しました」のように通知されます。
        </p>
        <DocFigure
          name="sidebar-create-settings"
          alt="詳細設定を開いたサイドバー。一方通行モード、オーナー退室時にルーム自動削除、リアクションを禁止する の 3 つのスイッチが並ぶ"
          caption="作成前の詳細設定（すべてオフ）"
          maxWidth={320}
        />
        <DefinitionList
          items={[
            {
              term: "一方通行（アクセラレーター）モード",
              description: (
                <>
                  オーナーだけが動画を操作できます。ほかの参加者が再生・一時停止・シークなどをすると「一方通行モードでは操作できません」と表示され、プレイヤーはオーナーの再生状況に戻ります。リアクションは送れます。上映会や配信のように、進行役が 1 人いるときに便利です。
                </>
              ),
            },
            {
              term: "オーナー退室時にルーム自動削除",
              description: (
                <>
                  オーナーが退室すると、その時点でルームを削除し、全員が退室になります。プレイヤーのタブを閉じたり再読み込みしたりするのも退室に含まれます。オフのときは、オーナーが抜けると残っている参加者のうちいちばん早く入室した人にホスト権限が引き継がれ、ルームは続きます（
                  <DocLink href={docPath("leave")}>退室とルームの終了</DocLink>）。
                </>
              ),
            },
            {
              term: "リアクションを禁止する",
              description:
                "リアクションはほかの参加者に送られず、記録もされません。ボタンを押すと自分の画面にだけ表示されます。",
            },
          ]}
        />
      </DocSection>

      <DocSection id="tips" title="ルームを作るときのポイント">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            サイドバーが出るのは、<Ui>パーティールームを作成</Ui>{" "}
            から開いたときと、招待リンクから参加したときだけです。dアニメストアのふつうの「視聴する」や「別タブで再生」、DMM TV のふだんの再生ボタンから開いたプレイヤーには表示されません。
          </li>
          <li>
            ルームを作ったあとに次の話へ進むと、参加者全員のプレイヤーも次の話へ移ります（
            <DocLink href={`${docPath("sync")}#synced`}>同期される操作</DocLink>）。話ごとにルームを作り直す必要はありません。DMM TV のルームでは話の移動は同期されないので、次の話を一緒に見るときはその話でルームを作り直してください。
          </li>
          <li>
            何人まで入れるかの上限は設けていませんが、動作を確かめているのは 10 人程度までです。大人数では同期がずれやすくなります。
          </li>
        </ul>
      </DocSection>
    </DocArticle>
  );
}
