import { afterEach, expect, it, vi } from 'vitest';
import { subscribeToLocalDateChange } from '../../mobile/lib/today/local-date-change';

afterEach(() => vi.useRealTimers());
it('refreshes once on a local civil-date change and cleans up its timer', async () => {
  vi.useFakeTimers();
  let now = new Date(2026, 8, 23, 23, 59, 45);
  const refresh = vi.fn();
  const stop = subscribeToLocalDateChange(refresh, () => now);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(refresh).not.toHaveBeenCalled();
  now = new Date(2026, 8, 24, 0, 0, 15);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(refresh).toHaveBeenCalledOnce();
  stop();
  expect(vi.getTimerCount()).toBe(0);
});
