import { AppState } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHealthQualification } from '../../mobile/lib/health-connect/qualification';
vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: vi.fn() } }));
const h = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn(), upload: vi.fn(), access: vi.fn(), inspect: vi.fn() }));
vi.mock('../../mobile/lib/api/client', () => ({ fetchProviderSelection: h.fetch, saveProviderSelection: h.save, uploadNativeIntake: h.upload }));
vi.mock('../../mobile/lib/health-connect/bridge.android', () => ({ nativeNutritionQualification: { access: h.access, inspect: h.inspect, cancel: vi.fn(), openSettings: async () => true } }));
import { nativeIntake, setNativeIntakeScope } from '../../mobile/lib/native-health/intake.android';
const source = { namespace: 'android_package' as const, id: 'com.cronometer.android.gold' };
async function evidence(origin = source.id) {
  const bridge = createHealthQualification({ androidVersion: 34, status: async () => 3, initialize: async () => true,
    permissions: async () => ['nutrition'], read: async () => ({ records: [{ startTime: '2026-09-10T12:00:00Z', endTime: '2026-09-10T12:01:00Z', energy: { inKilocalories: 100 }, metadata: { id: 'record', dataOrigin: source.id, lastModifiedTime: '2026-09-11T12:00:00Z' } }] }),
    changes: async () => ({ token: 'opaque', changed: false, expired: false, hasMore: false }), settings: async () => true,
  }, () => new Date('2026-09-11T15:00:00Z'), ['nutrition']);
  bridge.setAccountScope('test');
  return bridge.inspect(origin);
}
beforeEach(() => {
  vi.resetAllMocks(); AppState.currentState = 'active'; setNativeIntakeScope(null); setNativeIntakeScope('account-a');
  h.fetch.mockResolvedValue({ expenditure: { authoritativeProvider: 'google_health_fitbit' }, activityContext: { authoritativeProvider: 'google_health_fitbit' }, intake: { authoritativeProvider: 'health_connect', nativeIntakeSource: source, selectionRevision: '2026-09-11T11:00:00.000Z' }, connectedProviders: [] });
  h.access.mockResolvedValue({ state: 'available', granted: ['nutrition'], missing: [] });
  h.inspect.mockImplementation((origin?: string) => evidence(origin));
});
describe('Android consumer nutrition boundary', () => {
  it('uploads only exact-origin normalized eight-date evidence with the server selection revision', async () => {
    expect(await nativeIntake.refresh()).toBe('ready');
    const input = h.upload.mock.calls[0]![0];
    expect(input.source).toEqual(source); expect(input.days).toHaveLength(8);
    expect(input.selectionRevision).toBe('2026-09-11T11:00:00.000Z');
    expect(JSON.stringify(input)).not.toMatch(/caloriesBurned|metadata|record|token/);
  });
  it('does not upload unqualified or revoked-permission evidence', async () => {
    const report = await evidence();
    for (const invalid of [{ ...report, readConsistency: 'unproven' }, { ...report, state: 'query_failed' }, { ...report, access: { state: 'permissions_missing', granted: [], missing: ['nutrition'] } }]) {
      h.inspect.mockResolvedValue(invalid); expect(await nativeIntake.refresh()).not.toBe('ready');
    }
    expect(h.upload).not.toHaveBeenCalled();
  });
  it('keeps the selected writer empty when only a different writer has calories', async () => {
    h.fetch.mockResolvedValue({ intake: { authoritativeProvider: 'health_connect', nativeIntakeSource: { ...source, id: 'com.other.food' }, selectionRevision: '2026-09-11T11:00:00.000Z' } });
    expect(await nativeIntake.refresh()).toBe('empty');
    expect(h.upload.mock.calls[0]![0].days.every((d: { totalCaloriesConsumed: number | null }) => d.totalCaloriesConsumed === null)).toBe(true);
  });
  it('requires discovery before selection and changes only the intake role', async () => {
    expect(await nativeIntake.select(source)).toBe('retry_required'); expect(h.save).not.toHaveBeenCalled();
    await nativeIntake.discover(); await nativeIntake.select(source);
    expect(h.save).toHaveBeenCalledWith({ selectionRole: 'eaten', authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeActivityProvider: 'google_health_fitbit', authoritativeIntakeProvider: 'health_connect', nativeIntakeSource: source });
  });
  it('invalidates pending reads and discovered choices across account switches', async () => {
    await nativeIntake.discover();
    h.inspect.mockImplementation(async () => { setNativeIntakeScope('account-b'); return evidence(); });
    expect(await nativeIntake.refresh()).toBe('skipped'); expect(h.upload).not.toHaveBeenCalled();
    expect(await nativeIntake.select(source)).toBe('retry_required'); expect(h.save).not.toHaveBeenCalled();
  });
  it('does not read device nutrition when FatSecret is authoritative', async () => {
    h.fetch.mockResolvedValue({ intake: { authoritativeProvider: 'fatsecret' } });
    expect(await nativeIntake.refresh()).toBe('skipped'); expect(h.inspect).not.toHaveBeenCalled(); expect(h.upload).not.toHaveBeenCalled();
  });
});

