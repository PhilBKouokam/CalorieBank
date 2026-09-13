import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categories, createHealthQualification, type HealthEvidencePort } from '../../mobile/lib/health-connect/qualification';
import { decodeRecord, normalizeDay, uniqueRecords } from '../../mobile/lib/health-connect/normalize';
import type { EvidenceCategory, EvidenceWindow } from '../../mobile/lib/native-health/evidence';

const window: EvidenceWindow = { localDate: '2026-09-10', timezone: 'UTC', start: '2026-09-10T00:00:00Z', end: '2026-09-11T00:00:00Z', isCurrentDay: false };
const record = (origin = 'com.example.food', id = 'one', overrides = {}) => ({ metadata: { id, dataOrigin: origin, lastModifiedTime: '2026-09-11T10:00:00Z', clientRecordVersion: 1 }, startTime: '2026-09-10T12:00:00Z', endTime: '2026-09-10T12:01:00Z', energy: { inKilocalories: 200 }, ...overrides });
let granted: EvidenceCategory[], status: number, records: Partial<Record<EvidenceCategory, unknown[]>>, changed: boolean, fail: boolean;
let port: HealthEvidencePort;
beforeEach(() => {
  granted = [...categories]; status = 3; records = {}; changed = false; fail = false;
  port = { androidVersion: 34, status: async () => status, initialize: async () => true,
    permissions: vi.fn(async () => [...granted]),
    read: vi.fn(async (category: EvidenceCategory) => { if (fail) throw new Error('sensitive native payload'); return { records: records[category] ?? [] }; }),
    changes: vi.fn(async (_categories, token) => ({ token: 'opaque', changed: !!token && changed, expired: false, hasMore: false })), settings: async () => true };
});
const bridge = () => { const b = createHealthQualification(port, () => new Date('2026-09-11T15:00:00Z')); b.setAccountScope('test-account'); return b; };

