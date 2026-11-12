# AGENTS.md — @d-party/ui

extension と frontend が共有する shadcn/ui プリミティブ。消費側は
`import { Tabs, cn } from "@d-party/ui"`（barrel は `src/index.ts`）。

- 新しい shadcn コンポーネントは、片方でしか使わないものも含めてここへ置く。
- `Button` だけは置かない。拡張側は hover の浮き上がりと押し込みの演出を持ち、
  両アプリでスタイルが違うため、それぞれが `src/components/ui/button.tsx` を持つ。
- `lib/portalContainer.ts` は Shadow DOM 内での Radix portal の出し先（tooltip が使う）。

## ビルド成果物を持たない

TypeScript のソースのまま公開し、消費側がトランスパイルする。次のどれかを外すと壊れる。

| 消費側 | 必要な設定 |
| --- | --- |
| extension | rspack。symlink の実パスが `node_modules` の外なので、ローダの `exclude` に当たらない（設定不要） |
| frontend | `next.config.ts` の `transpilePackages: ["@d-party/ui"]` |
| Tailwind v4 | 3 つの CSS エントリに `@source`（`extension/src/presentation/popup/styles.css` · `extension/src/styles/sidebar.css` · `frontend/src/app/globals.css`）。無いとクラスが purge される |
| frontend/Dockerfile | `packages/ui` の manifest とソースをコンテキストへコピー |

## Storybook

両アプリの `.storybook/main.ts` がここの story も拾う。テーマトークンが違うので、popup の
明るい配色とサイトの暗い配色の両方で確認できる。story はフレームワークに縛れないので
`@storybook/react` から型を取り、`storybook/no-renderer-packages` だけ無効化している。
