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

export const metadata: Metadata = docMetadata("leave");

export default function LeavePage(): React.JSX.Element {
  return (
    <DocArticle
      slug="leave"
      lead="見終わったらルームから退室します。オーナーはルームそのものを削除することもできます。ルームが終わると招待リンクは使えなくなります。"
    >
      <DocSection id="leave" title="ルームから退室する">
        <Steps>
          <Step title={<>サイドバーの <Ui>操作</Ui> タブを開く</>} />
          <Step title={<><Ui>退室する</Ui> を押す</>}>
            <p>
              ルームから抜け、サイドバーが閉じます。ほかの参加者には「『たけし』さんが退室」と通知されます。動画はそのまま見続けられますが、ほかの人とは同期しなくなります。
            </p>
          </Step>
        </Steps>
        <p>
          プレイヤーのタブを閉じたり、別のページへ移動したりしたときも、自動的に退室したことになります。
        </p>
        <Callout variant="tip" title="もう一度入りたいとき">
          <p>
            ルームが続いている間は、招待リンクを開けばいつでも参加し直せます。うっかりタブを閉じてしまったときも同じです。
          </p>
        </Callout>
      </DocSection>

      <DocSection id="owner-leave" title="オーナーが退室したとき">
        <p>
          オーナー（ホスト）が退室すると、残っている参加者のだれかにホスト権限が引き継がれ、ルームは続きます。新しいホストには「ルームのホスト権限を獲得」と通知され、参加者一覧の王冠もその人に移ります。退室した元のオーナーが招待リンクから入り直しても、オーナーには戻りません。
        </p>
        <p>
          ルームの詳細設定で <Ui>オーナー退室時にルーム自動削除</Ui>{" "}
          をオンにしている場合は、オーナーが退室した時点でルームが削除され、全員が退室になります。
        </p>
      </DocSection>

      <DocSection id="delete" title="ルームを削除する（オーナーのみ）">
        <p>
          オーナーは <Ui>操作</Ui> タブの <Ui>ルームを削除（3秒長押し）</Ui>{" "}
          でルームを終わらせられます。誤操作を防ぐため、ボタンを 3 秒間押し続けると削除されます（途中で離すと取り消し）。
        </p>
        <DocFigure
          name="sidebar-delete-hold"
          alt="ルームを削除ボタンを長押ししている途中のサイドバー。ボタンに「押し続けて削除… 2」と表示"
          caption="長押ししている間、残り秒数が表示されます"
          maxWidth={320}
        />
        <p>
          削除すると、参加者全員に「ルームが削除されました」と通知され、サイドバーはルーム作成前の画面に戻ります。同じ話でもう一度ルームを作りたいときは、そのまま <Ui>ルームを作成</Ui>{" "}
          を押せます（招待リンクは新しくなります）。
        </p>
        <DocFigure
          name="player-deleted"
          alt="ルームが削除されたあとのプレイヤー。右上に「ルームが削除されました」の通知、サイドバーは「パーティールームを作成」の画面"
          caption="ルームが削除されたときの参加者の画面"
        />
      </DocSection>

      <DocSection id="end" title="ルームが終わる条件">
        <DefinitionList
          items={[
            {
              term: "全員が退室した",
              description:
                "最後の 1 人が抜けてから約 1 分後にルームが閉じられます。リロードや一瞬の通信切れで、すぐに無効にならないようにしています。",
            },
            {
              term: "オーナーが削除した",
              description: "その時点で閉じられます。",
            },
            {
              term: "自動削除がオンでオーナーが退室した",
              description: "その時点で閉じられます。",
            },
            {
              term: "作成から長い時間がたった",
              description:
                "作成から一定時間（現在は 48 時間）がたったルームは、参加者がいても自動的に閉じられます。",
            },
          ]}
        />
        <p>
          終わったルームの招待リンクを開くと「ルームが見つかりませんでした」と表示されます。続けて見たいときは、だれかが新しくルームを作り、新しいリンクを送ってください。
        </p>
        <DocFigure
          name="lobby-not-found"
          alt="d-party のページに「ルームが見つかりませんでした」「リンクが正しいか、ルームがまだ有効かをご確認ください。」と表示されている"
          caption="終わったルームのリンクを開いたとき"
        />
        <p>
          ルームを閉じたあとのデータの扱いは{" "}
          <DocLink href="/privacy">プライバシーポリシー</DocLink> の「データの保存期間」に書いています。困ったときは{" "}
          <DocLink href={docPath("troubleshooting")}>困ったときは</DocLink> へ。
        </p>
      </DocSection>
    </DocArticle>
  );
}
