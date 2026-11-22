import { useCallback, useEffect, useState } from "react";

import { emptyStats, type PersonalStats } from "@/domain/personalStats";
import { ChromePersonalStatsRepository } from "@/infrastructure/storage/ChromePersonalStatsRepository";

const repo = new ChromePersonalStatsRepository();

export interface UsePersonalStats {
  /** Zeros until the first read resolves. */
  stats: PersonalStats;
  reset: () => Promise<void>;
}

/** Follows writes from other contexts (e.g. the player content script). */
export function usePersonalStats(): UsePersonalStats {
  const [stats, setStats] = useState<PersonalStats>(emptyStats);

  useEffect(() => {
    let active = true;
    const apply = (value: PersonalStats): void => {
      if (active) setStats(value);
    };
    const unsubscribe = repo.onChange(apply);
    repo.getAll().then(apply, () => undefined);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const reset = useCallback(async () => {
    setStats(emptyStats());
    await repo.reset();
  }, []);

  return { stats, reset };
}
