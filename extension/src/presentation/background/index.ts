/**
 * Opens the usage page once on first install (onInstalled also fires on reload
 * and update, hence the stored flag), and runs the sidebar's health check and
 * announcement fetch, which content scripts cannot fetch under Local Network
 * Access.
 */
import { fetchActiveAnnouncements } from "@/infrastructure/api/announcements";
import { health } from "@/infrastructure/api/generated/d-party";
import { USAGE_URL } from "@/infrastructure/env";
import type {
  AnnouncementsRequest,
  AnnouncementsResponse,
  HealthCheckRequest,
  HealthCheckResponse,
} from "@/infrastructure/messages";

const USAGE_OPENED_KEY = "usagePageOpened";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== chrome.runtime.OnInstalledReason.INSTALL) return;
  void openUsageOnce();
});

async function openUsageOnce(): Promise<void> {
  const stored = await chrome.storage.local.get(USAGE_OPENED_KEY);
  if (stored[USAGE_OPENED_KEY]) return;
  await chrome.storage.local.set({ [USAGE_OPENED_KEY]: true });
  await chrome.tabs.create({ url: USAGE_URL });
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
