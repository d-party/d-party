import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "d-party のプライバシーポリシー。取得する情報、利用目的、保存期間等を定めます。",
};

const UPDATED_AT = "2026-06-21";

const SOURCE_URL =
  "https://github.com/d-party/chrome-extension/blob/main/PRIVACY.md";

export default function PrivacyPage(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          プライバシーポリシー
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          最終更新日: {UPDATED_AT}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          本ポリシーは Chrome 拡張機能{" "}
          <strong className="text-foreground">d-party</strong>、ウェブサイト{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            https://d-party.net
          </code>
          、およびバックエンドサービス（以下総称して「本サービス」）における
          利用者情報の取り扱いについて定めるものです。本サービスは、株式会社 NTT
          ドコモが運営する「dアニメストア」上で利用者同士が動画を同時視聴
          （ウォッチパーティー）するための機能を提供する、有志による非営利の
          オープンソースプロジェクトです。dアニメストアの公式サービスではありません。
        </p>
      </header>

      <Section title="1. 運営者">
        <ul className="list-disc space-y-1 pl-6">
          <li>プロジェクト名: d-party</li>
          <li>運営: d-party 開発チーム（個人有志によるオープンソースプロジェクト）</li>
          <li>
            ソースコード:{" "}
            <ExtLink href="https://github.com/d-party">
              github.com/d-party
            </ExtLink>
          </li>
          <li>
            連絡先: 上記 GitHub Organization の各リポジトリの Issue
          </li>
        </ul>
      </Section>

      <Section title="2. 取得する情報と利用目的">
        <p>
          本サービスは、サービスの提供に必要最小限の情報のみを取得します。
        </p>

        <h3 className="mt-6 text-lg font-semibold">
          2.1 本拡張機能がローカルに保存する情報
        </h3>
        <p>
          以下の情報は、利用者のブラウザ内（
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            chrome.storage.sync
          </code>
          ）にのみ保存され、本サービスのサーバには送信されません。Chrome の同期設定
          により、利用者自身の Google アカウントを通じて他端末と同期される場合が
          あります。
        </p>
        <Table
          headers={["項目", "内容", "目的"]}
          rows={[
            ["表示名", "ルーム内で表示するニックネーム", "同時視聴ルームでの識別"],
            [
              "接続先ホスト / プロトコル設定",
              "バックエンドの URL 設定（開発者向け）",
              "接続先の切り替え",
            ],
          ]}
        />

        <h3 className="mt-6 text-lg font-semibold">
          2.2 ルーム参加時にサーバへ送信される情報
        </h3>
        <p>
          利用者が同時視聴ルームを作成・参加した際に、WebSocket
          経由でバックエンドへ以下の情報が送信され、必要な期間サーバに保存されます。
        </p>
        <Table
          headers={["項目", "内容", "保存形式"]}
          rows={[
            ["ルーム ID", "サーバが生成するランダム UUID", "平文"],
            [
              "視聴中作品の part_id",
              "dアニメストアのエピソード識別子",
              "平文",
            ],
            [
              "ユーザー ID",
              "サーバが生成するランダム UUID（アカウントではありません）",
              "平文",
            ],
            [
              "表示名",
              "上記 2.1 の表示名",
              "暗号化して保存（Fernet / cryptography）",
            ],
            ["ホスト権限フラグ", "ルーム作成者かどうか", "平文"],
            [
              "プレイヤー操作イベント",
              "再生 / 一時停止 / シーク位置 / 再生速度",
              "同期のため一時的に配信。永続化されません",
            ],
            [
              "リアクション種別",
              "5 種類の絵文字リアクション",
              "統計目的で集計",
            ],
            [
              "入退室イベント",
              "ルーム ID と種別（join / leave）",
              "統計目的",
            ],
          ]}
        />

        <p className="mt-4 font-semibold text-foreground">
          本サービスは以下の情報を取得しません。
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>氏名、メールアドレス、電話番号、住所等の個人を直接識別する情報</li>
          <li>dアニメストアのアカウント情報、ログイン認証情報、パスワード</li>
          <li>クレジットカード情報、決済情報</li>
          <li>
            IP アドレスの長期保存（リクエストログとして一時的に記録される場合があります）
          </li>
          <li>
            利用者個人に紐づけた視聴履歴（part_id
            はルーム情報として一時的に保持されますが、個人別の視聴履歴は作成しません）
          </li>
          <li>行動ターゲティング広告のためのトラッキング情報</li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold">
          2.3 自動的に取得される情報
        </h3>
        <p>
          サーバ運用のため、Nginx のアクセスログおよび Prometheus / Grafana による
          サーバメトリクス（CPU・メモリ・リクエスト数等）を取得しますが、これらは
          インフラ監視を目的とした集計情報であり、個人を特定する目的では利用しません。
        </p>
      </Section>

      <Section title="3. 情報の利用目的">
        <ol className="list-decimal space-y-1 pl-6">
          <li>同時視聴機能の提供（プレイヤー状態の同期、リアクション配信）</li>
          <li>ルーム参加人数等の表示</li>
          <li>
            サービス全体の利用統計（公開ページ{" "}
            <Link
              href="/stats"
              className="text-primary underline-offset-4 hover:underline"
            >
              統計
            </Link>{" "}
            で匿名集計値として表示）
          </li>
          <li>不正利用・障害対応のための調査</li>
          <li>サービス品質の改善</li>
        </ol>
      </Section>

      <Section title="4. 第三者提供">
        <p>
          取得した情報を、利用者の同意なく第三者に提供することはありません。
          ただし、法令に基づき開示が求められる場合、または人の生命・身体・財産の
          保護のために必要であり本人の同意取得が困難な場合を除きます。
        </p>
      </Section>

      <Section title="5. 外部サービスとの関係">
        <p>
          本サービスは以下の外部サービスと関連しますが、これらは本サービスの運営者
          とは <strong>別事業者</strong> であり、それぞれのプライバシーポリシーが
          適用されます。
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>dアニメストア</strong>（株式会社 NTT
            ドコモ）: 動画配信の本体。本サービスは dアニメストアの提供者ではありません。
          </li>
          <li>
            <strong>Google Chrome / Chrome Web Store</strong>（Google
            LLC）: 本拡張機能の配布基盤。
          </li>
          <li>
            <strong>GitHub</strong>（GitHub, Inc.）: ソースコードのホスティング。
          </li>
        </ul>
      </Section>

      <Section title="6. データの保存期間">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>ルーム関連データ</strong>
            （ルーム、参加ユーザー、リアクション、入退室履歴）:
            使用されなくなったルームは定期実行されるクリーンアップ処理により
            自動的に削除されます。
          </li>
          <li>
            <strong>表示名</strong>:
            ルームデータの削除と同時に削除されます。暗号化して保存されており、
            復号鍵を失った場合は読み出し不能となります。
          </li>
          <li>
            <strong>公開統計</strong>:
            集計値（参加人数、リアクション数等）は匿名化された集計情報として
            保持される場合があります。
          </li>
        </ul>
      </Section>

      <Section title="7. Cookie 等のトラッキング技術">
        <p>
          本サービスのウェブサイトは、サービスの動作に必要な最小限のもの以外、
          広告・解析目的の Cookie を使用しません。Google Analytics
          等の第三者トラッキングは導入していません。
        </p>
      </Section>

      <Section title="8. 拡張機能の権限について">
        <p>本拡張機能は Manifest V3 に基づき、以下の権限を要求します。</p>
        <Table
          headers={["権限", "用途"]}
          rows={[
            [
              "storage",
              "上記 2.1 の設定情報をブラウザに保存するため",
            ],
            [
              "host_permissions: anime.dmkt-sp.jp / animestore.docomo.ne.jp",
              "dアニメストア上で同時視聴 UI を表示し、プレイヤーの状態を取得・制御するため",
            ],
            [
              "host_permissions: d-party.net",
              "ロビーページでバージョン確認を行うため",
            ],
          ]}
        />
        <p className="mt-4">
          これらの権限は、上記目的の範囲外（例: dアニメストア上での操作内容の
          収集・送信、他サイトの閲覧情報の取得等）には使用しません。
        </p>
      </Section>

      <Section title="9. 利用者の権利">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>削除</strong>:
            ルームから退室することで、参加ユーザー情報は論理削除されます。
            ルーム自体が無人になれば、ルームおよび関連データは自動的に削除されます。
          </li>
          <li>
            <strong>設定の消去</strong>: Chrome
            の拡張機能管理画面から本拡張機能を削除することで、
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              chrome.storage
            </code>{" "}
            上の設定情報が消去されます。
          </li>
          <li>
            <strong>問い合わせ</strong>: その他の照会・削除依頼は GitHub Issue
            にてご連絡ください。
          </li>
        </ul>
        <p className="mt-4">
          なお、本サービスは利用者を直接識別する情報を取得していないため、
          特定個人に紐づくデータの個別開示・訂正には対応できない場合があります。
        </p>
      </Section>

      <Section title="10. セキュリティ">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            表示名は Fernet（AES-128-CBC + HMAC-SHA256）により暗号化のうえ
            保存します。
          </li>
          <li>
            本サービスへの通信は HTTPS / WSS により暗号化されます（本番環境）。
          </li>
          <li>
            ソースコードは MIT License の下でオープンソースとして公開されており、
            第三者による監査が可能です。
          </li>
        </ul>
      </Section>

      <Section title="11. 未成年者の利用">
        <p>
          dアニメストアの利用規約に従ってください。本サービス独自に未成年者から
          別途同意を取得することはありません。
        </p>
      </Section>

      <Section title="12. 本ポリシーの変更">
        <p>
          本ポリシーは、必要に応じて改定されることがあります。改定後の内容は
          GitHub リポジトリの{" "}
          <ExtLink href={SOURCE_URL}>PRIVACY.md</ExtLink> および本ページに掲載
          された時点で効力を生じます。重要な変更がある場合は、GitHub
          リリース等でお知らせします。
        </p>
      </Section>

      <Section title="13. お問い合わせ">
        <ul className="list-disc space-y-1 pl-6">
          <li>
            GitHub:{" "}
            <ExtLink href="https://github.com/d-party">
              github.com/d-party
            </ExtLink>
          </li>
          <li>
            Issue:{" "}
            <ExtLink href="https://github.com/d-party/chrome-extension/issues">
              github.com/d-party/chrome-extension/issues
            </ExtLink>
          </li>
        </ul>
      </Section>

      <p className="mt-12 text-sm text-muted-foreground">
        本ポリシーの正本（マークダウン版）は{" "}
        <ExtLink href={SOURCE_URL}>GitHub の PRIVACY.md</ExtLink>{" "}
        で公開しています。
      </p>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="mt-10 space-y-3 text-sm leading-relaxed text-muted-foreground">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}): React.JSX.Element {
  return (
    <div className="my-4 overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border align-top">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
