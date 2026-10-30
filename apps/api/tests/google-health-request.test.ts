import { describe, expect, it, vi } from 'vitest';
import { resolvePlanningEvidence } from '@caloriebank/domain';
import { createGoogleHealthActivityRequest } from '../src/modules/google-health/google-health-request';
import { GoogleHealthFitbitExpenditureProvider } from '../src/modules/google-health/google-health.provider';

const now = new Date('2026-10-15T08:00:00Z');
const input = { userId: 'account-a', localDate: '2026-10-15', timezone: 'UTC', isCurrentDay: true };
const daily = { rollupDataPoints: [{ civilStartTime: { date: { year: 2026, month: 10, day: 15 } }, civilEndTime: { date: { year: 2026, month: 10, day: 16 } }, totalCalories: { kcalSum: 2000 } }] };
const json = (value: unknown) => new Response(JSON.stringify(value));

describe('Fitbit activity request responsibility', () => {
  it.each([
    [401, 'authentication'], [403, 'authorization'], [429, 'rate_limit'], [503, 'outage'],
  ] as const)('classifies optional HTTP %s without invalidating authentication', async (status, kind) => {
    const invalidate = vi.fn(async () => {});
    const request = createGoogleHealthActivityRequest(async () => new Response('{}', { status }), 'token', invalidate);
    await expect(request('minute', {}, 'supplementary')).rejects.toMatchObject({ kind, providerStatus: status, statusCode: 502 });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it.each(['timeout', 'network', 'malformed'] as const)('preserves the %s error category without reconnection', async (kind) => {
    const invalidate = vi.fn(async () => {});
    const request = createGoogleHealthActivityRequest(async () => {
      if (kind === 'malformed') return new Response('invalid JSON');
      if (kind === 'timeout') throw new DOMException('timed out', 'TimeoutError');
      throw new TypeError('network failed');
    }, 'token', invalidate);
    await expect(request('minute', {}, 'supplementary')).rejects.toMatchObject({ kind });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it.each(['optional-first', 'daily-first', 'concurrent-optional-first', 'concurrent-daily-first'] as const)('keeps a healthy account for %s completion', async (order) => {
    const invalidate = vi.fn(async () => {});
    let finishMinute!: (response: Response) => void;
    let finishDaily!: (response: Response) => void;
    const request = createGoogleHealthActivityRequest(async (url) => new Promise<Response>((resolve) => {
      if (url === 'minute') finishMinute = resolve; else finishDaily = resolve;
    }), 'token', invalidate);
    const minute = () => request('minute', {}, 'supplementary').catch((error: unknown) => error);
    const burn = () => request('daily', {});
    if (order.startsWith('concurrent')) {
      const optional = minute(); const primary = burn();
      if (order.endsWith('optional-first')) { finishMinute(new Response('{}', { status: 401 })); await optional; finishDaily(json(daily)); }
      else { finishDaily(json(daily)); await primary; finishMinute(new Response('{}', { status: 401 })); }
      expect(await primary).toEqual(daily); await optional;
    } else if (order === 'optional-first') {
      const optional = minute(); finishMinute(new Response('{}', { status: 401 })); await optional;
      const primary = burn(); finishDaily(json(daily)); expect(await primary).toEqual(daily);
    } else {
      const primary = burn(); finishDaily(json(daily)); expect(await primary).toEqual(daily);
      const optional = minute(); finishMinute(new Response('{}', { status: 401 })); await optional;
    }
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('does not let optional success hide authoritative 401 or mutate another account', async () => {
    const states = { a: 'connected', b: 'connected' };
    const fetcher: typeof fetch = async (url) => String(url).includes('failed') ? new Response('{}', { status: 401 }) : json(daily);
    const a = createGoogleHealthActivityRequest(fetcher, 'a', async () => { states.a = 'needs_reconnect'; });
    const b = createGoogleHealthActivityRequest(fetcher, 'b', async () => { states.b = 'needs_reconnect'; });
    await Promise.all([
      expect(a('failed-daily', {})).rejects.toMatchObject({ kind: 'authentication', statusCode: 401 }),
      a('minute', {}, 'supplementary'),
      expect(b('failed-minute', {}, 'supplementary')).rejects.toMatchObject({ kind: 'authentication', statusCode: 502 }),
      b('daily', {}),
    ]);
    await a('minute', {}, 'supplementary');
    expect(states).toEqual({ a: 'needs_reconnect', b: 'connected' });
  });

  it.each(['401', '403', '429', '503', 'timeout', 'malformed-json', 'malformed-schema', 'missing'] as const)('imports daily burn but withholds undated planning after optional %s', async (failure) => {
    const invalidate = vi.fn(async () => {});
    const request = createGoogleHealthActivityRequest(async (url) => {
      if (url === 'daily') return json(daily);
      if (failure === 'timeout') throw new DOMException('timed out', 'TimeoutError');
      if (failure === 'malformed-json') return new Response('invalid');
      if (failure === 'malformed-schema') return json({ rollupDataPoints: 'invalid' });
      if (failure === 'missing') return json({ rollupDataPoints: [] });
      return new Response('{}', { status: Number(failure) });
    }, 'token', invalidate);
    let clock = now;
    const provider = new GoogleHealthFitbitExpenditureProvider({
      fetchDailyTotalCalories: () => request('daily', {}),
      fetchMinuteTotalCalories: () => request('minute', {}, 'supplementary'),
    }, () => clock);
    const first = await provider.fetchDailyExpenditureAggregate(input);
    expect(first).toMatchObject({ rawTotalDailyExpenditure: 2000, forecastCoverageAt: null, reportedIntervalEndAt: null });
    const anchor = resolvePlanningEvidence(null, first!, clock);
    expect(anchor).toMatchObject({ planningAnchorKind: 'retrieval_assumption', planningAnchorAt: now, planningExpiresAt: new Date('2026-10-15T07:59:59.999Z') });
    clock = new Date('2026-10-15T08:31:00Z');
    const repeat = await provider.fetchDailyExpenditureAggregate(input);
    const persisted = resolvePlanningEvidence({ ...first!, ...anchor }, repeat!, clock);
    expect(persisted.planningAnchorAt).toEqual(anchor.planningAnchorAt);
    expect(persisted.planningExpiresAt).toEqual(anchor.planningExpiresAt);
    expect(persisted.planningExpiresAt.getTime()).toBeLessThan(clock.getTime());
    expect(invalidate).not.toHaveBeenCalled();
  });
});
