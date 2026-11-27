/**
 * アナウンスの本文に書けるリンク（Markdown のインラインリンク `[テキスト](URL)`）の解釈。
 *
 * backend の `announcements/links.py` と同じ規則で読む。片側だけ変えないこと。
 *
 * - 書けるのはインラインリンクだけ。ほかの Markdown は扱わず、そのまま文字として出す。
 * - リンクにできる URL は `https://` で始まり、ホストがあり、空白・制御文字・バックスラッシュ・
 *   ユーザー情報（`https://user@host`）を含まないものだけ。満たさないもの（DB に直接入った値など）は
 *   リンクにせず、元の文字列のまま出す。
 * - 結果は文字列と URL の並びで、HTML としては扱わない（描画側は React のテキストと `<a>` で組む）。
 */

export type AnnouncementSegment =
  { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

/**
 * `[テキスト](URL)`。各グループは否定の文字クラス 1 つだけで、その直後の区切り文字
 * （`]` · `)`）をクラスに含まないので、バックトラックが積み重ならない（ReDoS にならない）。
 */
const LINK_PATTERN = /\[([^[\]]*)\]\(([^()]*)\)/g;

/**
 * 空白（`\s`）・制御や書式などの文字（Unicode の C カテゴリ）・バックスラッシュ（URL の
 * パーサが `/` と読み、backend の Python と解釈が食い違う）。
 */
const FORBIDDEN_URL_CHARS = /[\s\p{C}\\]/u;

const ALLOWED_PREFIX = "https://";

/**
 * リンクにしてよい URL なら、描画に使う正規化した href を返す。許可しないものは `null`。
 */
export function allowedHref(url: string): string | null {
  if (!url.startsWith(ALLOWED_PREFIX) || FORBIDDEN_URL_CHARS.test(url)) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname === "" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    return null;
  }
  return parsed.href;
}

/** 本文を文字列とリンクの並びに分ける。リンクにできないものは元の文字列のまま残す。 */
export function parseAnnouncementText(message: string): AnnouncementSegment[] {
  const segments: AnnouncementSegment[] = [];
  let rest = 0;
  for (const match of message.matchAll(LINK_PATTERN)) {
    const [raw, text, url] = match;
    const href = text.trim() === "" ? null : allowedHref(url);
    if (href === null) continue;
    if (match.index > rest) {
      segments.push({ kind: "text", text: message.slice(rest, match.index) });
    }
    segments.push({ kind: "link", text, href });
    rest = match.index + raw.length;
  }
  if (rest < message.length) {
    segments.push({ kind: "text", text: message.slice(rest) });
  }
  return segments;
}
