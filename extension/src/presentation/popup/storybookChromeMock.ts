/**
 * In-memory `chrome.storage.sync` / `chrome.storage.local` / `chrome.runtime` for
 * Storybook, which runs outside the extension. Call it from a decorator so each
 * story gets its own stores seeded with `initial` (sync) and `initialLocal`.
 */
export function installChromeMock(
  initial: Record<string, unknown> = {},
  initialLocal: Record<string, unknown> = {},
): void {
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      sync: storageArea(initial),
      local: storageArea(initialLocal),
    },
    runtime: {
      getManifest: () => ({ version: "1.0.0" }),
      openOptionsPage: () => Promise.resolve(),
    },
  };
}

function storageArea(initial: Record<string, unknown>) {
  const store: Record<string, unknown> = { ...initial };
  const listeners = new Set<(changes: Record<string, unknown>) => void>();
  return {
    get: (keys: string | string[]) =>
      Promise.resolve(
        Object.fromEntries(
          [keys]
            .flat()
            .filter((key) => key in store)
            .map((key) => [key, store[key]]),
        ),
      ),
    set: (items: Record<string, unknown>) => {
      const changes = Object.fromEntries(
        Object.entries(items).map(([key, newValue]) => [
          key,
          { oldValue: store[key], newValue },
        ]),
      );
      Object.assign(store, items);
      listeners.forEach((listener) => listener(changes));
      return Promise.resolve();
    },
    onChanged: {
      addListener: (cb: (changes: Record<string, unknown>) => void) =>
        listeners.add(cb),
      removeListener: (cb: (changes: Record<string, unknown>) => void) =>
        listeners.delete(cb),
    },
  };
}
