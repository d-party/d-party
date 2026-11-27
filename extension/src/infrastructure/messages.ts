/**
 * content script ↔ background のメッセージ。公開ページの content script から
 * localhost への fetch は Local Network Access で止まるので、background に任せる。
 */

import type { Announcement } from "@/domain/announcement";

export interface HealthCheckRequest {
  type: "healthCheck";
}

/** `ok` は backend が 200 を返したか。 */
export interface HealthCheckResponse {
  ok: boolean;
}

export interface AnnouncementsRequest {
  type: "announcements";
}

/** 配信中のアナウンス。取得に失敗したときは空の配列。 */
export interface AnnouncementsResponse {
  announcements: Announcement[];
}
