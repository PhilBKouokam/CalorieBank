import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHealthQualification } from '../../mobile/lib/health-connect/qualification';
const h = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn(), upload: vi.fn(), access: vi.fn(), inspect: vi.fn() }));
vi.mock('../../mobile/lib/api/client', () => ({ fetchProviderSelection: h.fetch, saveProviderSelection: h.save, uploadNativeIntake: h.upload }));
vi.mock('../../mobile/lib/health-connect/bridge.android', () => ({ nativeNutritionQualification: { access: h.access, inspect: h.inspect, cancel: vi.fn(), openSettings: async () => true } }));
import { nativeIntake, setNativeIntakeScope } from '../../mobile/lib/native-health/intake.android';
const source = { namespace: 'android_package' as const, id: 'com.sbs.diet' };
async function evidence(origin = source.id) {
  const bridge = createHealthQualification({ androidVersion: 34, status: async () => 3, initialize: async () => true,
    permissions: async () => ['nutrition'], read: async () => ({ records: [{ startTime: '2026-09-10T12:00:00Z', endTime: '2026-09-10T12:01:00Z', energy: { inKilocalories: 100 }, metadata: { id: 'record', dataOrigin: source.id, lastModifiedTime: '2026-09-11T12:00:00Z' } }] }),
    changes: async () => ({ token: 'opaque', changed: false, expired: false, hasMore: false }), settings: async () => true,
  }, () => new Date('2026-09-11T15:00:00Z'), ['nutrition']);
  bridge.setAccountScope('test');
  return bridge.inspect(origin);
}
beforeEach(() => {
  vi.resetAllMocks(); setNativeIntakeScope(null); setNativeIntakeScope('account-a');
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
