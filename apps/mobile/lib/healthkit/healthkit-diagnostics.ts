export type HealthKitDiagnosticCategory =
  | 'active_energy'
  | 'resting_energy'
  | 'dietary_energy'
  | 'steps'
  | 'workouts';

export type HealthKitDiagnosticQueryStatus = 'success' | 'empty' | 'error';
export type HealthKitDiagnosticSyncStatus =
  | 'not_run'
  | 'success'
  | 'partial'
  | 'failure';

export type HealthKitDiagnosticError = {
  code: string | null;
  message: string;
};

export type HealthKitQueryDiagnostic = {
  category: HealthKitDiagnosticCategory;
  localDate: string;
  queryStart: string;
  queryEnd: string;
  status: HealthKitDiagnosticQueryStatus;
  sampleCount: number | null;
  normalizedAggregate: number | null;
  error: HealthKitDiagnosticError | null;
};

export type HealthKitUploadDiagnostic = {
  status: 'not_attempted' | 'success' | 'partial' | 'failure';
  attemptedCount: number;
  completedCount: number;
  pendingCount: number;
  failedCategories: string[];
  items: HealthKitUploadItemDiagnostic[];
};

export type HealthKitUploadItemDiagnostic = {
  category: 'expenditure' | 'intake' | 'steps' | 'workouts';
  localDate: string;
  endpoint: string;
  status: 'queued' | 'skipped' | 'success' | 'failure';
  errorType: string | null;
};

export type HealthKitOutboxDiagnostic = {
  queuedCount: number;
  oldestQueuedDate: string | null;
  lastRetryStatus: 'not_run' | 'success' | 'partial' | 'failure';
};

export type HealthKitDiagnosticsSnapshot = {
  healthKitAvailable: boolean | null;
  authorizationRequest: 'not_completed' | 'completed' | 'failed';
  lastSyncAt: string | null;
  syncRunning: boolean;
  lastSyncTrigger: string | null;
  lastSyncStartedAt: string | null;
  lastSyncCompletedAt: string | null;
  overallSyncResult: HealthKitDiagnosticSyncStatus;
  rollingDates: Array<{
    localDate: string;
    queryStart: string;
    queryEnd: string;
  }>;
  queries: HealthKitQueryDiagnostic[];
  intakeWriterChecks: Array<{
    localDate: string;
    status: 'succeeded' | 'failed' | 'writer_not_found';
    sampleCount: number | null;
  }>;
  upload: HealthKitUploadDiagnostic;
  outbox: HealthKitOutboxDiagnostic;
  error: HealthKitDiagnosticError | null;
};

export type AppleHealthPresentationState =
  | 'not_connected'
  | 'connected'
  | 'connected_partial'
  | 'sync_error'
  | 'unavailable';

export type AppleHealthBurnState =
  | 'needs_refresh'
  | 'refreshing'
  | 'ready'
  | 'no_burn_data'
  | 'refresh_failed'
  | 'needs_attention';

const EMPTY_UPLOAD: HealthKitUploadDiagnostic = {
  status: 'not_attempted',
  attemptedCount: 0,
  completedCount: 0,
  pendingCount: 0,
  failedCategories: [],
  items: [],
};

const EMPTY_OUTBOX: HealthKitOutboxDiagnostic = {
  queuedCount: 0,
  oldestQueuedDate: null,
  lastRetryStatus: 'not_run',
};

export function createHealthKitDiagnosticsSnapshot(
  input: Partial<HealthKitDiagnosticsSnapshot> = {},
): HealthKitDiagnosticsSnapshot {
  return {
    healthKitAvailable: input.healthKitAvailable ?? null,
    authorizationRequest: input.authorizationRequest ?? 'not_completed',
    lastSyncAt: input.lastSyncAt ?? null,
    syncRunning: input.syncRunning ?? false,
    lastSyncTrigger: input.lastSyncTrigger ?? null,
    lastSyncStartedAt: input.lastSyncStartedAt ?? null,
    lastSyncCompletedAt: input.lastSyncCompletedAt ?? null,
    overallSyncResult: input.overallSyncResult ?? 'not_run',
    rollingDates: input.rollingDates ?? [],
    queries: input.queries ?? [],
    intakeWriterChecks: input.intakeWriterChecks ?? [],
    upload: {
      ...EMPTY_UPLOAD,
      ...input.upload,
      items: input.upload?.items ?? [],
    },
    outbox: { ...EMPTY_OUTBOX, ...input.outbox },
    error: input.error ?? null,
  };
}

export function safeHealthKitError(error: unknown): HealthKitDiagnosticError {
  if (!(error instanceof Error)) {
    return { code: null, message: 'Unknown HealthKit error' };
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code.slice(0, 80) : null;
  return {
    code,
    message: error.message.replace(/\s+/g, ' ').slice(0, 180) || 'HealthKit operation failed',
  };
}

export function deriveHealthKitSyncStatus(
  queries: readonly HealthKitQueryDiagnostic[],
  upload: HealthKitUploadDiagnostic,
): HealthKitDiagnosticSyncStatus {
  const queryErrors = queries.filter((query) => query.status === 'error').length;
  const querySuccesses = queries.length - queryErrors;
  const uploadFailed = upload.status === 'failure';

  if ((queryErrors > 0 && querySuccesses === 0) || uploadFailed) return 'failure';
  if (queryErrors > 0 || queries.some((query) => query.status === 'empty') || upload.status === 'partial') {
    return 'partial';
  }
  return 'success';
}

export function deriveAppleHealthPresentationState(
  connectionStatus: 'not_connected' | 'connected' | 'unavailable',
  diagnostics: HealthKitDiagnosticsSnapshot | null,
): AppleHealthPresentationState {
  if (connectionStatus !== 'connected') return connectionStatus;
  if (!diagnostics || diagnostics.overallSyncResult === 'not_run') return 'connected';
  if (diagnostics.overallSyncResult === 'failure') return 'sync_error';
  if (diagnostics.overallSyncResult === 'partial') return 'connected_partial';
  return 'connected';
}

export function deriveAppleHealthBurnState(
  connectionStatus: 'not_connected' | 'connected' | 'unavailable',
  diagnostics: HealthKitDiagnosticsSnapshot | null,
): AppleHealthBurnState {
  if (connectionStatus === 'unavailable') return 'needs_attention';
  if (diagnostics?.syncRunning) return 'refreshing';
  if (connectionStatus !== 'connected' || !diagnostics?.lastSyncCompletedAt) return 'needs_refresh';
  if (diagnostics.overallSyncResult === 'failure') return 'refresh_failed';

  const dates = new Set(diagnostics.queries.map((query) => query.localDate));
  for (const localDate of dates) {
    const active = diagnostics.queries.find(
      (query) => query.localDate === localDate && query.category === 'active_energy',
    );
    const basal = diagnostics.queries.find(
      (query) => query.localDate === localDate && query.category === 'resting_energy',
    );
    if (active?.status === 'success' && basal?.status === 'success') return 'ready';
  }

  const burnQueries = diagnostics.queries.filter(
    (query) => query.category === 'active_energy' || query.category === 'resting_energy',
  );
  if (burnQueries.some((query) => query.status === 'error')) return 'refresh_failed';
  return 'no_burn_data';
}
