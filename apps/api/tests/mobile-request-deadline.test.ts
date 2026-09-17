import { afterEach, expect, it, vi } from 'vitest';
import { fetchPlannedTreat, setApiAccessTokenProvider } from '../../mobile/lib/api/client';

afterEach(() => {
  setApiAccessTokenProvider(null);
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('ends Banking Goal loading when session token retrieval never settles offline', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('__DEV__', false);
  vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://example.invalid');
  vi.stubEnv('EXPO_PUBLIC_AUTH_MODE', 'clerk');
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  setApiAccessTokenProvider(() => new Promise(() => {}), { ready: true, activeSessionPresent: true }, 'A');
  let outcome = 'pending';
  void fetchPlannedTreat().then(() => { outcome = 'success'; }, () => { outcome = 'error'; });
  await vi.advanceTimersByTimeAsync(20_001);
  expect(outcome).toBe('error');
  expect(fetcher).not.toHaveBeenCalled();
});

function setup(token: () => Promise<string | null>) {
  vi.useFakeTimers();
  vi.stubGlobal('__DEV__', false);
  vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://example.invalid');
  vi.stubEnv('EXPO_PUBLIC_AUTH_MODE', 'clerk');
  setApiAccessTokenProvider(token, { ready: true, activeSessionPresent: true }, 'A');
}
const emptyPlan = { status: 'no_plan', plannedTreat: null, availableBankCalories: 0 };

it('never starts a request with a token arriving after the deadline, and retry succeeds', async () => {
  let resolveToken!: (token: string) => void;
  setup(() => new Promise(resolve => { resolveToken = resolve; }));
  const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => emptyPlan });
  vi.stubGlobal('fetch', fetcher);
  const failed = expect(fetchPlannedTreat()).rejects.toMatchObject({ kind: 'timeout' });
  await vi.advanceTimersByTimeAsync(20_001);
  await failed;
  resolveToken('late-token');
  await Promise.resolve();
  expect(fetcher).not.toHaveBeenCalled();
  setApiAccessTokenProvider(async () => 'fresh-token', { ready: true, activeSessionPresent: true }, 'A');
  await expect(fetchPlannedTreat()).resolves.toEqual(emptyPlan);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('bounds a network request even if the native fetch ignores abort', async () => {
  setup(async () => 'token');
  const fetcher = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal('fetch', fetcher);
  const failed = expect(fetchPlannedTreat()).rejects.toMatchObject({ kind: 'timeout' });
  await vi.advanceTimersByTimeAsync(20_001);
  await failed;
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('rejects an old account token without sending it after account switching', async () => {
  let resolveToken!: (token: string) => void;
  setup(() => new Promise(resolve => { resolveToken = resolve; }));
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const failed = expect(fetchPlannedTreat()).rejects.toMatchObject({ name: 'ApiAuthenticationPendingError' });
  setApiAccessTokenProvider(async () => 'B-token', { ready: true, activeSessionPresent: true }, 'B');
  resolveToken('A-token'); await failed;
  expect(fetcher).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
