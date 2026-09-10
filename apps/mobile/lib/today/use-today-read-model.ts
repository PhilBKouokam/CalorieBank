import { useEffect, useState } from 'react';
import type { TodayResponse } from '@caloriebank/schemas';
import { fetchToday } from '@/lib/api/client';
import { subscribeToAccountLifecycle } from '@/lib/lifecycle/account-lifecycle';

// Read-only consumers never initiate another provider refresh.
export function useTodayReadModel() {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let generation = 0;
    let mounted = true;
    async function load() {
      const request = ++generation;
      try {
        const value = await fetchToday(Intl.DateTimeFormat().resolvedOptions().timeZone);
        if (mounted && request === generation) { setToday(value); setFailed(false); }
      } catch { if (mounted && request === generation) setFailed(true); }
    }
    void load();
    const unsubscribe = subscribeToAccountLifecycle((result) => { if (result.status !== 'skipped') void load(); });
    return () => { mounted = false; generation += 1; unsubscribe(); };
  }, []);
  return { today, failed: !today && failed };
}
