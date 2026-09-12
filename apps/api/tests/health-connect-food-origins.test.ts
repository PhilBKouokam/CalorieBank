import { describe, expect, it, vi } from 'vitest';
import { createHealthQualification, type HealthEvidencePort } from '../../mobile/lib/health-connect/qualification';
import { discoverFoodOrigins, foodOriginName } from '../../mobile/lib/health-connect/food-origins';

const record = (origin: string, energy: number | null = 100) => ({
  metadata: { id: origin, dataOrigin: origin, lastModifiedTime: '2026-09-11T12:00:00Z' },
  startTime: '2026-09-10T12:00:00Z', endTime: '2026-09-10T12:01:00Z',
  energy: energy === null ? null : { inKilocalories: energy },
});
function service(origins: string[]) {
  const port: HealthEvidencePort = {
    androidVersion: 34, status: async () => 3, initialize: async () => true,
    permissions: async () => ['nutrition', 'steps'],
    read: vi.fn(async () => ({ records: origins.map((id) => record(id)) })),
    changes: vi.fn(async () => ({ token: 'opaque', changed: false, expired: false, hasMore: false })),
    settings: async () => true,
  };
  const bridge = createHealthQualification(port, () => new Date('2026-09-11T15:00:00Z'), ['nutrition']);
  bridge.setAccountScope('test-account');
  return { port, bridge };
}

describe('Android food origin qualification', () => {
  it('treats nutrition denial or revocation as missing access, even with steps permission', async () => {
    const { bridge, port } = service(['com.sbs.diet']);
    port.permissions = async () => ['steps'];
    expect((await bridge.inspect()).state).toBe('access_required');
    expect(port.read).not.toHaveBeenCalled();
    port.permissions = async () => ['nutrition'];
    expect((await bridge.inspect()).state).toBe('complete');
    port.read = async () => { port.permissions = async () => ['steps']; return { records: [record('com.sbs.diet')] }; };
    expect((await bridge.inspect()).days).toEqual([]);
  });
  it('reads only nutrition even when activity permissions were previously granted', async () => {
    const { bridge, port } = service(['com.sbs.diet']);
    const result = await bridge.inspect();
    expect(result.access).toEqual({ state: 'available', granted: ['nutrition'], missing: [] });
    expect(vi.mocked(port.read).mock.calls.map((c) => c[0])).toEqual(['nutrition']);
    expect(port.changes).toHaveBeenCalledWith(['nutrition']);
    expect(discoverFoodOrigins(result, [])).toEqual([{ source: { namespace: 'android_package', id: 'com.sbs.diet' }, displayName: 'MacroFactor' }]);
  });
  it('uses exact package mappings, never a substring or display-label guess', () => {
    expect(foodOriginName('com.cronometer.android.gold')).toBe('Cronometer');
    expect(foodOriginName('com.myfitnesspal.android')).toBe('MyFitnessPal');
    expect(foodOriginName('com.fitnow.loseit')).toBe('Lose It!');
    expect(foodOriginName('com.sbs.diet.fake')).toBe('Food tracker');
    expect(foodOriginName('MacroFactor')).toBe('Food tracker');
  });
  it('deduplicates healthy direct FatSecret without hiding unrelated packages', async () => {
    const { bridge } = service(['com.fatsecret.android', 'com.sbs.diet', 'com.unknown.tracker']);
    const report = await bridge.inspect();
    expect(discoverFoodOrigins(report, [{ provider: 'fatsecret', status: 'connected' }]).map((w) => w.source.id)).toEqual(['com.unknown.tracker', 'com.sbs.diet']);
    expect(discoverFoodOrigins(report, [{ provider: 'fatsecret', status: 'needs_attention' }])).toHaveLength(3);
  });
  it('does not convert activity discovery or failed reads into food choices', async () => {
    const { bridge } = service(['com.sbs.diet']);
    const report = await bridge.inspect();
    expect(discoverFoodOrigins({ ...report, counts: { nutrition: 1, steps: 1 } }, [])).toEqual([]);
    expect(discoverFoodOrigins({ ...report, state: 'query_failed' }, [])).toEqual([]);
    expect(discoverFoodOrigins({ ...report, readConsistency: 'unproven' }, [])).toEqual([]);
  });
  it('keeps a selected empty package empty when a different package has calories', async () => {
    const { bridge } = service(['com.sbs.diet']);
    const result = await bridge.inspect('com.sbs.diet.other');
    expect(result.days.every((d) => d.intake.value === null)).toBe(true);
    expect(result.days.every((d) => d.caloriesBurned === null)).toBe(true);
    expect(result.authoritative).toBe(false);
  });
  it('invalidates nutrition reads at an account boundary', async () => {
    const { bridge, port } = service(['com.sbs.diet']);
    port.read = async () => { bridge.setAccountScope('another-account'); return { records: [record('com.sbs.diet')] }; };
    expect((await bridge.inspect()).state).toBe('cancelled');
  });
});
