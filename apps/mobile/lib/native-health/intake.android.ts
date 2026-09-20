import { fetchProviderSelection, saveProviderSelection, uploadNativeIntake } from '../api/client';
import { nativeNutritionQualification } from '../health-connect/bridge.android';
import { discoverFoodOrigins } from '../health-connect/food-origins';
import type { NativeIntakeService, NativeIntakeResult } from './intake';
import type { NativeIntakeBatch, ProviderSelectionResponse } from '@caloriebank/schemas';
let scope: string | null = null, generation = 0;
let discovered = new Set<string>();
export function setNativeIntakeScope(next: string | null) {
  if (scope !== next) { scope = next; generation++; discovered.clear(); nativeNutritionQualification.cancel(); }
}
const stillCurrent = (run: number) => Boolean(scope) && run === generation;
async function refresh(): Promise<NativeIntakeResult> {
  const run = generation;
  if (!scope) return 'skipped';
  const selection = await fetchProviderSelection();
  if (!stillCurrent(run)) return 'skipped';
  if (!selection.intake.selectionRevision) return 'skipped';
  const sourceIds = selection.intake.refreshPlan
    ? [...new Set(selection.intake.refreshPlan.filter((entry) => entry.provider === 'health_connect' && entry.sourceId).map((entry) => entry.sourceId!))]
    : selection.intake.authoritativeProvider === 'health_connect' && selection.intake.nativeIntakeSource ? [selection.intake.nativeIntakeSource.id] : [];
  let result: NativeIntakeResult = 'skipped';
  for (const id of sourceIds) {
    const next = await refreshSource(run, selection, { namespace: 'android_package', id });
    if (next === 'access_required' || next === 'retry_required') return next;
    if (next === 'ready' || result !== 'ready') result = next;
  }
  return result;
}
async function refreshSource(run: number, selection: ProviderSelectionResponse, source: NativeIntakeBatch['source']): Promise<NativeIntakeResult> {
  if (!stillCurrent(run)) return 'skipped';
  const report = await nativeNutritionQualification.inspect(source.id);
  if (!stillCurrent(run) || report.state === 'cancelled') return 'skipped';
  if (!report.access.granted.includes('nutrition')) return 'access_required';
  if (!['complete', 'no_records'].includes(report.state) || report.readConsistency !== 'stable_read' || report.days.length !== 8) return 'retry_required';
  const days: NativeIntakeBatch['days'] = [];
  for (const day of report.days) {
    if (!['usable_evidence', 'empty', 'no_calorie_records', 'ambiguous_overlap', 'boundary_ambiguous'].includes(day.intake.quality) || day.source.id !== source.id) return 'retry_required';
    days.push({ localDate: day.window.localDate, quality: day.intake.quality as NativeIntakeBatch['days'][number]['quality'],
      totalCaloriesConsumed: day.intake.value === null ? null : Math.round(day.intake.value.totalCaloriesConsumed),
      providerUpdatedAt: day.intake.value?.providerUpdatedAt?.toISOString() ?? null });
  }
  if (!stillCurrent(run)) return 'skipped';
  await uploadNativeIntake({ source, selectionRevision: selection.intake.selectionRevision!, queryStartedAt: report.queryStartedAt,
    observedAt: report.observedAt, timezone: report.windows[0]!.timezone, days });
  if (!stillCurrent(run)) return 'skipped';
  if (days.some((day) => ['ambiguous_overlap', 'boundary_ambiguous'].includes(day.quality))) return 'retry_required';
  return days.some((day) => day.quality === 'usable_evidence') ? 'ready' : 'empty';
}
export const nativeIntake: NativeIntakeService = {
  supported: true,
  access: () => nativeNutritionQualification.access(),
  cancel() { generation++; discovered.clear(); nativeNutritionQualification.cancel(); },
  async discover(requestPermissions = false) {
    const run = generation;
    const access = await nativeNutritionQualification.access(requestPermissions);
    if (!stillCurrent(run) || !access.granted.includes('nutrition')) return { access, sources: [] };
    const report = await nativeNutritionQualification.inspect();
    const providers = await fetchProviderSelection();
    if (!stillCurrent(run)) return { access, sources: [] };
    const sources = discoverFoodOrigins(report, providers.connectedProviders);
    discovered = new Set(sources.map((s) => s.source.id));
    return { access: report.access, sources, queryState: report.state === 'complete' ? 'complete' : report.state === 'no_records' ? 'empty' : 'failed' };
  },
  async select(source) {
    const run = generation;
    if (!scope || !discovered.has(source.id)) return 'retry_required';
    const current = await fetchProviderSelection();
    if (!stillCurrent(run)) return 'skipped';
    await saveProviderSelection({ selectionRole: 'eaten', authoritativeExpenditureProvider: current.expenditure.authoritativeProvider,
      authoritativeActivityProvider: current.activityContext.authoritativeProvider,
      authoritativeIntakeProvider: 'health_connect', nativeIntakeSource: source });
    if (!stillCurrent(run)) return 'skipped';
    return refresh();
  },
  refresh,
  openSettings: () => nativeNutritionQualification.openSettings(),
};
