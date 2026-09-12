import type { DayEvidence, EvidenceCategory, EvidenceQuality, EvidenceWindow, QualifiedActivity } from '../native-health/evidence';

/** Private transport boundary: no native records or notes escape this directory. */
export type RecordEvidence = {
  id: string; origin: string; updatedAt: string; version: number;
  start: string; end: string; value: number | null; category: EvidenceCategory;
  startUtcOffsetSeconds: number | null; endUtcOffsetSeconds: number | null;
  activityType?: 'walking' | 'running' | 'other';
};
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' ? v as Record<string, unknown> : {};
const instant = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function decodeRecord(category: EvidenceCategory, input: unknown): RecordEvidence | null {
  const r = object(input), m = object(r.metadata);
  const start = r.startTime ?? r.time, end = r.endTime ?? r.time;
  if (typeof m.id !== 'string' || !m.id || typeof m.dataOrigin !== 'string' || !m.dataOrigin ||
      !instant(m.lastModifiedTime) || !instant(start) || !instant(end) || Date.parse(end) < Date.parse(start)) return null;
  const raw = category === 'steps' ? r.count : category === 'distance' ? object(r.distance).inMeters
    : category === 'resting_rate' ? object(r.basalMetabolicRate).inKilocaloriesPerDay
      : category === 'workouts' ? null : object(r.energy).inKilocalories;
  if ((raw === null || raw === undefined) && category !== 'nutrition' && category !== 'workouts') return null;
  if (raw !== null && raw !== undefined && (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || (category === 'steps' && !Number.isSafeInteger(raw)))) return null;
  return { id: m.id, origin: m.dataOrigin, updatedAt: m.lastModifiedTime,
    version: typeof m.clientRecordVersion === 'number' ? m.clientRecordVersion : 0,
    startUtcOffsetSeconds: typeof object(r.startZoneOffset ?? r.zoneOffset).totalSeconds === 'number' ? object(r.startZoneOffset ?? r.zoneOffset).totalSeconds as number : null,
    endUtcOffsetSeconds: typeof object(r.endZoneOffset ?? r.zoneOffset).totalSeconds === 'number' ? object(r.endZoneOffset ?? r.zoneOffset).totalSeconds as number : null,
    start, end, value: typeof raw === 'number' ? raw : null, category,
    ...(category === 'workouts' ? { activityType: r.exerciseType === 79 ? 'walking' : r.exerciseType === 56 || r.exerciseType === 57 ? 'running' : 'other' } as const : {}),
  };
}
export function uniqueRecords(records: RecordEvidence[]): { records: RecordEvidence[]; conflict: boolean } {
  const unique = new Map<string, RecordEvidence>(); let conflict = false;
  for (const r of records) {
    const key = `${r.category}|${r.origin}|${r.id}`, previous = unique.get(key);
    if (!previous) unique.set(key, r);
    else if (previous.updatedAt === r.updatedAt && previous.version === r.version && JSON.stringify(previous) !== JSON.stringify(r)) conflict = true;
    else if (Date.parse(r.updatedAt) > Date.parse(previous.updatedAt) || (r.updatedAt === previous.updatedAt && r.version > previous.version)) unique.set(key, r);
  }
  return { records: [...unique.values()], conflict };
}
function intersects(r: RecordEvidence, w: EvidenceWindow) {
  const start = Date.parse(r.start), end = Date.parse(r.end);
  return start === end ? start >= Date.parse(w.start) && start < Date.parse(w.end) : start < Date.parse(w.end) && end > Date.parse(w.start);
}
function quality(records: RecordEvidence[], w: EvidenceWindow): EvidenceQuality {
  if (!records.length) return 'empty';
  if (records.some((r) => Date.parse(r.start) < Date.parse(w.start) || Date.parse(r.end) > Date.parse(w.end))) return 'boundary_ambiguous';
  const ordered = [...records].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1]!, b = ordered[i]!;
    if (Date.parse(b.start) < Date.parse(a.end) || (b.start === a.start && b.end === a.end)) return 'ambiguous_overlap';
  }
  return 'usable_evidence';
}
export function normalizeDay(records: RecordEvidence[], window: EvidenceWindow, origin: string, granted: EvidenceCategory[], invalid: EvidenceCategory[]): DayEvidence {
  const selected = (category: EvidenceCategory) => records.filter((r) => r.origin === origin && r.category === category && intersects(r, window));
  const total = (category: EvidenceCategory) => {
    const rows = selected(category);
    const state = !granted.includes(category) ? 'permission_missing' : invalid.includes(category) ? 'invalid_records' : quality(rows, window);
    const complete = state === 'usable_evidence' && rows.every((r) => r.value !== null);
    const sum = complete ? rows.reduce((n, r) => n + r.value!, 0) : null;
    const usable = sum !== null && Number.isFinite(sum) && (category !== 'steps' || Number.isSafeInteger(sum));
    return { quality: complete && !usable ? 'invalid_records' as const : state === 'usable_evidence' && !usable ? 'no_calorie_records' as const : state,
      sum: usable ? sum : null,
      updatedAt: rows.length ? new Date(rows.reduce((latest, r) => Math.max(latest, Date.parse(r.updatedAt)), -Infinity)) : null };
  };
  const intake = total('nutrition'), steps = total('steps');
  const totals = selected('total_energy').sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const totalQuality = !granted.includes('total_energy') ? 'permission_missing' : quality(totals, window);
  let cursor = Date.parse(window.start);
  for (const row of totals) { if (Date.parse(row.start) !== cursor) break; cursor = Date.parse(row.end); }
  const coverage = totalQuality !== 'usable_evidence' && totalQuality !== 'empty' ? 'ambiguous' as const
    : !totals.length ? 'none' as const : cursor === Date.parse(window.end) ? 'complete_intervals' as const : 'gaps' as const;
  const dated = records.filter((r) => r.origin === origin && intersects(r, window));
  const sessions = selected('workouts');
  const activityEvidence: QualifiedActivity[] = granted.includes('workouts') && !invalid.includes('workouts') && quality(sessions, window) === 'usable_evidence'
    ? sessions.map((r) => ({ providerWorkoutId: r.id, activityType: r.activityType ?? 'other', displayName: r.activityType === 'walking' ? 'Walking' : r.activityType === 'running' ? 'Running' : 'Workout',
      startedAt: new Date(r.start), endedAt: new Date(r.end), durationMinutes: (Date.parse(r.end) - Date.parse(r.start)) / 60000,
      totalEnergyBurned: null, totalSteps: null, totalDistance: null, distanceUnit: null, providerUpdatedAt: new Date(r.updatedAt) })) : [];
  return { window, source: { namespace: 'android_package', id: origin },
    intake: { quality: intake.quality, value: intake.sum === null ? null : { totalCaloriesConsumed: intake.sum, providerUpdatedAt: intake.updatedAt } },
    steps: { quality: steps.quality, value: steps.sum === null ? null : { totalSteps: steps.sum, providerUpdatedAt: steps.updatedAt } },
    providerUpdatedAt: dated.length ? new Date(dated.reduce((latest, r) => Math.max(latest, Date.parse(r.updatedAt)), -Infinity)).toISOString() : null,
    burnEvidence: { totalRecordCount: totals.length, activeRecordCount: selected('active_energy').length, restingRateRecordCount: selected('resting_rate').length, coverage, quality: totalQuality },
    activityEvidence, walkingCalibration: 'insufficient_paired_evidence', caloriesBurned: null, burnQualification: 'not_qualified' };
}
