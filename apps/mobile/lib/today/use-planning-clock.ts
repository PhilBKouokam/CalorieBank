import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { TodayResponse } from '@caloriebank/schemas';

export function usePlanningClock(projection: TodayResponse['restOfDayProjection'] | undefined) {
  const [now, setNow] = useState(() => new Date());
  const expires = projection?.planningExpiresAt ?? (projection?.coverageAt ? new Date(new Date(projection.coverageAt).getTime() + 30 * 60000).toISOString() : null);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const timer = setInterval(refresh, 30_000);
    const deadline = expires ? setTimeout(refresh, Math.min(2147483647, Math.max(0, new Date(expires).getTime() - Date.now() + 1))) : null;
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); if (deadline !== null) clearTimeout(deadline); subscription.remove(); };
  }, [expires]);
  const anchor = projection?.planningAnchorAt ?? projection?.coverageAt;
  return { now, expired: projection?.status === 'stale' || Boolean(expires && now.getTime() > new Date(expires).getTime()) || Boolean(anchor && new Date(anchor) > now) };
}
