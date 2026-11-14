import type { BankHistoryResponse, BankHistoryRange } from '@caloriebank/schemas';

// Date-only accounting keys use UTC calendar arithmetic, never device-local elapsed hours.
const date = (key: string) => new Date(`${key}T12:00:00Z`);
const key = (value: Date) => value.toISOString().slice(0, 10);
export function shiftDate(value: string, days: number) {
  const next = date(value); next.setUTCDate(next.getUTCDate() + days); return key(next);
}
const monthStart = (value: string) => `${value.slice(0, 7)}-01`;
function shiftMonth(value: string, months: number) {
  const next = date(monthStart(value)); next.setUTCMonth(next.getUTCMonth() + months); return key(next);
}
const weekStart = (value: string) => shiftDate(value, -date(value).getUTCDay());
export function periodBounds(range: BankHistoryRange, anchor: string) {
  if (range === 'D') return { start: anchor, end: anchor };
  if (range === 'W') { const start = weekStart(anchor); return { start, end: shiftDate(start, 6) }; }
  if (range === 'Y') return { start: `${anchor.slice(0, 4)}-01-01`, end: `${anchor.slice(0, 4)}-12-31` };
  const start = range === '3M' ? shiftMonth(anchor, -2) : monthStart(anchor);
  return { start, end: shiftDate(shiftMonth(anchor, 1), -1) };
}
export function movePeriod(range: BankHistoryRange, anchor: string, direction: number) {
  if (range === 'D' || range === 'W') return shiftDate(anchor, direction * (range === 'D' ? 1 : 7));
  return shiftMonth(anchor, direction * (range === 'Y' ? 12 : range === '3M' ? 3 : 1));
}
export function historyDateLabel(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(date(value));
}
export type HistoryItem = { kind: 'calculated'; day: BankHistoryResponse['days'][number] }
  | { kind: 'missing'; day: BankHistoryResponse['missingDays'][number] };
export type HistoryBucket = {
  id: string; start: string; end: string; label: string; shortLabel: string;
  items: HistoryItem[]; total: number | null; missingCount: number;
};
export function historyPeriods(history: BankHistoryResponse, range: BankHistoryRange, anchor: string) {
  const items: HistoryItem[] = [
    ...history.days.map(day => ({ kind: 'calculated' as const, day })),
    ...history.missingDays.map(day => ({ kind: 'missing' as const, day })),
  ].sort((a, b) => b.day.logDate.localeCompare(a.day.logDate));
  const bounds = range === 'ALL'
    ? { start: items.at(-1)?.day.logDate ?? anchor, end: items[0]?.day.logDate ?? anchor }
    : periodBounds(range, anchor);
  const visible = items.filter(item => item.day.logDate >= bounds.start && item.day.logDate <= bounds.end);
  const grouped = range === 'M' || range === '3M' || range === 'Y' || range === 'ALL';
  const groups = new Map<string, HistoryBucket>();
  for (const item of visible) {
    const value = item.day.logDate;
    const rawStart = range === 'M' || range === '3M' ? weekStart(value) : grouped ? monthStart(value) : value;
    const rawEnd = range === 'M' || range === '3M' ? shiftDate(rawStart, 6) : grouped ? shiftDate(shiftMonth(value, 1), -1) : value;
    const start = rawStart < bounds.start ? bounds.start : rawStart;
    const end = rawEnd > bounds.end ? bounds.end : rawEnd;
    const label = grouped
      ? range === 'Y' || range === 'ALL'
        ? historyDateLabel(start, { month: 'long', ...(range === 'ALL' ? { year: 'numeric' as const } : {}) })
        : `${historyDateLabel(start)} – ${historyDateLabel(end)}`
      : historyDateLabel(value, { weekday: 'short', month: 'short', day: 'numeric' });
    const bucket = groups.get(start) ?? {
      id: start, start, end, label,
      shortLabel: historyDateLabel(start, range === 'Y' || range === 'ALL' ? { month: 'short' } : range === 'W' ? { weekday: 'short' } : { month: 'short', day: 'numeric' }),
      items: [], total: null, missingCount: 0,
    };
    bucket.items.push(item);
    if (item.kind === 'calculated') bucket.total = (bucket.total ?? 0) + item.day.dailyBankChange;
    else bucket.missingCount++;
    groups.set(start, bucket);
  }
  const title = range === 'ALL' ? 'All history' : range === 'D' ? historyDateLabel(anchor, { month: 'long', day: 'numeric', year: 'numeric' })
    : range === 'Y' ? anchor.slice(0, 4) : range === 'M' ? historyDateLabel(anchor, { month: 'long', year: 'numeric' })
      : `${historyDateLabel(bounds.start)} – ${historyDateLabel(bounds.end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  return { ...bounds, title, grouped, buckets: [...groups.values()], visible };
}

// Fixed calendar slots keep gaps visible rather than moving unrelated dates together.
// Empty slots carry null, never a fabricated zero contribution.
export function historyChart(history: BankHistoryResponse, range: BankHistoryRange, anchor: string) {
  if (range === 'ALL') return [];
  const { start, end } = periodBounds(range, anchor);
  const groups = new Map<string, { id: string; label: string; total: number | null }>();
  for (let value = start; value <= end; value = shiftDate(value, 1)) {
    const id = range === 'Y' ? monthStart(value) : range === '3M' ? (weekStart(value) < start ? start : weekStart(value)) : value;
    if (!groups.has(id)) groups.set(id, {
      id,
      label: historyDateLabel(id, range === 'Y' || range === '3M' ? { month: 'short' } : range === 'W' ? { weekday: 'narrow' } : { day: 'numeric' }),
      total: null,
    });
  }
  for (const day of history.days) {
    if (day.logDate < start || day.logDate > end) continue;
    const id = range === 'Y' ? monthStart(day.logDate) : range === '3M' ? (weekStart(day.logDate) < start ? start : weekStart(day.logDate)) : day.logDate;
    const point = groups.get(id)!;
    point.total = (point.total ?? 0) + day.dailyBankChange;
  }
  return [...groups.values()];
}


export function canEditHistoricalIntake(day: {
  provenance: string; status: string; logDate: string; timezone: string; locksAt: string;
}, now = Date.now()) {
  if (day.provenance !== 'finalized' || day.status !== 'provisional' || !(Date.parse(day.locksAt) > now)) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: day.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
    const part = (type: string) => parts.find(value => value.type === type)?.value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    return day.logDate === shiftDate(today, -1) || day.logDate === shiftDate(today, -2);
  } catch { return false; }
}
