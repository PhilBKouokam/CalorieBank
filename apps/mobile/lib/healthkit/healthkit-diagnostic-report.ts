import type { HealthHistoryDiagnosticResponse } from '@caloriebank/schemas';

import type { HealthKitDiagnosticsSnapshot } from './healthkit-diagnostics';

export type HealthKitDateDiagnosticReport = {
  localDate: string;
  dietaryQuery: 'not attempted' | 'running' | 'succeeded' | 'failed';
  sampleCount: number | null;
  selectedWriterMatched: 'yes' | 'no' | 'unknown';
  normalizedIntakeAggregateCreated: boolean;
  upload: 'not queued' | 'queued' | 'fingerprint skipped' | 'succeeded' | 'failed';
  fingerprintSkipReason: 'fingerprint_match' | null;
  serverIntakeAggregate: 'present' | 'absent' | 'unknown';
  serverExpenditureAggregate: 'present' | 'absent' | 'unknown';
  historicalState: 'ready' | 'waiting for intake' | 'waiting for burn' | 'failed' | 'finalized' | 'unknown';
};

export function betaDiagnosticsEnabled(appEnvironment: string | undefined, isDevelopment: boolean) {
  return isDevelopment || appEnvironment === 'beta';
}

function historicalState(
  value: HealthHistoryDiagnosticResponse['dates'][number]['historicalState'] | undefined,
): HealthKitDateDiagnosticReport['historicalState'] {
  if (value === 'waiting_for_intake') return 'waiting for intake';
  if (value === 'waiting_for_burn') return 'waiting for burn';
  return value ?? 'unknown';
}

export function buildHealthKitDateDiagnosticReports(
  diagnostics: HealthKitDiagnosticsSnapshot | null,
  server: HealthHistoryDiagnosticResponse | null,
): HealthKitDateDiagnosticReport[] {
  if (!diagnostics) return [];
  const serverByDate = new Map(server?.dates.map((item) => [item.localDate, item]) ?? []);

  return diagnostics.rollingDates.map(({ localDate }) => {
    const query = diagnostics.queries.find(
      (item) => item.localDate === localDate && item.category === 'dietary_energy',
    );
    const upload = diagnostics.upload.items.find(
      (item) => item.localDate === localDate && item.category === 'intake',
    );
    const serverDate = serverByDate.get(localDate);
    const writerCheck = diagnostics.intakeWriterChecks.find((item) => item.localDate === localDate);
    const aggregateCreated = query?.normalizedAggregate !== null && query?.normalizedAggregate !== undefined;
    const dietaryQuery = diagnostics.syncRunning && !query
      ? 'running' as const
      : !query
        ? 'not attempted' as const
        : query.status === 'error'
          ? 'failed' as const
          : 'succeeded' as const;
    const sampleCount = writerCheck?.sampleCount ?? query?.sampleCount ?? null;
    const selectedWriterMatched = writerCheck?.status === 'writer_not_found'
      ? 'no' as const
      : writerCheck?.status === 'failed' || !query || query.status === 'error'
        ? 'unknown' as const
        : aggregateCreated || (sampleCount ?? 0) > 0
        ? 'yes' as const
        : sampleCount === 0 || query.status === 'empty'
          ? 'no' as const
          : 'unknown' as const;

    return {
      localDate,
      dietaryQuery,
      sampleCount,
      selectedWriterMatched,
      normalizedIntakeAggregateCreated: aggregateCreated,
      upload: !upload
        ? 'not queued'
        : upload.status === 'skipped' && upload.errorType === 'fingerprint_match'
          ? 'fingerprint skipped'
          : upload.status === 'success'
            ? 'succeeded'
            : upload.status === 'failure'
              ? 'failed'
              : 'queued',
      fingerprintSkipReason: upload?.status === 'skipped' && upload.errorType === 'fingerprint_match'
        ? 'fingerprint_match'
        : null,
      serverIntakeAggregate: serverDate
        ? serverDate.intakeAggregatePresent ? 'present' : 'absent'
        : 'unknown',
      serverExpenditureAggregate: serverDate
        ? serverDate.expenditureAggregatePresent ? 'present' : 'absent'
        : 'unknown',
      historicalState: historicalState(serverDate?.historicalState),
    };
  });
}

export function formatHealthKitDiagnosticReport(reports: HealthKitDateDiagnosticReport[]) {
  return reports.map((report) => [
    report.localDate,
    `Dietary query: ${report.dietaryQuery}`,
    `Samples: ${report.sampleCount === null ? 'unknown' : report.sampleCount}`,
    `Writer matched: ${report.selectedWriterMatched}`,
    `Aggregate created: ${report.normalizedIntakeAggregateCreated ? 'yes' : 'no'}`,
    `Upload: ${report.upload}`,
    `Fingerprint skip reason: ${report.fingerprintSkipReason ?? 'none'}`,
    `Server intake aggregate: ${report.serverIntakeAggregate}`,
    `Server burn aggregate: ${report.serverExpenditureAggregate}`,
    `Historical state: ${report.historicalState}`,
  ].join('\n')).join('\n\n');
}
