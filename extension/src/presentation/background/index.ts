/**
 * Opens the usage page once on first install (onInstalled also fires on reload
 * and update, hence the stored flag), and runs the sidebar's health check,
 * which content scripts cannot fetch under Local Network Access.
 */
import { HEALTH_CHECK_ENDPOINT } from "@/infrastructure/env";
import type {
  HealthCheckRequest,
  HealthCheckResponse,
} from "@/infrastructure/messages";

const USAGE_OPENED_KEY = "usagePageOpened";
const USAGE_URL = "https://d-party.net/usage";

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
    fetch(HEALTH_CHECK_ENDPOINT, { method: "GET" })
      .then((res) => sendResponse({ ok: res.ok }))
      .catch(() => sendResponse({ ok: false }));
    return true; // 非同期に sendResponse するためチャネルを開いたままにする。
  },
);
