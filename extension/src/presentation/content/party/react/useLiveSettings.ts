import { useEffect, useState } from "react";

import type { Settings } from "@/domain/settings";

/** Delivers the current settings once, then every change. Returns the unsubscribe. */
export type SettingsSubscribe = (cb: (s: Settings) => void) => () => void;

/** `initial` covers the render before the first delivery. */
export function useLiveSettings(
  initial: Settings,
  subscribe: SettingsSubscribe,
): Settings {
  const [settings, setSettings] = useState(initial);
  useEffect(() => subscribe(setSettings), [subscribe]);
  return settings;
}
