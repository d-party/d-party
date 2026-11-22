import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A flag that turns itself off `durationMs` after `raise()`. Raising it again
 * restarts the countdown, and unmounting cancels it.
 */
export function useTransientFlag(durationMs: number): [boolean, () => void] {
  const [raised, setRaised] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const raise = useCallback(() => {
    window.clearTimeout(timer.current);
    setRaised(true);
    timer.current = window.setTimeout(() => setRaised(false), durationMs);
  }, [durationMs]);

  return [raised, raise];
}