describe('Health Connect native qualification orchestration', () => {
  it.each([[1, 'unavailable'], [2, 'setup_required'], [3, 'available']] as const)('distinguishes SDK state %s', async (sdk, expected) => { status = sdk; expect((await bridge().access()).state).toBe(expected); });
  it('distinguishes an unsupported version without calling the native SDK', async () => { port.androidVersion = 27; port.status = vi.fn(); expect((await bridge().access()).state).toBe('unsupported_version'); expect(port.status).not.toHaveBeenCalled(); });
  it('distinguishes denial and partial grants and requests only explicit access', async () => {
    granted = []; const b = bridge(); expect((await b.access()).state).toBe('permissions_missing');
    granted = ['nutrition']; expect((await b.access(true)).state).toBe('partial_permissions'); expect(port.permissions).toHaveBeenLastCalledWith(true);
  });
  it('does not prompt without an account scope', async () => { const b = createHealthQualification(port); await b.access(true); expect(port.permissions).not.toHaveBeenCalled(); });
  it('represents native failure without exposing exception contents', async () => { port.status = async () => { throw new Error('sensitive details'); }; expect((await bridge().access()).state).toBe('native_query_failed'); });
  it('keeps empty records empty and never fabricates zeros', async () => {
    const r = await bridge().inspect('com.empty'); expect(r.state).toBe('no_records'); expect(r.days).toHaveLength(8);
    expect(r.days.every((d) => d.intake.value === null && d.steps.value === null && d.caloriesBurned === null)).toBe(true);
  });
  it('does not use populated unselected writers and preserves exact packages', async () => {
    records.nutrition = [record('com.tracker.one'), record('com.tracker.two')]; const r = await bridge().inspect('com.tracker.three');
    expect(r.origins.map((s) => s.id)).toEqual(['com.tracker.one', 'com.tracker.two']); expect(r.days.every((d) => d.intake.value === null)).toBe(true);
    const selected = await bridge().inspect('com.tracker.one'); expect(selected.days.find((d) => d.window.localDate === '2026-09-10')?.intake.value?.totalCaloriesConsumed).toBe(200);
  });
  it('distinguishes a previously observed origin absent from the new query, not an uninstall claim', async () => {
    records.nutrition = [record()]; const b = bridge(); await b.inspect('com.example.food'); records = {};
    expect((await b.inspect('com.example.food')).originState).toBe('previously_observed_now_absent');
    b.setAccountScope('other'); expect((await b.inspect('com.example.food')).originState).toBe('not_observed');
  });
  it('withholds all evidence on permission revocation during the read', async () => {
    port.read = async () => { granted = []; return { records: [record()] }; };
    const r = await bridge().inspect('com.example.food'); expect(r.state).toBe('access_required'); expect(r.days).toEqual([]);
  });
  it('retains per-category missing permission without inventing data', async () => {
    granted = ['nutrition']; records.nutrition = [record()]; const r = await bridge().inspect('com.example.food');
    expect(r.days.every((d) => d.steps.quality === 'permission_missing')).toBe(true);
  });
  it('discards a mixed generation when records change or are deleted during queries', async () => {
    records.nutrition = [record()]; changed = true; const r = await bridge().inspect('com.example.food'); expect(r.state).toBe('changed_during_read'); expect(r.days).toEqual([]);
  });
  it('discards results after an account switch', async () => {
    const b = bridge(); port.read = async () => { b.setAccountScope('other'); return { records: [record()] }; };
    expect((await b.inspect('com.example.food')).state).toBe('cancelled');
  });
  it('bounds pagination rather than accepting truncated history', async () => {
    port.read = async () => ({ records: [], pageToken: 'repeating' }); expect((await bridge().inspect()).state).toBe('query_failed');
  });
  it('consumes every page and deduplicates repeated IDs', async () => {
    port.read = async (category, _start, _end, token) => category !== 'nutrition' ? { records: [] } : { records: [record()], pageToken: token ? undefined : 'next' };
    const r = await bridge().inspect('com.example.food'); expect(r.counts.nutrition).toBe(1);
  });
  it('does not accept expired change tokens', async () => { port.changes = async () => ({ token: 'expired', changed: false, expired: true, hasMore: false }); expect((await bridge().inspect()).state).toBe('changed_during_read'); });
  it('withholds invalid records and never logs native health exceptions', async () => {
    records.nutrition = [record(undefined, undefined, { energy: { inKilocalories: -1 } })]; expect((await bridge().inspect()).state).toBe('query_failed');
    fail = true; const log = vi.spyOn(console, 'error'); expect((await bridge().inspect()).days).toEqual([]); expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
  it('does not qualify burn even with total, active and BMR records', async () => {
    records.total_energy = [record()]; records.active_energy = [record()]; records.resting_rate = [record(undefined, undefined, { basalMetabolicRate: { inKilocaloriesPerDay: 1600 } })];
    const r = await bridge().inspect('com.example.food'); expect(r.days.every((d) => d.burnQualification === 'not_qualified' && d.caloriesBurned === null)).toBe(true); expect(r.forecastEligible).toBe(false); expect(r.authoritative).toBe(false);
  });
  it('uses one frozen cutoff for all categories and today plus seven completed dates', async () => {
    const r = await bridge().inspect(); expect(r.windows).toHaveLength(8); expect(r.windows.filter((w) => w.isCurrentDay)).toHaveLength(1);
    for (const call of vi.mocked(port.read).mock.calls) { expect(call[1]).toBe(r.windows[7]!.start); expect(call[2]).toBe(r.queryStartedAt); }
    expect(r.readConsistency).toBe('stable_read'); expect(r.observedAt).toBe(r.queryStartedAt);
  });
});

describe('provider-neutral evidence, never accounting', () => {
  it('does not mistake full interval coverage for qualified provider burn', () => {
    const r = decodeRecord('total_energy', record(undefined, undefined, { startTime: window.start, endTime: window.end }))!;
    const d = normalizeDay([r], window, r.origin, categories, []);
    expect(d.burnEvidence.coverage).toBe('complete_intervals'); expect(d.caloriesBurned).toBeNull(); expect(d.burnQualification).toBe('not_qualified');
  });
  it('uses calendar days across DST, not fixed 24-hour subtraction', async () => {
    const original = process.env.TZ; process.env.TZ = 'America/Chicago';
    try {
      const b = createHealthQualification(port, () => new Date('2026-03-09T15:00:00Z')); b.setAccountScope('test');
      const r = await b.inspect(); const sunday = r.windows.find((w) => w.localDate === '2026-03-08')!;
      expect((Date.parse(sunday.end) - Date.parse(sunday.start)) / 3600000).toBe(23);
    } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
  });
  it('accepts an explicit zero calorie record but not a nutrition record without energy', () => {
    const noEnergy = decodeRecord('nutrition', record(undefined, undefined, { energy: undefined }))!;
    expect(normalizeDay([noEnergy], window, noEnergy.origin, categories, []).intake.quality).toBe('no_calorie_records');
    const zero = decodeRecord('nutrition', record(undefined, undefined, { energy: { inKilocalories: 0 } }))!;
    expect(normalizeDay([zero], window, zero.origin, categories, []).intake.value?.totalCaloriesConsumed).toBe(0);
  });
  it('deduplicates IDs/revisions while preserving distinct same-time food items', () => {
    const one = decodeRecord('nutrition', record())!; const two = { ...one, id: 'two' };
    expect(uniqueRecords([one, one]).records).toHaveLength(1);
    expect(uniqueRecords([one, { ...one, value: 300 }]).conflict).toBe(true);
    const newer = { ...one, version: 2, value: 300 }; expect(uniqueRecords([one, newer]).records[0]!.value).toBe(300);
    expect(normalizeDay([one, two], window, one.origin, categories, []).intake).toMatchObject({ quality: 'usable_evidence', value: { totalCaloriesConsumed: 400 } });
  });
  it('sums overlapping food items only from the exact origin after pagination and revision deduplication', async () => {
    const origin = 'com.cronometer.android.gold';
    const first = record(origin, 'food-a');
    const revised = record(origin, 'food-a', { metadata: { ...first.metadata, clientRecordVersion: 2 }, energy: { inKilocalories: 250 } });
    records.nutrition = [first, first, revised, record(origin, 'food-b', { startTime: '2026-09-10T12:00:30Z' }), record('com.other.food', 'food-b')];
    const result = await bridge().inspect(origin);
    expect(result.readConsistency).toBe('stable_read');
    expect(result.days.find((d) => d.window.localDate === window.localDate)?.intake).toMatchObject({ quality: 'usable_evidence', value: { totalCaloriesConsumed: 450 } });
    expect(result.days.every((d) => d.caloriesBurned === null)).toBe(true);
  });
  it('still rejects conflicting same-ID food revisions and missing energy in overlapping items', async () => {
    records.nutrition = [record(), record(undefined, undefined, { energy: { inKilocalories: 300 } })];
    expect((await bridge().inspect('com.example.food')).state).toBe('query_failed');
    const one = decodeRecord('nutrition', record())!;
    const missing = decodeRecord('nutrition', record(undefined, 'missing', { energy: undefined }))!;
    expect(normalizeDay([one, missing], window, one.origin, categories, []).intake).toEqual({ quality: 'no_calorie_records', value: null });
  });
  it('never prorates an interval spanning a local midnight', () => {
    const r = decodeRecord('nutrition', record(undefined, undefined, { startTime: '2026-09-09T23:59:00Z' }))!;
    expect(normalizeDay([r], window, r.origin, categories, []).intake.quality).toBe('boundary_ambiguous');
  });
  it('uses exact activity origin and refuses overlapping steps', () => {
    const r = decodeRecord('steps', record('com.steps', 'one', { count: 100 }))!;
    expect(normalizeDay([r], window, 'com.other', categories, []).steps.value).toBeNull();
    expect(normalizeDay([r], window, r.origin, categories, []).steps.value?.totalSteps).toBe(100);
    expect(normalizeDay([r, { ...r, id: 'two' }], window, r.origin, categories, []).steps.quality).toBe('ambiguous_overlap');
  });
  it('normalizes walking duration but never joins unrelated calories/steps by overlap', () => {
    const r = decodeRecord('workouts', record(undefined, undefined, { exerciseType: 79 }))!;
    const normalized = normalizeDay([r], window, r.origin, categories, []);
    expect(normalized.activityEvidence[0]).toMatchObject({ activityType: 'walking', durationMinutes: 1, totalSteps: null, totalEnergyBurned: null, totalDistance: null });
    expect(normalized.walkingCalibration).toBe('insufficient_paired_evidence');
  });
});
