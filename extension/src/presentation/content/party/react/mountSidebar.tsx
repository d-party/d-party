import { createRoot } from "react-dom/client";

import { requestAnnouncements } from "@/infrastructure/api/announcements";
import type {
  HealthCheckRequest,
  HealthCheckResponse,
} from "@/infrastructure/messages";
import { applyTheme } from "@/styles/theme";
import { PortalContainerContext } from "@d-party/ui";

import { attachShadowStyles } from "./shadowStyles";
import { Sidebar, type SidebarProps } from "./Sidebar";
import { SidebarController, SidebarStore, sidebarWidth } from "./sidebarStore";

export type SidebarHandlers = Omit<SidebarProps, "store">;

export interface MountedSidebar {
  store: SidebarStore;
  controller: SidebarController;
}

/**
 * Mounts the sidebar into a Shadow DOM host placed beside the video (the video
 * wrapper moves into a flex row), so it pushes the player aside instead of
 * covering it. Falls back to a fixed overlay when the wrapper is missing.
 */
export function mountSidebar(handlers: SidebarHandlers): MountedSidebar {
  const store = new SidebarStore();
  const controller = new SidebarController(store);

  const host = document.createElement("div");
  host.id = "d-party-sidebar-host";

  const videoWrapper = document.querySelector<HTMLElement>(".videoWrapper");
  if (videoWrapper?.parentElement) {
    const playerWrapper = document.createElement("div");
    playerWrapper.id = "d-party-player-wrapper";
    playerWrapper.style.cssText =
      "display:flex;width:100%;height:100%;align-items:stretch;";
    videoWrapper.parentElement.insertBefore(playerWrapper, videoWrapper);
    playerWrapper.appendChild(videoWrapper);
    videoWrapper.style.flex = "1 1 auto";
    videoWrapper.style.minWidth = "0";
    host.style.cssText =
      "flex:0 0 auto;height:100%;overflow:hidden;transition:width 0.22s ease;";
    playerWrapper.appendChild(host);
  } else {
    host.style.cssText =
      "position:fixed;top:0;right:0;height:100vh;overflow:hidden;z-index:2147483000;transition:width 0.22s ease;";
    document.body.appendChild(host);
  }

  const applyWidth = () => {
    host.style.width = `${sidebarWidth(store.getSnapshot())}px`;
  };
  applyWidth();
  store.subscribe(applyWidth);

  const shadow = host.attachShadow({ mode: "open" });
  attachShadowStyles(shadow);

  const mountPoint = document.createElement("div");
  mountPoint.style.height = "100%";
  applyTheme(mountPoint);
  shadow.appendChild(mountPoint);

  createRoot(mountPoint).render(
    <PortalContainerContext value={mountPoint}>
      <Sidebar
        store={store}
        {...handlers}
        loadAnnouncements={requestAnnouncements}
      />
    </PortalContainerContext>,
  );

  scheduleHealthCheck(store);

  return { store, controller };
}

/** メンテナンス中に復旧を確かめ直す間隔。 */
const HEALTH_RECHECK_MS = 30_000;

/**
 * 初回表示時にヘルスチェックし、失敗したら `"maintenance"` にする。メンテナンス中は
 * 一定間隔で確かめ直し、通ったら `"idle"` に戻す（ルーム作成ボタンが再び押せる）。
 *
 * fetch は background に任せる。公開ページから localhost への fetch は Chrome の
 * Local Network Access で止められるが、host_permissions を持つ background は通る。
 */
function scheduleHealthCheck(store: SidebarStore): void {
  const unsubscribe = store.subscribe(() => {
    if (!store.getSnapshot().visible) return;
    unsubscribe();
    void checkHealth(store);
  });
}

/** 通らない間は `maintenance` にして 30 秒ごとにやり直し、通ったら元へ戻す。 */
async function checkHealth(store: SidebarStore): Promise<void> {
  const healthy = await isBackendHealthy();
  const { connectionStatus } = store.getSnapshot();
  if (healthy) {
    if (connectionStatus === "maintenance") store.setConnectionStatus("idle");
    return;
  }
  // 入室できているなら WebSocket は生きているので、表示を変えない。
  if (connectionStatus === "connected") return;
  if (connectionStatus !== "maintenance") {
    store.setConnectionStatus("maintenance");
  }
  setTimeout(() => void checkHealth(store), HEALTH_RECHECK_MS);
}

async function isBackendHealthy(): Promise<boolean> {
  const request: HealthCheckRequest = { type: "healthCheck" };
  try {
    const response = await chrome.runtime.sendMessage<
      HealthCheckRequest,
      HealthCheckResponse | undefined
    >(request);
    return response?.ok === true;
  } catch {
    return false;
  }
}
