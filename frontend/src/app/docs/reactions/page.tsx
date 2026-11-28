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

export const metadata: Metadata = docMetadata("reactions");

export default function ReactionsPage(): React.JSX.Element {
  return (
    <DocArticle
      slug="reactions"
      lead="d-party にはチャットがない代わりに、動画の上に絵文字のアニメーションを飛ばせるリアクションがあります。盛り上がる場面で気軽に送ってみましょう。"
    >
      <DocSection id="send" title="リアクションを送る">
        <p>
          ルームに入ると、コントロールバーの時間表示の右（シンクボタンの隣）にリアクションのボタンが並びます。押すと自分の画面にすぐ表示され、同時にルームの全員の画面にも表示されます。
        </p>
        <DocFigure
          name="reaction-normal"
          alt="動画の上にいいね・拍手・笑顔・お気に入り（ハート）・すいせい（彗星）の絵文字が浮かび上がっている"
          caption="リアクションが表示されたところ（通常表示）"
        />
        <DefinitionList
          items={[
            { term: "👍 いいね", description: "標準のリアクションです。" },
            { term: "❤️ お気に入り", description: "標準のリアクションです。" },
            { term: "😄 笑顔", description: "標準のリアクションです。" },
            { term: "😢 涙", description: "標準のリアクションです。" },
            { term: "🖕 ブーイング", description: "標準のリアクションです。" },
            {
              term: "追加したリアクション",
              description: (
                <>
                  ポップアップで追加したエクストラリアクションが、標準の 5 つの右に並びます（
                  <DocLink href="#extra">リアクションを追加する</DocLink>）。
                </>
              ),
            },
          ]}
        />
        <Callout variant="note" title="リアクションが送られないとき">
          <p>
            ルームの詳細設定で <Ui>リアクションを禁止する</Ui>{" "}
            がオンになっていると、リアクションはほかの人に送られず、自分の画面にだけ表示されます。
          </p>
        </Callout>
      </DocSection>

      <DocSection id="display" title="表示方法を選ぶ">
        <p>
          リアクションの見え方は 3 種類から選べます。ポップアップの <Ui>設定</Ui> →{" "}
          <Ui>同時視聴設定</Ui> → <Ui>リアクションの表示方法</Ui>{" "}
          で変更します。表示方法は自分の画面だけの設定で、ほかの人の画面はそれぞれの設定で表示されます。
        </p>
        <DocSubheading>通常表示（既定）</DocSubheading>
        <p>
          画面の下の方のランダムな位置から上へ浮かび上がり、少し止まってから消えます。上の画像がこの表示です。
        </p>
        <DocSubheading>バッジ表示</DocSubheading>
        <p>
          画面の右下に「名前 : リアクション」が小さく積み重なり、数秒で消えます。だれが送ったか分かり、動画の邪魔になりにくい表示です。
        </p>
        <DocFigure
          name="reaction-badge"
          alt="動画の右下に、送った人の名前とリアクションのアイコン（たけしは笑顔、ゆうきはハート、さくらはコーヒー）の小さなバッジが縦に並んでいる"
          caption="バッジ表示（サイドバーは縮小しています）"
        />
        <DocSubheading>左寄り表示</DocSubheading>
        <p>画面の左側を、ゆらゆら揺れながら下から上へゆっくり移動します。</p>
        <DocFigure
          name="reaction-left"
          alt="動画の左端に沿って、絵文字がいくつか縦に連なって上っている"
          caption="左寄り表示"
        />
      </DocSection>

      <DocSection id="extra" title="リアクションを追加する（エクストラリアクション）">
        <p>
          標準の 5 つのほかに、約 200 種類のエクストラリアクションから好きなものを追加できます。
        </p>
        <Steps>
          <Step title={<>ポップアップの <Ui>リアクション</Ui> タブを開く</>}>
            <p>ツールバーの d-party のアイコンを押し、笑顔のアイコンのタブを選びます。</p>
          </Step>
          <Step title={<><Ui>＋ 追加</Ui> を押して選ぶ</>}>
            <p>
              一覧からアイコンを押すと追加され、赤くチェックが付きます。「ハート」「笑い」のように名前で検索することもできます。
            </p>
          </Step>
          <Step title="プレイヤーに反映される">
            <p>
              追加したリアクションは「追加したリアクション」に並び、開いているプレイヤーにもすぐにボタンが出ます。× の付いたボタンを押すと取り除けます。
            </p>
          </Step>
        </Steps>
        <DocFigure
          name="popup-reactions"
          alt="ポップアップのリアクションタブ。変更できないデフォルトの 5 つ、追加したリアクション（すいせい・拍手・コーヒー）、検索欄とエクストラリアクションの一覧"
          caption="リアクションタブ（「追加」を開いた状態）"
          maxWidth={360}
        />
        <Callout variant="tip">
          <p>
            エクストラリアクションは、相手が追加していなくても相手の画面に表示されます。追加はボタンを出すためだけの設定です。
          </p>
        </Callout>
      </DocSection>

      <DocSection id="hide" title="リアクションを表示しない">
        <p>
          ポップアップの <Ui>同時視聴設定</Ui> で、次の 2 つを切り替えられます（
          <DocLink href={`${docPath("settings")}#sync-settings`}>同時視聴設定</DocLink>）。
        </p>
        <DefinitionList
          items={[
            {
              term: "リアクションを表示",
              description:
                "オフにすると、ほかの人から届いたリアクションを表示しません。動画に集中したいときに。",
            },
            {
              term: "リアクションボタンを表示",
              description:
                "オフにすると、コントロールバーのリアクションボタンを隠します。シンクボタンは残ります。",
            },
          ]}
        />
        <p>
          標準の 5 つのリアクションは、送った数がポップアップの{" "}
          <DocLink href={`${docPath("settings")}#stats`}>実績</DocLink>{" "}
          に記録されます。エクストラリアクションと、リアクション禁止のルームで押したものは数えません。
        </p>
      </DocSection>
    </DocArticle>
  );
}
