import { getRollingLocalDayWindows } from '@caloriebank/domain';
import type { EvidenceCategory, NativeAccess, NativeHealthQualification, QualificationReport } from '../native-health/evidence';
import { decodeRecord, normalizeDay, uniqueRecords, type RecordEvidence } from './normalize';

export const categories: EvidenceCategory[] = ['nutrition', 'steps', 'workouts', 'active_energy', 'total_energy', 'resting_rate', 'distance'];
export interface HealthEvidencePort {
  androidVersion: number;
  status(): Promise<number>;
  initialize(): Promise<boolean>;
  permissions(request: boolean): Promise<EvidenceCategory[]>;
  read(category: EvidenceCategory, start: string, end: string, pageToken?: string): Promise<{ records: unknown[]; pageToken?: string | undefined }>;
  changes(categories: EvidenceCategory[], token?: string): Promise<{ token: string; changed: boolean; expired: boolean; hasMore: boolean }>;
  settings(): Promise<boolean>;
}
const timeout = async <T>(work: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([work, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('query_timeout')), 15000); })]); }
  finally { clearTimeout(timer); }
};
export function createHealthQualification(port: HealthEvidencePort, now = () => new Date(), requiredCategories: readonly EvidenceCategory[] = categories): NativeHealthQualification & { setAccountScope(scope: string | null): void } {
  let scope: string | null = null, generation = 0;
  let permissionRequest: Promise<EvidenceCategory[]> | null = null;
  let previouslyObserved = new Set<string>();
  const access = async (request = false): Promise<NativeAccess> => {
    const result = (state: NativeAccess['state'], granted: EvidenceCategory[] = []): NativeAccess => ({ state, granted, missing: requiredCategories.filter((c) => !granted.includes(c)) });
    if (port.androidVersion < 28) return result('unsupported_version');
    try {
      const status = await timeout(port.status());
      if (status === 2) return result('setup_required');
      if (status !== 3) return result('unavailable');
      if (!await timeout(port.initialize())) return result('setup_required');
      // Permission prompts are explicit, foreground-only qualification actions.
      if (request && !scope) return result('permissions_missing');
      // Do not time out an OS prompt or launch a second prompt while it is visible.
      if (request && !permissionRequest) permissionRequest = port.permissions(true).finally(() => { permissionRequest = null; });
      const granted = [...new Set(await (request ? permissionRequest! : timeout(port.permissions(false))))].filter((c) => requiredCategories.includes(c));
      return result(!granted.length ? 'permissions_missing' : granted.length < requiredCategories.length ? 'partial_permissions' : 'available', granted);
    } catch { return result('native_query_failed'); }
  };
  return {
    access,
    setAccountScope(next) { if (scope !== next) { scope = next; generation++; previouslyObserved = new Set(); } },
    cancel() { generation++; },
    async openSettings() { try { return await port.settings(); } catch { return false; } },
    async inspect(origin) {
      const run = ++generation, account = scope, started = now(), deadline = Date.now() + 90000;
      const windows = getRollingLocalDayWindows(started, 8).map((w, i) => ({ localDate: w.localDate, timezone: w.timezone,
        start: w.dayStart.toISOString(), end: (i === 0 ? started : w.dayEnd).toISOString(), isCurrentDay: i === 0 }));
      let permissions = await access();
      const report = (state: QualificationReport['state']): QualificationReport => ({ state, access: permissions, queryStartedAt: started.toISOString(), observedAt: now().toISOString(), generation: run,
        windows, providerUpdatedAt: null, origins: [], originState: origin ? 'not_observed' : 'not_selected', counts: {}, days: [], readConsistency: 'unproven', forecastEligible: false, authoritative: false });
      const cancelled = () => !account || account !== scope || run !== generation;
      if (cancelled()) return report('cancelled');
      if (!permissions.granted.length) return report('access_required');
      try {
        const baseline = await timeout(port.changes(permissions.granted));
        if (!baseline.token || baseline.expired || baseline.hasMore) return report('changed_during_read');
        const records: RecordEvidence[] = [], invalid: EvidenceCategory[] = [];
        for (const category of permissions.granted) {
          let token: string | undefined; const seen = new Set<string>();
          for (let page = 0; page < 20; page++) {
            if (cancelled()) return report('cancelled');
            if (Date.now() > deadline) throw new Error('query_budget_exceeded');
            const batch = await timeout(port.read(category, windows[7]!.start, windows[0]!.end, token));
            if (!Array.isArray(batch.records) || batch.records.length > 1000) throw new Error('invalid_page');
            for (const raw of batch.records) {
              const row = decodeRecord(category, raw);
              if (row) records.push(row); else invalid.push(category);
            }
            token = batch.pageToken || undefined;
            if (!token) break;
            if (seen.has(token) || page === 19) throw new Error('incomplete_pagination');
            seen.add(token);
          }
        }
        const after = await timeout(port.changes(permissions.granted, baseline.token));
        const latestAccess = await access();
        const samePermissions = requiredCategories.every((c) => permissions.granted.includes(c) === latestAccess.granted.includes(c));
        permissions = latestAccess;
        if (cancelled()) return report('cancelled');
        if (!samePermissions) return report('access_required');
        if (now().getTime() < started.getTime() || Intl.DateTimeFormat().resolvedOptions().timeZone !== windows[0]!.timezone) return report('changed_during_read');
        if (after.changed || after.expired || after.hasMore) return report('changed_during_read');
        const unique = uniqueRecords(records);
        if (unique.conflict || invalid.length) return report('query_failed');
        const origins = [...new Set(unique.records.map((r) => r.origin))].sort();
        const result = report(unique.records.length ? 'complete' : 'no_records');
        result.providerUpdatedAt = unique.records.length ? new Date(unique.records.reduce((latest, r) => Math.max(latest, Date.parse(r.updatedAt)), -Infinity)).toISOString() : null;
        result.origins = origins.map((id) => ({ namespace: 'android_package', id }));
        result.originState = !origin ? 'not_selected' : origins.includes(origin) ? 'observed' : previouslyObserved.has(origin) ? 'previously_observed_now_absent' : 'not_observed';
        origins.forEach((id) => previouslyObserved.add(id));
        result.counts = Object.fromEntries(requiredCategories.map((c) => [c, unique.records.filter((r) => r.category === c).length]));
        result.days = origin ? windows.map((w) => normalizeDay(unique.records, w, origin, permissions.granted, invalid)) : [];
        result.readConsistency = 'stable_read';
        return result;
      } catch {
        if (cancelled()) return report('cancelled');
        permissions = await access();
        return report(permissions.state === 'permissions_missing' || permissions.state === 'partial_permissions' ? 'access_required' : 'query_failed');
      }
    },
  };
}
