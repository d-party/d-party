import { useCallback, useEffect, useState } from "react";

import { DEFAULT_SETTINGS, type Settings } from "@/domain/settings";
import { ChromeStorageSettingsRepository } from "@/infrastructure/storage/ChromeStorageSettingsRepository";

const repo = new ChromeStorageSettingsRepository();

export type UpdateSetting = <K extends keyof Settings>(
  key: K,
  value: Settings[K],
) => Promise<void>;

export interface UseSettings {
  /** Defaults until the first read resolves. */
  settings: Settings;
  /** Updates local state optimistically. Never rejects: a refused write is rolled back. */
  update: UpdateSetting;
}

/** Mirrors `chrome.storage.sync` (the source of truth), including changes from other contexts. */
export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    const apply = (value: Settings): void => {
      if (active) setSettings(value);
    };
    const unsubscribe = repo.onChange(apply);
    repo.getAll().then(apply, () => undefined);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const update = useCallback<UpdateSetting>(async (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await repo.set(key, value);
    } catch {
      // The write was refused (e.g. the sync quota): show what is really stored.
      await repo.getAll().then(setSettings, () => undefined);
    }
  }, []);

  return { settings, update };
}
