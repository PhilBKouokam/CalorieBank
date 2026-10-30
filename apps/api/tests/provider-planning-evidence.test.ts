import { describe, expect, it, vi } from 'vitest';
import { calculateBurnToStepPlan, calculateStepToBurnPlan, getLocalDateUtcBounds, resolvePlanningEvidence } from '@caloriebank/domain';
import { fetchMinuteExpenditureEvidence, GoogleHealthFitbitExpenditureProvider } from '../src/modules/google-health/google-health.provider';
import { AppleHealthExpenditureProvider, type HealthKitNativeClient } from '../../mobile/lib/healthkit/apple-health-provider';
import { rollingUploadFingerprint, rollingUploadKey, mergeRollingSyncOutbox, requiresCurrentPlanningSnapshot } from '../../mobile/lib/healthkit/rolling-sync-policy';

const at = (time: string) => new Date(`2026-10-15T${time}Z`);
const base = { provider: 'google_health_fitbit', localDate: '2026-10-15', timezone: 'UTC', rawTotalDailyExpenditure: 2260 };
const input = { ...base, userId: 'test', isCurrentDay: true };
const initial = () => resolvePlanningEvidence(null, { ...base, reportedIntervalEndAt: at('08:00:00') }, at('08:00:00'));
const plan = (anchor: Date, burn = 2260, steps = 2000, coefficient = .05) => {
  const shared = { currentSteps: steps, projectedProviderBurnAtRest: burn + 80 * (24 - (anchor.getTime() - at('00:00:00').getTime()) / 3600000), providerCaloriesPerStep: coefficient, adjustmentFactor: .8 };
  return { baseline: shared.projectedProviderBurnAtRest, inverse: calculateBurnToStepPlan({ ...shared, targetActualBurnCalories: 4000 }), forward: calculateStepToBurnPlan({ ...shared, targetSteps: 31200 }) };
};
describe('provider-aware persistent planning policy', () => {
  it('retains the supported 29200 result across repeated retrievals', () => {
    let state = initial();
    expect(state).toMatchObject({ planningAnchorKind: 'reported_interval', planningAnchorAt: at('08:00:00'), planningExpiresAt: at('08:30:00'), planningProgressAt: at('08:00:00') });
    for (let minute = 0; minute <= 120; minute++) {
      const now = new Date(at('08:00:00').getTime() + minute * 60000);
      state = resolvePlanningEvidence({ ...base, ...state }, base, now);
      expect(state.planningAnchorAt).toEqual(at('08:00:00'));
      expect(state.planningExpiresAt).toEqual(at('08:30:00'));
      const result = plan(state.planningAnchorAt);
      expect(result.baseline).toBe(3540);
      expect(result.inverse.remainingSteps).toBe(29200);
      expect(result.forward.projectedAdjustedBurnCalories).toBe(4000);
    }
    expect(plan(at('08:30:00')).inverse.remainingSteps).toBe(30000);
  });
  it('does not renew for unknown timing revisions, historical corrections or calibration/step changes', () => {
    const previous = { ...base, ...initial() };
    const revision = resolvePlanningEvidence(previous, { ...base, rawTotalDailyExpenditure: 2300 }, at('08:20:00'));
    expect(revision.planningExpiresAt.getTime()).toBeLessThan(at('08:20:00').getTime());
    expect(revision.planningAnchorKind).toBe('retrieval_assumption');
    // Unknown-timing revisions are no longer displayed as numeric forecasts.
    const expiredRevision = resolvePlanningEvidence({ ...base, ...revision, rawTotalDailyExpenditure: 2300 }, { ...base, rawTotalDailyExpenditure: 2200 }, at('09:00:00'));
    expect(expiredRevision.planningExpiresAt.getTime()).toBeLessThan(at('09:00:00').getTime());
    expect(plan(previous.planningAnchorAt, 2260, 2051, .04).inverse.remainingSteps).not.toBe(29200);
    expect(resolvePlanningEvidence(previous, base, at('08:25:00')).planningExpiresAt).toEqual(at('08:30:00'));
    const timed = resolvePlanningEvidence(previous, { ...base, forecastCoverageAt: at('08:15:00') }, at('08:20:00'));
    const correction = resolvePlanningEvidence({ ...base, ...timed }, { ...base, rawTotalDailyExpenditure: 2200, forecastCoverageAt: at('08:15:00') }, at('08:40:00'));
    expect(correction.planningExpiresAt).toEqual(at('08:45:00'));
  });
  it('renews on genuine temporal progress even with identical totals; prevents historical rewind/replay renewal', () => {
    const first = resolvePlanningEvidence(null, { ...base, forecastCoverageAt: at('08:00:00') }, at('08:00:00'));
    const next = resolvePlanningEvidence({ ...base, ...first }, { ...base, forecastCoverageAt: at('08:30:00') }, at('08:30:00'));
    expect(next.planningExpiresAt).toEqual(at('09:00:00'));
    expect(plan(next.planningAnchorAt).inverse.remainingSteps).toBe(30000); // Genuine newer horizon, not a retrieval artifact.
    expect(plan(next.planningAnchorAt, 2300).inverse.remainingSteps).toBe(29200);
    expect(plan(next.planningAnchorAt, 2200).inverse.remainingSteps).toBe(31200);
    const old = resolvePlanningEvidence({ ...base, ...next }, { ...base, forecastCoverageAt: at('08:00:00') }, at('08:35:00'));
    const replay = resolvePlanningEvidence({ ...base, ...old }, { ...base, forecastCoverageAt: at('08:30:00') }, at('08:40:00'));
    expect(replay.planningProgressAt).toEqual(at('08:30:00'));
    expect(replay.planningExpiresAt).toEqual(at('08:30:00'));
  });
  it('never gives known delayed data a fresh retrieval grace period', () => {
    const delayed = resolvePlanningEvidence(null, { ...base, reportedIntervalEndAt: at('07:00:00') }, at('08:30:00'));
    expect(delayed.planningExpiresAt).toEqual(at('07:30:00'));
    const oldUpload = resolvePlanningEvidence(null, { ...base, retrievedAt: at('08:00:00') }, at('09:00:00'));
    expect(oldUpload.planningExpiresAt).toEqual(at('08:30:00'));
    expect(plan(delayed.planningAnchorAt).inverse.remainingSteps).toBe(27600);
  });
  it.each(['07:00:00', '08:30:00'])('uses the later included Apple horizon with active end %s', active => {
    const result = resolvePlanningEvidence(null, { ...base, provider: 'apple_health', activeSampleEndAt: at(active), basalSampleEndAt: at('08:00:00') }, at('08:30:00'));
    expect(result.planningAnchorAt).toEqual(at(active === '07:00:00' ? '08:00:00' : '08:30:00'));
    expect(result.planningAnchorKind).toBe('sample_horizon');
  });
  it('does not count rest twice when basal samples extend beyond active samples', () => {
    const result = resolvePlanningEvidence(null, { ...base, provider: 'apple_health', rawTotalDailyExpenditure: 2300, activeSampleEndAt: at('08:00:00'), basalSampleEndAt: at('08:30:00') }, at('08:30:00'));
    expect(plan(result.planningAnchorAt, 2300).baseline).toBe(3540);
    expect(plan(result.planningAnchorAt, 2300).inverse.remainingSteps).toBe(29200);
    expect(plan(at('08:00:00'), 2300).baseline).toBe(3580); // Incorrect older end counts 40 kcal of included basal twice.
    expect(plan(at('08:00:00'), 2300).inverse.remainingSteps).toBe(28400);
  });
  it('rejects future/outside-query sample metadata without renewing freshness', () => {
    for (const horizon of [at('09:00:00'), new Date('2026-10-14T23:00:00Z')]) {
      const result = resolvePlanningEvidence(null, { ...base, activeSampleEndAt: horizon }, at('08:00:00'));
      expect(result.planningExpiresAt.getTime()).toBeLessThan(at('08:00:00').getTime());
    }
  });
  it.each([['2026-03-08', 23], ['2026-11-01', 25]] as const)('uses real local-day boundaries on DST %s', (localDate, hours) => {
    const timezone = 'America/Chicago';
    const { start, end } = getLocalDateUtcBounds(localDate, timezone);
    expect((end.getTime() - start.getTime()) / 3600000).toBe(hours);
    const result = resolvePlanningEvidence(null, { ...base, localDate, timezone, reportedIntervalEndAt: new Date(end.getTime() - 10 * 60000) }, new Date(end.getTime() - 10 * 60000));
    expect(result.planningExpiresAt).toEqual(end);
  });
  it('does not reset expiry on timezone changes', () => {
    const result = resolvePlanningEvidence({ ...base, ...initial() }, { ...base, timezone: 'America/Chicago' }, at('09:00:00'));
    expect(result.planningExpiresAt.getTime()).toBeLessThanOrEqual(at('08:30:00').getTime());
  });
});