describe('forward-compatible nutrition firewall', () => {
  it('does not discover, upload, select or reconnect for a future authority', async () => {
    h.fetch.mockResolvedValue({ intake: { selected: true, authoritativeProvider: 'manual_estimate', status: 'ready', selectionRevision: '2026-09-20T12:00:00.000Z', refreshPlan: [{ localDate: '2026-09-20', provider: 'manual_estimate', writerId: null, sourceId: null }] } });
    expect(await nativeIntake.refresh()).toBe('skipped');
    expect(h.inspect).not.toHaveBeenCalled();
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
    setNativeIntakeScope('account-b');
    expect(await nativeIntake.select(source)).toBe('retry_required');
    setNativeIntakeScope(null);
    expect(await nativeIntake.refresh()).toBe('skipped');
    expect(h.save).not.toHaveBeenCalled();
  });
  it('refreshes an authorized historical native writer without replacing current direct authority', async () => {
    h.fetch.mockResolvedValue({ intake: { authoritativeProvider: 'fatsecret', selectionRevision: '2026-09-11T11:00:00.000Z', refreshPlan: [{ localDate: '2026-09-10', provider: 'health_connect', sourceId: source.id, writerId: null }] } });
    expect(await nativeIntake.refresh()).toBe('ready');
    expect(h.inspect).toHaveBeenCalledWith(source.id);
    expect(h.save).not.toHaveBeenCalled();
  });
});

it('reports a pre-read account interruption as failed, never successful empty discovery', async () => {
  h.access.mockImplementation(async () => {
    setNativeIntakeScope('account-b');
    return { state: 'available', granted: ['nutrition'], missing: [] };
  });
  expect(await nativeIntake.discover()).toMatchObject({ sources: [], queryState: 'failed' });
  expect(h.inspect).not.toHaveBeenCalled();
});

it('discovers Cronometer without reopening granted permissions and cancelling on background', async () => {
  const permission = { state: 'available', granted: ['nutrition'], missing: [] };
  h.access.mockImplementation(async (request?: boolean) => {
    // The permission activity backgrounds the app; the lifecycle cancels native work.
    if (request) nativeIntake.cancel();
    return permission;
  });
  const report = await evidence();
  h.inspect.mockResolvedValue({ ...report, origins: [{ namespace: 'android_package', id: 'com.cronometer.android.gold' }] });
  const result = await nativeIntake.discover(true);
  expect(h.access).not.toHaveBeenCalledWith(true);
  expect(h.inspect).toHaveBeenCalledOnce();
  expect(result.sources.map((item) => item.source.id)).toEqual(['com.cronometer.android.gold']);
});

it('still requests missing nutrition permission explicitly and never reads after denial', async () => {
  h.access.mockResolvedValue({ state: 'permissions_missing', granted: [], missing: ['nutrition'] });
  expect(await nativeIntake.discover(true)).toMatchObject({ sources: [], queryState: 'failed' });
  expect(h.access).toHaveBeenNthCalledWith(1);
  expect(h.access).toHaveBeenNthCalledWith(2, true);
  expect(h.inspect).not.toHaveBeenCalled();
  expect(h.save).not.toHaveBeenCalled();
});

 it.each(['approve', 'signout', 'switch', 'unmount'] as const)('handles first permission return: %s', async (outcome) => {
  h.access.mockImplementation(async (request?: boolean) => {
    if (!request) return { state: 'permissions_missing', granted: [], missing: ['nutrition'] };
    nativeIntake.cancel('background');
    if (outcome === 'signout') setNativeIntakeScope(null);
    if (outcome === 'switch') setNativeIntakeScope('account-b');
    if (outcome === 'unmount') nativeIntake.cancel();
    return { state: 'available', granted: ['nutrition'], missing: [] };
  });
  const result = await nativeIntake.discover(true);
  if (outcome === 'approve') {
    expect(result.sources).toHaveLength(1);
    expect(h.inspect).toHaveBeenCalledOnce();
    expect(await nativeIntake.select(source)).toBe('ready');
    expect(h.upload).toHaveBeenCalledOnce();
  } else {
    expect(result.queryState).toBe('failed');
    expect(h.inspect).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
    expect(h.upload).not.toHaveBeenCalled();
  }
});

it('waits for foreground after approval before reading or uploading', async () => {
  let resume: (() => void) | undefined;
  const remove = vi.fn();
  vi.mocked(AppState.addEventListener).mockImplementation((_event, listener) => {
    resume = () => listener('active');
    return { remove };
  });
  h.access.mockImplementation(async (request?: boolean) => {
    if (!request) return { state: 'permissions_missing', granted: [], missing: ['nutrition'] };
    AppState.currentState = 'background'; nativeIntake.cancel('background');
    return { state: 'available', granted: ['nutrition'], missing: [] };
  });
  const pending = nativeIntake.discover(true);
  await vi.waitFor(() => expect(resume).toBeDefined());
  expect(h.inspect).not.toHaveBeenCalled();
  expect(await nativeIntake.refresh()).toBe('skipped');
  AppState.currentState = 'active'; resume!();
  expect((await pending).sources).toHaveLength(1);
  expect(remove).toHaveBeenCalledOnce();
  expect(h.inspect).toHaveBeenCalledOnce();
});
