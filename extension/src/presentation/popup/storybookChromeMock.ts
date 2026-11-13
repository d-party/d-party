/**
 * In-memory `chrome.storage.sync` / `chrome.runtime` for Storybook, which runs
 * outside the extension. Call it from a decorator so each story gets its own
 * store seeded with `initial`.
 */
export function installChromeMock(initial: Record<string, unknown> = {}): void {
  const store: Record<string, unknown> = { ...initial };
  const listeners = new Set<(changes: Record<string, unknown>) => void>();
  const mock = {
    storage: {
      sync: {
        get: (keys: string[]) =>
          Promise.resolve(
            Object.fromEntries(
              keys.filter((key) => key in store).map((key) => [key, store[key]]),
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
      },
    },
    runtime: { getManifest: () => ({ version: "1.0.0" }) },
  };
  (globalThis as { chrome?: unknown }).chrome = mock;
}
