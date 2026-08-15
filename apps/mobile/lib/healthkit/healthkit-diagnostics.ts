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
};

export type HealthKitDiagnosticsSnapshot = {
  healthKitAvailable: boolean | null;
  authorizationRequest: 'not_completed' | 'completed' | 'failed';
  lastSyncAt: string | null;
  overallSyncResult: HealthKitDiagnosticSyncStatus;
  rollingDates: Array<{
    localDate: string;
    queryStart: string;
    queryEnd: string;
  }>;
  queries: HealthKitQueryDiagnostic[];
  upload: HealthKitUploadDiagnostic;
  error: HealthKitDiagnosticError | null;
};

export type AppleHealthPresentationState =
  | 'not_connected'
  | 'connected'
  | 'connected_partial'
  | 'sync_error'
  | 'unavailable';

const EMPTY_UPLOAD: HealthKitUploadDiagnostic = {
  status: 'not_attempted',
  attemptedCount: 0,
  completedCount: 0,
  pendingCount: 0,
  failedCategories: [],
};

export function createHealthKitDiagnosticsSnapshot(
  input: Partial<HealthKitDiagnosticsSnapshot> = {},
): HealthKitDiagnosticsSnapshot {
  return {
    healthKitAvailable: input.healthKitAvailable ?? null,
    authorizationRequest: input.authorizationRequest ?? 'not_completed',
    lastSyncAt: input.lastSyncAt ?? null,
    overallSyncResult: input.overallSyncResult ?? 'not_run',
    rollingDates: input.rollingDates ?? [],
    queries: input.queries ?? [],
    upload: input.upload ?? EMPTY_UPLOAD,
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

