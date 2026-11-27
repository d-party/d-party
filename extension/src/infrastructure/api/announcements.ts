/**
 * 配信中のアナウンスの取得。失敗（ネットワーク・4xx・5xx・想定外の形）はすべて「何も無い」
 * として扱い、呼び出し側の UI を壊さない。
 */
import type { Announcement } from "@/domain/announcement";
import { announcementsActive } from "@/infrastructure/api/generated/d-party";
import type {
  AnnouncementsRequest,
  AnnouncementsResponse,
} from "@/infrastructure/messages";

/**
 * この拡張機能のバージョン（manifest の `version`）。取れない環境（Storybook など
 * `chrome.runtime` が無い・不完全な所）では `undefined`。
 */
export function currentExtensionVersion(): string | undefined {
  try {
    const version: unknown = chrome.runtime.getManifest().version;
    return typeof version === "string" && version !== "" ? version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * backend を直接叩く。host_permissions を持つポップアップと background から使う。
 * `extension_version` を付けて、このバージョンが配信対象のものだけを受け取る。
 * バージョンが取れないときは付けない（backend はバージョンで絞り込まずに返す）。
 */
export async function fetchActiveAnnouncements(
  extensionVersion: string | undefined = currentExtensionVersion(),
): Promise<Announcement[]> {
  try {
    const response = await announcementsActive(
      extensionVersion === undefined
        ? undefined
        : { extension_version: extensionVersion },
    );
    const rows: unknown =
      response.status === 200 ? response.data?.data : undefined;
    if (!Array.isArray(rows)) return [];
    return rows.filter(isRow).map(({ id, message, level }) => ({
      id,
      message,
      // 知らない種別（backend が先に増えた場合）は通常のお知らせとして出す。
      level: level === "warning" ? "warning" : "info",
    }));
  } catch {
    return [];
  }
}

/** 形の合わない行は捨てる（本文が文字列でないと描画で落ちる）。 */
function isRow(
  row: unknown,
): row is { id: number; message: string; level: unknown } {
  if (typeof row !== "object" || row === null) return false;
  const { id, message } = row as Record<string, unknown>;
  return Number.isInteger(id) && typeof message === "string";
}

/**
 * content script から background 経由で取得する。公開ページの content script からの
 * fetch は CORS と Local Network Access で止まるので、ヘルスチェックと同じく任せる。
 */
export async function requestAnnouncements(): Promise<Announcement[]> {
  const request: AnnouncementsRequest = { type: "announcements" };
  try {
    const response = await chrome.runtime.sendMessage<
      AnnouncementsRequest,
      AnnouncementsResponse | undefined
    >(request);
    return response?.announcements ?? [];
  } catch {
    return [];
  }
}