const point = (start: string, end: string, calories?: number) => ({ startTime: at(start).toISOString(), endTime: at(end).toISOString(), ...(calories === undefined ? {} : { totalCalories: { kcalSum: calories } }) });
describe('Google minute expenditure metadata', () => {
  it('paginates with fixed UTC range and includes explicit zero without filling missing intervals', async () => {
    const fetchMinuteTotalCalories = vi.fn().mockResolvedValueOnce({ rollupDataPoints: [point('07:58:00', '07:59:00', 2260)], nextPageToken: 'two' }).mockResolvedValueOnce({ rollupDataPoints: [point('08:00:00', '08:01:00', 0), point('08:01:00', '08:02:00')] });
    const transport = { fetchDailyTotalCalories: vi.fn(), fetchMinuteTotalCalories };
    expect(await fetchMinuteExpenditureEvidence(transport, input, at('08:30:00'))).toEqual({ horizon: at('08:01:00'), calories: 2260 });
    expect(fetchMinuteTotalCalories.mock.calls[1]![0]).toEqual({ start: at('00:00:00'), end: at('08:30:00'), pageToken: 'two' });
  });
  it('rejects repeated page tokens, malformed intervals, future buckets and optional query errors', async () => {
    for (const payload of [{ nextPageToken: 'loop', rollupDataPoints: [] }, { rollupDataPoints: [point('07:00:00', '08:00:00', 2)] }, { rollupDataPoints: [point('08:30:00', '08:31:00', 2)] }]) {
      expect(await fetchMinuteExpenditureEvidence({ fetchDailyTotalCalories: vi.fn(), fetchMinuteTotalCalories: vi.fn().mockResolvedValue(payload) }, input, at('08:30:00'))).toBeNull();
    }
    expect(await fetchMinuteExpenditureEvidence({ fetchDailyTotalCalories: vi.fn(), fetchMinuteTotalCalories: vi.fn().mockRejectedValue(new Error('offline')) }, input, at('08:30:00'))).toBeNull();
  });
  it.each([2260, 2300])('keeps dailyRollUp authority and only pairs comparable minute evidence (%i)', async daily => {
    const result = await new GoogleHealthFitbitExpenditureProvider({ fetchDailyTotalCalories: async () => ({ rollupDataPoints: [{ civilStartTime: { date: { year: 2026, month: 10, day: 15 } }, civilEndTime: { date: { year: 2026, month: 10, day: 16 } }, totalCalories: { kcalSum: daily } }] }), fetchMinuteTotalCalories: async () => ({ rollupDataPoints: [point('07:59:00', '08:00:00', 2260)] }) }, () => at('08:30:00')).fetchDailyExpenditureAggregate(input);
    expect(result?.rawTotalDailyExpenditure).toBe(daily);
    expect(result?.forecastCoverageAt).toBeNull();
    expect(result?.reportedIntervalEndAt).toEqual(daily === 2260 ? at('08:00:00') : null);
  });
  it.each(['2026-03-08', '2026-11-01'])('queries the actual local DST window %s', async localDate => {
    const bounds = getLocalDateUtcBounds(localDate, 'America/Chicago');
    const fetchMinuteTotalCalories = vi.fn().mockResolvedValue({ rollupDataPoints: [] });
    await fetchMinuteExpenditureEvidence({ fetchDailyTotalCalories: vi.fn(), fetchMinuteTotalCalories }, { ...input, localDate, timezone: 'America/Chicago' }, bounds.end);
    expect(fetchMinuteTotalCalories).toHaveBeenCalledWith({ start: bounds.start, end: bounds.end });
  });
});

