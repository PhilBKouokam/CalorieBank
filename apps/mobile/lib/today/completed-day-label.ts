/** Calendar-day comparison, not a rolling 24 hours (including DST). */
export function completedDayLabel(date: string | null | undefined, now = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const localToday = `${part('year')}-${part('month')}-${part('day')}`;
  const yesterday = new Date(`${localToday}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) return 'yesterday';
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', ...(date.slice(0, 4) !== localToday.slice(0, 4) ? { year: 'numeric' as const } : {}) }).format(parsed);
}
