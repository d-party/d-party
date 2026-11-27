/**
 * Opens the user manual (/docs) once on first install (onInstalled also fires on reload
 * and update, hence the stored flag), and runs the sidebar's health check and
 * announcement fetch, which content scripts cannot fetch under Local Network
 * Access.
 */
import { fetchActiveAnnouncements } from "@/infrastructure/api/announcements";
import { health } from "@/infrastructure/api/generated/d-party";
import { DOCS_URL } from "@/infrastructure/env";
import type {
  AnnouncementsRequest,
  AnnouncementsResponse,
  HealthCheckRequest,
  HealthCheckResponse,
} from "@/infrastructure/messages";

// 旧「使い方」ページの頃からのキー。変えると既存の利用者にもう一度ページが開くので、
// 名前は usage のまま据え置く。
const DOCS_OPENED_KEY = "usagePageOpened";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== chrome.runtime.OnInstalledReason.INSTALL) return;
  void openDocsOnce();
});

async function openDocsOnce(): Promise<void> {
  const stored = await chrome.storage.local.get(DOCS_OPENED_KEY);
  if (stored[DOCS_OPENED_KEY]) return;
  await chrome.storage.local.set({ [DOCS_OPENED_KEY]: true });
  await chrome.tabs.create({ url: DOCS_URL });
}

chrome.runtime.onMessage.addListener(
  (
    message: HealthCheckRequest,
    _sender,
    sendResponse: (response: HealthCheckResponse) => void,
  ) => {
    if (message?.type !== "healthCheck") return undefined;
    health()
      .then((response) => sendResponse({ ok: response.status === 200 }))
      .catch(() => sendResponse({ ok: false }));
    return true; // 非同期に sendResponse するためチャネルを開いたままにする。
  },
);

chrome.runtime.onMessage.addListener(
  (
    message: AnnouncementsRequest,
    _sender,
    sendResponse: (response: AnnouncementsResponse) => void,
  ) => {
    if (message?.type !== "announcements") return undefined;
    // 失敗しても reject せず空の配列で解決する。
    void fetchActiveAnnouncements().then((announcements) =>
      sendResponse({ announcements }),
    );
    return true;
  },
);