describe('Apple horizon transport', () => {
  it('preserves both bridge sample ends; retrieval alone does not change upload fingerprints', async () => {
    const healthKit: HealthKitNativeClient = { queryStatisticsForQuantity: async identifier => ({ sources: [], sumQuantity: { quantity: identifier.includes('Active') ? 1000 : 1260, unit: 'kcal' }, endDate: at(identifier.includes('Active') ? '08:00:00' : '08:15:00') }), queryStatisticsCollectionForQuantity: async () => [], queryWorkoutSamples: async () => [] };
    const result = await new AppleHealthExpenditureProvider({ healthKit, dayStart: at('00:00:00'), dayEnd: new Date('2026-10-16T00:00:00Z'), now: () => at('08:30:00') }).fetchDailyExpenditureAggregate(input);
    expect(result).toMatchObject({ activeSampleEndAt: at('08:00:00'), basalSampleEndAt: at('08:15:00'), rawTotalDailyExpenditure: 2260, forecastCoverageAt: null });
    const upload = { kind: 'expenditure' as const, localDate: input.localDate, body: { rawTotalDailyExpenditure: 2260, activeSampleEndAt: result!.activeSampleEndAt!.toISOString(), retrievedAt: at('08:30:00').toISOString() } };
    expect(rollingUploadFingerprint(upload)).toBe(rollingUploadFingerprint({ ...upload, body: { ...upload.body, retrievedAt: at('08:45:00').toISOString() } }));
    expect(rollingUploadFingerprint(upload)).not.toBe(rollingUploadFingerprint({ ...upload, body: { ...upload.body, activeSampleEndAt: at('08:30:00').toISOString() } }));
  });
});


