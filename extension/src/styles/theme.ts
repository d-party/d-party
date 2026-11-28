/**
 * 拡張機能の UI のテーマ。配色の中身は `theme.css`、どれを使うかはこのファイルが決める。
 *
 * 今はダーク固定。ライトを足すときは `resolveTheme()` を設定やシステム設定
 * （`matchMedia("(prefers-color-scheme: light)")`）に従うよう差し替える。
 */
export type Theme = "dark" | "light";

/** テーマを決める唯一の場所。 */
export function resolveTheme(): Theme {
  return "dark";
}

/**
 * `theme.css` のトークンと `dark:` バリアントが参照する `data-theme` を付ける。
 *
 * popup と options では <html>、Shadow DOM では shadow root の中のマウント先に付ける（shadow tree の
 * セレクタはホストより外の祖先を見られない）。
 */
export function applyTheme(root: HTMLElement, theme: Theme = resolveTheme()): void {
  root.dataset.theme = theme;
}
