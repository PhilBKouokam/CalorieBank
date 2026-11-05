import type { PrismaClient } from '@prisma/client';
import { vi } from 'vitest';
import { GoogleHealthFitbitService } from '../src/modules/google-health/google-health.service';
import { parseApiEnv } from '../src/env';
import { encryptGoogleHealthSecret } from '../src/modules/google-health/token-crypto';
import type { TodayAggregateRepository } from '../src/modules/today/today.repository';
import { describe, expect, it } from 'vitest';
import { boundedBaselineChunk, pairLowActivityHourlyEvidence } from '../src/modules/google-health/google-health-hourly-evidence';
import { estimateRestingBurnFromLowActivityHours } from '@caloriebank/domain';
const row = (hour: number) => ({ startTime: `2026-10-29T${String(hour).padStart(2, '0')}:00:00.000Z`, endTime: `2026-10-29T${String(hour + 1).padStart(2, '0')}:00:00.000Z` });
describe('actual baseline hourly pairing', () => {
  it('preserves explicit zero but never turns an absent step metric into zero', () => {
    const energy = [{ ...row(1), totalCalories: { kcalSum: 65 } }, { ...row(2), totalCalories: { kcalSum: 75 } }];
    const result = pairLowActivityHourlyEvidence(energy, [{ ...row(1), steps: { countSum: 0 } }, row(2)], []);
    expect(result).toHaveLength(1); expect(result[0]?.steps).toBe(0);
    expect(estimateRestingBurnFromLowActivityHours(result)?.providerKcalPerHour).toBe(65);
  });
  it('requires matching interval ends and a complete elapsed hour, not matching starts only', () => {
    const energy = [{ ...row(1), totalCalories: { kcalSum: 70 } }];
    expect(pairLowActivityHourlyEvidence(energy, [{ ...row(1), endTime: '2026-10-29T01:30:00.000Z', steps: { countSum: 0 } }], [])).toEqual([]);
    const partial = { startTime: row(1).startTime, endTime: '2026-10-29T01:30:00.000Z' };
    expect(pairLowActivityHourlyEvidence([{ ...partial, totalCalories: { kcalSum: 35 } }], [{ ...partial, steps: { countSum: 0 } }], [])).toEqual([]);
  });
  it('rejects duplicate or overlapping windows and excludes a whole workout-contaminated hour', () => {
    const energy = [{ ...row(1), totalCalories: { kcalSum: 70 } }], steps = [{ ...row(1), steps: { countSum: 0 } }];
    expect(pairLowActivityHourlyEvidence(energy, [...steps, ...steps], [])).toEqual([]);
    expect(pairLowActivityHourlyEvidence([...energy, ...energy], steps, [])).toEqual([]);
    const paired = pairLowActivityHourlyEvidence(energy, steps, [{ start: new Date('2026-10-29T01:30:00Z'), end: new Date('2026-10-29T01:31:00Z') }]);
    expect(paired[0]?.overlapsWorkout).toBe(true);
    expect(estimateRestingBurnFromLowActivityHours(paired)).toBeNull();
  });
  it('compares mean and existing median on the identical synthetic quiet-hour sample, not personal accuracy', () => {
    const observations = [60, 65, 70, 75, 130].map((calories, i) => ({ calories, steps: 0, overlapsWorkout: false, observedAt: new Date(row(i).startTime) }));
    expect(estimateRestingBurnFromLowActivityHours(observations)?.providerKcalPerHour).toBe(70);
    expect(observations.reduce((n, v) => n + v.calories, 0) / observations.length).toBe(80);
    // Mean and median differ; neither this synthetic comparison nor a higher rate proves future accuracy.
  });
});


