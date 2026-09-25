import { describe, expect, it } from 'vitest';
import type { ProviderSelectionResponse } from '@caloriebank/schemas';
import { emptyTodayDetail, emptyTodayValue, firstRunTodayEmptyState, needsConnectionRecovery } from '../../mobile/lib/today/presentation';
const selection = (status: ProviderSelectionResponse['intake']['status'], selected = true) => ({
  expenditure: { selected: true, status: 'ready' }, intake: { selected, status },
}) as ProviderSelectionResponse;
describe('Today loading and connection recovery are separate', () => {
  it.each(['connected', 'ready', 'unavailable'] as const)('does not call configured %s data disconnected', status => {
    expect(needsConnectionRecovery(selection(status))).toBe(false);
    expect(firstRunTodayEmptyState({ checking: true, source: 'Cronometer', noun: 'intake' })?.value).toMatch(/Loading/);
    expect(emptyTodayValue('unavailable', 'intake')).toBe('No intake today');
    expect(emptyTodayDetail('unavailable', 'Cronometer', 'calories eaten')).toBe('Cronometer has not reported calories eaten today');
  });
  it('reserves connection recovery for confirmed missing selection or actionable failure', () => {
    expect(needsConnectionRecovery(null)).toBe(false);
    expect(needsConnectionRecovery(selection('not_connected'))).toBe(true);
    expect(needsConnectionRecovery(selection('needs_attention'))).toBe(true);
    expect(needsConnectionRecovery(selection('unavailable', false))).toBe(true);
  });
  it('does not turn a temporary refresh failure into a disconnection', () => {
    expect(emptyTodayValue('error', 'intake')).toBe('Unavailable');
    expect(emptyTodayDetail('error', 'Cronometer', 'calories eaten')).toContain('couldn’t refresh');
    expect(needsConnectionRecovery(selection('ready'))).toBe(false);
  });
});

import { currentDateSnapshot } from '../../mobile/lib/today/current-date';
import type { TodayResponse } from '@caloriebank/schemas';
describe('current-date cached values', () => {
  it.each([
    ['2026-09-24', '2026-09-25T04:59:59Z', true],
    ['2026-09-24', '2026-09-25T05:00:00Z', false],
    ['2026-03-08', '2026-03-09T04:59:59Z', true],
    ['2026-03-08', '2026-03-09T05:00:00Z', false],
    ['2026-11-01', '2026-11-02T05:59:59Z', true],
    ['2026-11-01', '2026-11-02T06:00:00Z', false],
  ])('retains %s only on its canonical local date at %s', (date, instant, keep) => {
    const value = { date, timezone: 'America/Chicago', eaten: { calories: 2900 } } as TodayResponse;
    expect(currentDateSnapshot(value, new Date(instant))).toBe(keep ? value : null);
  });
});
