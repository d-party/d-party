import { createRoot } from "react-dom/client";

import type { RoomSettings } from "@/domain/roomSettings";
import type {
  HealthCheckRequest,
  HealthCheckResponse,
} from "@/infrastructure/messages";
import { PortalContainerContext } from "@d-party/ui";

import { Sidebar } from "./Sidebar";
import {
  SidebarController,
  SidebarStore,
  type SidebarTab,
} from "./sidebarStore";

export interface SidebarHandlers {
  onCreateRoom: () => void;
  onLeave: () => void;
  onDeleteRoom: () => void;
  onUpdateRoomSettings: (settings: RoomSettings) => void;
  onTabChange?: (tab: SidebarTab) => void;
}

export interface MountedSidebar {
  store: SidebarStore;
  controller: SidebarController;
}

const EXPANDED_WIDTH = 320;
const COLLAPSED_WIDTH = 44;

export const SIDEBAR_WIDTHS = {
  expanded: EXPANDED_WIDTH,
  collapsed: COLLAPSED_WIDTH,
} as const;

export function sidebarWidth(state: {
  visible: boolean;
  collapsed: boolean;
  mode: "create" | "join" | "normal";
}): number {
  if (!state.visible || state.mode === "normal") return 0;
  return state.collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
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
    const state = store.getSnapshot();
    host.style.width = `${sidebarWidth(state)}px`;
  };
  applyWidth();
  store.subscribe(applyWidth);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  shadow.appendChild(style);
  void fetch(chrome.runtime.getURL("js/sidebar-style.css"))
    .then((response) => response.text())
    .then((css) => {
      style.textContent = css;
    });

  const mountPoint = document.createElement("div");
  mountPoint.style.height = "100%";
  shadow.appendChild(mountPoint);

  createRoot(mountPoint).render(
    <PortalContainerContext.Provider value={mountPoint}>
      <Sidebar
        store={store}
        onCreateRoom={handlers.onCreateRoom}
        onLeave={handlers.onLeave}
        onDeleteRoom={handlers.onDeleteRoom}
        onUpdateRoomSettings={handlers.onUpdateRoomSettings}
        onTabChange={handlers.onTabChange}
      />
    </PortalContainerContext.Provider>,
  );

  scheduleHealthCheck(store);

  return { store, controller };
}

/**
 * 初回表示時に 1 度だけヘルスチェックし、失敗したら `"maintenance"` にする。
 *
 * fetch は background に任せる。公開ページから localhost への fetch は Chrome の
 * Local Network Access で止められるが、host_permissions を持つ background は通る。
 */

function scheduleHealthCheck(store: SidebarStore): void {
  let done = false;
  const unsubscribe = store.subscribe(() => {
    if (done) return;
    const { visible } = store.getSnapshot();
    if (!visible) return;
    done = true;
    unsubscribe();
    const request: HealthCheckRequest = { type: "healthCheck" };
    chrome.runtime.sendMessage(request, (response?: HealthCheckResponse) => {
      if (chrome.runtime.lastError || !response?.ok) {
        store.setConnectionStatus("maintenance");
      }
    });
  });
}