it.each(['absent', 'legacy', 'v2', 'failed', 'repeated', 'empty', 'paged', 'dst'])('resolves corrected baseline with %s cache/transport, without token refresh', async (scenario) => {
  const now = new Date(scenario==='dst'?'2026-11-04T12:00:00Z':'2026-10-30T12:00:00Z'), key = Buffer.alloc(32, 9).toString('base64');
  const db = {
    providerSelection: { findUnique: vi.fn(async () => ({ authoritativeExpenditureProvider: 'google_health_fitbit' })) },
    googleHealthConnection: { findUnique: vi.fn(async () => ({ status: 'connected', accessTokenExpiresAt: new Date(now.getTime()+86_400_000), encryptedAccessToken: encryptGoogleHealthSecret('synthetic', key) })) },
    restingBurnEstimate: { findUnique: vi.fn(async () => scenario === 'absent' || scenario === 'repeated' ? null : ({ provider: 'google_health_fitbit', evidenceType: scenario === 'v2' ? 'historical_low_activity_hours_v2' : 'historical_low_activity_hours', providerKcalPerHour: 70, observationCount: 3, calculatedAt: now, lookbackStartDate: now, lookbackEndDate: now })) },
  } as unknown as PrismaClient;
  const stored = vi.fn(async () => undefined);
  const repo = { upsertRestingBurnEstimate: stored } as unknown as TodayAggregateRepository;
  const energy = [60, 70, 80, 1000, 2000].map((kcalSum, hour) => ({ ...row(hour), totalCalories: { kcalSum } }));
  const steps = [0, 1, 2, 3, 4].map(hour => ({ ...row(hour), ...(hour === 3 ? {} : { steps: { countSum: 0 } }),
    ...(hour === 4 ? { endTime: '2026-10-29T04:30:00.000Z' } : {}) }));
  const fetcher = vi.fn(async (url: string | URL | Request, init?:RequestInit) => {
    if (scenario === 'failed') throw new Error('synthetic unavailable');
    const parsed = new URL(String(url)); expect(parsed.origin).toBe('https://health.googleapis.com');
    if (parsed.pathname.endsWith('/exercise/dataPoints')) return Response.json({ dataPoints: [], ...(scenario === 'repeated' ? { nextPageToken: 'same' } : {}) });
    if(scenario==='dst'&&parsed.pathname.includes('dataPoints:rollUp')){
      const range=JSON.parse(String(init?.body)).range;const start=Date.parse(range.startTime),end=Date.parse(range.endTime);
      if(end-start>336*3600000)return Response.json({error:{message:'INVALID_ARGUMENT'}},{status:400});
      const rows=parsed.pathname.includes('/total-calories/')?energy:steps;return Response.json({rollupDataPoints:rows.filter(x=>Date.parse(x.startTime)>=start&&Date.parse(x.endTime)<=end)});
    }
    if (parsed.pathname.includes('/total-calories/')) return Response.json({ rollupDataPoints: scenario === 'empty' ? [] : energy, ...(scenario === 'paged' ? { nextPageToken: 'unread' } : {}) });
    if (parsed.pathname.includes('/steps/')) return Response.json({ rollupDataPoints: steps });
    throw Error('Unexpected request, including any token refresh');
  }) as unknown as typeof fetch;
  const config = parseApiEnv({ NODE_ENV: 'test', GOOGLE_HEALTH_CLIENT_ID: 'synthetic', GOOGLE_HEALTH_CLIENT_SECRET: 'synthetic',
    GOOGLE_HEALTH_REDIRECT_URI: 'http://localhost/callback', GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY: key });
  const service = new GoogleHealthFitbitService(db, repo, config, undefined, fetcher, () => now);
  const resolve = () => service.resolveRestingBurnEstimate({ id: 'synthetic-owner', email: 'synthetic@example.invalid' }, scenario==='dst'?'2026-11-04':'2026-10-30', scenario==='dst'?'America/Chicago':'UTC');
  if (scenario === 'failed' || scenario === 'repeated' || scenario === 'paged') {
    await expect(resolve()).rejects.toThrow();
    expect(stored).not.toHaveBeenCalled();
    expect(vi.mocked(fetcher).mock.calls.length).toBeLessThanOrEqual(4);
  } else if (scenario === 'empty') {
    expect(await resolve()).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(24);
    expect(stored).not.toHaveBeenCalled();
  } else {
    expect(await resolve()).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(scenario === 'v2' ? 0 : scenario==='dst'?6:3);
    if(scenario==='dst'){const ranges=vi.mocked(fetcher).mock.calls.filter(([u])=>String(u).includes('/total-calories/')).map(([,init])=>JSON.parse(String(init?.body)).range);expect(ranges).toHaveLength(2);expect(ranges[1].endTime).toBe(ranges[0].startTime);expect(ranges[0].endTime).toBe('2026-11-04T06:00:00.000Z');expect(ranges[1].startTime).toBe('2026-10-21T05:00:00.000Z');}
    if (scenario === 'v2') expect(stored).not.toHaveBeenCalled();
    else expect(stored).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ providerKcalPerHour: 70, observationCount: 3, evidenceType: 'historical_low_activity_hours_v2' }));
  }
});

describe('baseline physical rollup request bounds',()=>{
 it('splits fallback14-civil-day337h request into contiguous13+1 local days',()=>{
  const a=boundedBaselineChunk('2026-11-04',14,'America/Chicago');expect(a.days).toBe(13);expect(a.startDate).toBe('2026-10-22');expect((a.end.getTime()-a.start.getTime())/3600000).toBe(313);
  const b=boundedBaselineChunk(a.startDate,14-a.days,'America/Chicago');expect(b.days).toBe(1);expect(b.end).toEqual(a.start);expect(b.startDate).toBe('2026-10-21');
 });
 it.each(['2026-03-15','2026-10-20'])('keeps spring or ordinary14-day civil window %s',end=>{const c=boundedBaselineChunk(end,14,'America/Chicago');expect(c.days).toBe(14);expect(c.end.getTime()-c.start.getTime()).toBeLessThanOrEqual(336*3600000);});
 it('preserves exact14/30/90 civil-day lookbacks without gaps or oversized requests',()=>{
  let covered=0,end='2026-11-04',lastStart:Date|null=null;
  for(const target of [14,30,90]){while(covered<target){const c=boundedBaselineChunk(end,target-covered,'America/Chicago');expect(c.days).toBeGreaterThan(0);expect(c.end.getTime()-c.start.getTime()).toBeLessThanOrEqual(336*3600000);if(lastStart)expect(c.end).toEqual(lastStart);covered+=c.days;end=c.startDate;lastStart=c.start;}expect(covered).toBe(target);}
  expect(end).toBe('2026-08-06');
 });
});
