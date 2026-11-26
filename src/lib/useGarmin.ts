import { useCallback, useEffect, useRef, useState } from "react";
import { getGarminDays, getGarminStatus, syncGarmin } from "./api";
import type { GarminDay, GarminStatus } from "../types";

const POLL_MS = 2500;

export type Garmin = {
  status: GarminStatus | null;
  days: GarminDay[];
  error: string | null;
  sync: (days: number) => Promise<void>;
  refresh: () => Promise<void>;
};

/** Garmin sign-in state and daily sleep/health values, shared by every page. */
export function useGarmin(): Garmin {
  const [status, setStatus] = useState<GarminStatus | null>(null);
  const [days, setDays] = useState<GarminDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number>();

  const refresh = useCallback(async () => {
    window.clearTimeout(timer.current);
    try {
      const next = await getGarminStatus();
      setStatus(next);
      setDays(await getGarminDays());
      setError(null);
      // Days are saved one at a time, so charts fill in while the sync runs.
      if (next.syncing) timer.current = window.setTimeout(() => void refresh(), POLL_MS);
    } catch {
      setError("Couldn't load Garmin data from the backend.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Notice a sign-in done in the terminal when the person comes back to the tab.
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearTimeout(timer.current);
    };
  }, [refresh]);

  const sync = useCallback(
    async (count: number) => {
      try {
        await syncGarmin(count);
        await refresh();
      } catch {
        setError("Couldn't start the Garmin sync.");
      }
    },
    [refresh]
  );

  return { status, days, error, sync, refresh };
}
