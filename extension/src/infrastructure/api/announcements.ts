/**
 * 配信中のアナウンスの取得。失敗（ネットワーク・5xx・想定外の形）はすべて「何も無い」
 * として扱い、呼び出し側の UI を壊さない。
 */
import type { Announcement } from "@/domain/announcement";
import { announcementsActive } from "@/infrastructure/api/generated/d-party";
import type {
  AnnouncementsRequest,
  AnnouncementsResponse,
} from "@/infrastructure/messages";

/** backend を直接叩く。host_permissions を持つポップアップと background から使う。 */
export async function fetchActiveAnnouncements(): Promise<Announcement[]> {
  try {
    const response = await announcementsActive();
    const rows: unknown =
      response.status === 200 ? response.data?.data : undefined;
    if (!Array.isArray(rows)) return [];
    return rows.map(({ id, message, level }) => ({
      id,
      message,
      // 知らない種別（backend が先に増えた場合）は通常のお知らせとして出す。
      level: level === "warning" ? "warning" : "info",
    }));
  } catch {
    return [];
  }
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
