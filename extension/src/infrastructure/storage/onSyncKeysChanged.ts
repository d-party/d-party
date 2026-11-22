/**
 * Runs `reload` when one of `keys` changes in `chrome.storage.sync`. Settings and
 * stats share the area, so an unfiltered listener would re-read on every write
 * of the other. A failed re-read (the extension was reloaded under a live
 * content script) is dropped: the last value stays in use.
 */
export function onSyncKeysChanged(
  keys: readonly string[],
  reload: () => Promise<void>,
): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (!keys.some((key) => key in changes)) return;
    reload().catch(() => undefined);
  };
  chrome.storage.sync.onChanged.addListener(handler);
  return () => chrome.storage.sync.onChanged.removeListener(handler);
}
