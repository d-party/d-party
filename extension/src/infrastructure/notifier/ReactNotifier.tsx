import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

import type { Notifier } from "@/application/ports";
import { attachShadowStyles } from "@/presentation/content/party/react/shadowStyles";
import {
  type SidebarStore,
  sidebarWidth,
} from "@/presentation/content/party/react/sidebarStore";
import {
  Toast,
  ToastBody,
  ToastClose,
  ToastIcon,
  ToastViewport,
  type ToastVariant,
} from "@d-party/ui";

interface ToastItemData {
  id: number;
  variant: ToastVariant;
  /** 他人の表示名を含むので、HTML として解釈しない。 */
  message: string;
}

const DEFAULT_DURATION_MS = 3000;
const EXIT_ANIMATION_MS = 180;

class ToastStore {
  private toasts: readonly ToastItemData[] = [];
  private seq = 0;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): readonly ToastItemData[] => this.toasts;

  push(variant: ToastVariant, message: string): void {
    this.toasts = [...this.toasts, { id: ++this.seq, variant, message }];
    this.emit();
  }

  remove = (id: number): void => {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit();
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastItemData;
  /** Must be stable: a new identity would restart the exit timer. */
  onClose: (id: number) => void;
}): React.JSX.Element {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), DEFAULT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => onClose(toast.id), EXIT_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, onClose, toast.id]);

  return (
    <Toast
      variant={toast.variant}
      className={leaving ? "translate-x-2 opacity-0" : "translate-x-0 opacity-100"}
    >
      <ToastIcon variant={toast.variant} />
      <ToastBody>{toast.message}</ToastBody>
      <ToastClose onClick={() => setLeaving(true)} />
    </Toast>
  );
}

function Toaster({
  store,
  sidebarStore,
}: {
  store: ToastStore;
  sidebarStore: SidebarStore;
}): React.JSX.Element {
  const toasts = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const offset = useSyncExternalStore(sidebarStore.subscribe, () =>
    sidebarWidth(sidebarStore.getSnapshot()),
  );
  return (
    <ToastViewport style={{ right: `calc(${offset}px + 1rem)` }}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={store.remove} />
      ))}
    </ToastViewport>
  );
}

/** Toasts in their own Shadow DOM, kept left of the sidebar. */
export class ReactNotifier implements Notifier {
  private readonly store = new ToastStore();

  constructor(sidebarStore: SidebarStore) {
    const host = document.createElement("div");
    host.id = "d-party-toast-host";
    host.style.cssText =
      "position:fixed;top:0;right:0;z-index:2147483646;pointer-events:none;";
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    attachShadowStyles(shadow);

    const mountPoint = document.createElement("div");
    shadow.appendChild(mountPoint);
    createRoot(mountPoint).render(
      <Toaster store={this.store} sidebarStore={sidebarStore} />,
    );
  }

  success(message: string): void {
    this.store.push("success", message);
  }

  info(message: string): void {
    this.store.push("info", message);
  }

  alert(message: string): void {
    this.store.push("alert", message);
  }
}
