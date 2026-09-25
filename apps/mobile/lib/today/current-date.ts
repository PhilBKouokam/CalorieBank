import type { TodayResponse } from '@caloriebank/schemas';

/** A cached observation belongs to its canonical date, never to the next day. */
export function currentDateSnapshot(today: TodayResponse | null, now = new Date()) {
  if (!today) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: today.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)?.value;
  return today.date === `${part('year')}-${part('month')}-${part('day')}` ? today : null;
}
