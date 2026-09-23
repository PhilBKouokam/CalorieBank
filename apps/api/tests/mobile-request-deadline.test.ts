import { afterEach, expect, it, vi } from 'vitest';
import { fetchPlannedTreat, setApiAccessTokenProvider } from '../../mobile/lib/api/client';
import { isUpdateRequired } from '../../mobile/lib/api/protocol-state';

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

it('advertises capability and treats update-required as compatibility, preserving session for retry', async () => {
  setup(async () => 'token');
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 426 })
    .mockResolvedValue({ ok: true, status: 200, json: async () => emptyPlan });
  vi.stubGlobal('fetch', fetcher);
  await expect(fetchPlannedTreat()).rejects.toMatchObject({ kind: 'update_required', code: 'UPDATE_REQUIRED', message: 'Update CalorieBank to continue with this account.' });
  expect(isUpdateRequired()).toBe(true);
  await expect(fetchPlannedTreat()).resolves.toEqual(emptyPlan);
  expect(fetcher.mock.calls[0]?.[1].headers).toMatchObject({
    'x-caloriebank-capabilities': 'intake-authority-v2', Authorization: 'Bearer token',
  });
  setApiAccessTokenProvider(async () => 'B-token', { ready: true, activeSessionPresent: true }, 'B');
  expect(isUpdateRequired()).toBe(false);
});

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

it('rejects a delayed response body from the previous account', async () => {
  setup(async () => 'A-token');
  let resolveBody!: (value: unknown) => void;
  const json = vi.fn(() => new Promise(resolve => { resolveBody = resolve; }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json }));
  const failed = expect(fetchPlannedTreat()).rejects.toMatchObject({ name: 'ApiAuthenticationPendingError' });
  await vi.advanceTimersByTimeAsync(0);
  expect(json).toHaveBeenCalledOnce();
  setApiAccessTokenProvider(async () => 'B-token', { ready: true, activeSessionPresent: true }, 'B');
  resolveBody(emptyPlan);
  await failed;
});