describe('Apple current-day planning generation', () => {
  it('uploads unchanged burn and steps together while still skipping unchanged historical/intake evidence', () => {
    const uploads = [
      { kind: 'expenditure', localDate: input.localDate, body: { rawTotalDailyExpenditure: 2260 } },
      { kind: 'steps', localDate: input.localDate, body: { totalSteps: 2000 } },
      { kind: 'intake', localDate: input.localDate, body: { totalCaloriesConsumed: 1000 } },
      { kind: 'expenditure', localDate: '2026-10-14', body: { rawTotalDailyExpenditure: 3000 } },
    ];
    const fingerprints = Object.fromEntries(uploads.map(upload => [rollingUploadKey(upload), rollingUploadFingerprint(upload)]));
    const result = mergeRollingSyncOutbox([], uploads, fingerprints, at('08:30:00').toISOString(), upload => !requiresCurrentPlanningSnapshot(upload, input.localDate));
    expect(result.queue.map(upload => upload.kind)).toEqual(['expenditure', 'steps']);
    expect(result.skippedUploads.map(upload => upload.kind)).toEqual(['intake', 'expenditure']);
    const persisted = resolvePlanningEvidence({ ...base, ...initial() }, base, at('08:30:00'));
    expect(persisted.planningAnchorAt).toEqual(at('08:00:00'));
    expect(persisted.planningExpiresAt).toEqual(at('08:30:00'));
  });
});
