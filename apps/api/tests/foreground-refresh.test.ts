import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
const api = vi.hoisted(() => ({ server: vi.fn(), apple: vi.fn() }));
vi.mock('../../mobile/lib/api/client', () => ({ runForegroundLifecycle: api.server, fetchBankSummary: vi.fn() }));
vi.mock('../../mobile/lib/healthkit/healthkit-connection', () => ({
  getAppleHealthConnectionStatus: async () => 'connected', syncAppleHealthToday: api.apple,
}));
type Result = { status: string; detail: string | null };
type Lifecycle = {
  pauseAccountLifecycle: () => void; resumeAccountLifecycle: () => void;
  resetAccountLifecycle: (scope: string | null) => void;
  refreshOnAppState: (state: string) => Promise<Result>;
  runAccountLifecycle: (options?: { force?: boolean }) => Promise<Result>;
  subscribeToAccountLifecycleActivity: (listener: (running: boolean) => void) => () => void;
  subscribeToAccountLifecycle: (listener: (result: Result) => void) => () => void;
};
let lifecycle: Lifecycle;
const pauseAccountLifecycle = () => lifecycle.pauseAccountLifecycle();
const resumeAccountLifecycle = () => lifecycle.resumeAccountLifecycle();
const resetAccountLifecycle = (scope: string | null) => lifecycle.resetAccountLifecycle(scope);
const refreshOnAppState = (state: string) => lifecycle.refreshOnAppState(state);
const runAccountLifecycle = (options?: { force?: boolean }) => lifecycle.runAccountLifecycle(options);
const subscribeToAccountLifecycle = (listener: (result: Result) => void) => lifecycle.subscribeToAccountLifecycle(listener);
const ready = { shouldSyncHealthKit: true, historyDayCount: 3, errors: [] };
beforeEach(async () => {
  lifecycle = await import(resolve(__dirname, '../../mobile/lib/lifecycle/account-lifecycle.ts')) as Lifecycle;
  resetAccountLifecycle(null); resetAccountLifecycle('A');
  api.server.mockReset().mockResolvedValue(ready); api.apple.mockReset().mockResolvedValue(undefined);
});
describe('one account-owned foreground refresh', () => {
  it('reports loading before slow providers complete and clears it after failure or success', async () => {
    let finish!: (value: typeof ready) => void;
    api.server.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const observed = vi.fn(); const off = lifecycle.subscribeToAccountLifecycleActivity(observed);
    const pending = refreshOnAppState('active');
    expect(observed.mock.calls.map(call => call[0])).toEqual([false, true]);
    expect(api.apple).not.toHaveBeenCalled();
    finish(ready); await pending;
    expect(observed).toHaveBeenLastCalledWith(false);
    api.server.mockRejectedValueOnce(new Error('offline'));
    await runAccountLifecycle({ force: true });
    expect(observed.mock.calls.map(call => call[0])).toEqual([false, true, false, true, false]);
    off();
  });
  it('refreshes on cold open and each actual transition, not duplicate active events', async () => {
    await refreshOnAppState('active'); await refreshOnAppState('active');
    expect(api.server).toHaveBeenCalledTimes(1);
    await refreshOnAppState('background'); await refreshOnAppState('active');
    expect(api.server).toHaveBeenCalledTimes(2);
    expect(api.apple).toHaveBeenLastCalledWith(expect.objectContaining({ force: true, trigger: 'app_foreground' }));
  });
  it('multiple consumers observe one run without starting more provider requests', async () => {
    const a = vi.fn(), b = vi.fn(); const offA = subscribeToAccountLifecycle(a), offB = subscribeToAccountLifecycle(b);
    await refreshOnAppState('active');
    expect(api.server).toHaveBeenCalledTimes(1); expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(1);
    offA(); offB();
  });
  it('queues one fresh pass when returning during an older refresh', async () => {
    let finish!: (value: typeof ready) => void;
    api.server.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = refreshOnAppState('active');
    await refreshOnAppState('background');
    const second = refreshOnAppState('active');
    await refreshOnAppState('active');
    expect(api.server).toHaveBeenCalledTimes(1);
    finish(ready); await first; await second;
    expect(api.server).toHaveBeenCalledTimes(2);
  });
  it('serializes an overlapping manual refresh, coalescing repeated requests', async () => {
    let finish!: (value: typeof ready) => void;
    api.server.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = refreshOnAppState('active');
    const manual = runAccountLifecycle({ force: true });
    expect(runAccountLifecycle({ force: true })).toBe(manual);
    expect(api.server).toHaveBeenCalledTimes(1);
    finish(ready); await first; await manual;
    expect(api.server).toHaveBeenCalledTimes(2);
  });
  it('invalidates an old account response and skips old HealthKit work', async () => {
    let finish!: (value: typeof ready) => void;
    api.server.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const observed = vi.fn(); const off = subscribeToAccountLifecycle(observed);
    const old = refreshOnAppState('active'); resetAccountLifecycle('B'); finish(ready); await old;
    expect(api.apple).not.toHaveBeenCalled(); expect(observed).not.toHaveBeenCalled();
    await refreshOnAppState('active'); expect(api.apple).toHaveBeenCalledTimes(1); off();
  });
  it('sign-out immediately prevents refresh and queued work', async () => {
    let finish!: (value: typeof ready) => void;
    api.server.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const old = refreshOnAppState('active'); const queued = runAccountLifecycle({ force: true });
    pauseAccountLifecycle(); finish(ready); await old; await queued;
    await refreshOnAppState('inactive'); await refreshOnAppState('active');
    expect(api.apple).not.toHaveBeenCalled(); expect(api.server).toHaveBeenCalledTimes(1);
    resumeAccountLifecycle(); await refreshOnAppState('inactive'); await refreshOnAppState('active');
    expect(api.apple).toHaveBeenCalledTimes(1);
  });
  it('a transient failure recovers on next foreground rather than a cooldown', async () => {
    api.server.mockRejectedValueOnce(new Error('network'));
    expect((await refreshOnAppState('active')).status).toBe('partial');
    await refreshOnAppState('inactive'); expect((await refreshOnAppState('active')).status).toBe('success');
  });
});
