import { useCallback, useEffect, useState } from "react";
import { useMountedState } from "react-use";

import { DEFAULT_SETTINGS, type Settings } from "@/domain/settings";
import { ChromeStorageSettingsRepository } from "@/infrastructure/storage/ChromeStorageSettingsRepository";

const repo = new ChromeStorageSettingsRepository();

export interface UseSettings {
  /** Defaults until the first read resolves. */
  settings: Settings;
  loaded: boolean;
  /** Updates local state optimistically. */
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

/** Mirrors `chrome.storage.sync` (the source of truth), including changes from other contexts. */

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const isMounted = useMountedState();

  useEffect(() => {
    void repo.getAll().then((value) => {
      if (!isMounted()) return;
      setSettings(value);
      setLoaded(true);
    });
    return repo.onChange((value) => {
      if (isMounted()) setSettings(value);
    });
  }, [isMounted]);

  const update = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      await repo.set(key, value);
    },
    [],
  );

  return { settings, loaded, update };
}
