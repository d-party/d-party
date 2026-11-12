import { useCallback, useEffect, useState } from "react";
import { useMountedState } from "react-use";

import { emptyStats, type PersonalStats } from "@/domain/personalStats";
import { ChromePersonalStatsRepository } from "@/infrastructure/storage/ChromePersonalStatsRepository";

const repo = new ChromePersonalStatsRepository();

export interface UsePersonalStats {
  /** Zeros until the first read resolves. */
  stats: PersonalStats;
  loaded: boolean;
  reset: () => Promise<void>;
}

/** Follows writes from other contexts (e.g. the player content script). */

export function usePersonalStats(): UsePersonalStats {
  const [stats, setStats] = useState<PersonalStats>(emptyStats);
  const [loaded, setLoaded] = useState(false);
  const isMounted = useMountedState();

  useEffect(() => {
    void repo.getAll().then((value) => {
      if (!isMounted()) return;
      setStats(value);
      setLoaded(true);
    });
    return repo.onChange((value) => {
      if (isMounted()) setStats(value);
    });
  }, [isMounted]);

  const reset = useCallback(async () => {
    setStats(emptyStats());
    await repo.reset();
  }, []);

  return { stats, loaded, reset };
}
