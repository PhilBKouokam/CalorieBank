import {
  bankHistoryDayDetailResponseSchema,
  openingBankDetailResponseSchema,
  bankHistoryResponseSchema,
  bankHistoryRangeSchema,
  bankSummaryResponseSchema,
  historicalSourceMutationResponseSchema,
  historicalSourceOptionsResponseSchema,
  goalConfigurationInputSchema,
  goalConfigurationResponseSchema,
  currentDayExpenditureSyncSchema,
  restingBurnEstimateInputSchema,
  currentDayIntakeSyncSchema,
  currentDayStepSyncSchema,
  currentDayWorkoutSyncSchema,
  dashboardPreferencesPatchSchema,
  dashboardPreferencesResponseSchema,
  ingestionSyncResultSchema,
  ingestionSyncSessionCompleteSchema,
  ingestionSyncSessionResponseSchema,
  ingestionSyncSessionStartSchema,
  workoutSyncResultSchema,
  activePlannedTreatResponseSchema,
  plannedTreatGetResponseSchema,
  plannedTreatInputSchema,
  todayResponseSchema,
  googleHealthAuthorizationResponseSchema,
  googleHealthBurnParityDiagnosticResponseSchema,
  googleHealthSyncResponseSchema,
  providerSelectionInputSchema,
  providerSelectionResponseSchema,
  healthConnectionSelectionInputSchema,
  healthConnectionsResponseSchema,
  providerAuthorizationResponseSchema,
  providerRollingSyncResponseSchema,
  onboardingStatusResponseSchema,
  onboardingWelcomeInputSchema,
  type BankHistoryDayDetailResponse,
  type BankHistoryRange,
  type BankHistoryResponse,
  type OpeningBankDetailResponse,
  type GoogleHealthBurnParityDiagnosticResponse,
  type BankSummaryResponse,
  type HistoricalSourceMutationResponse,
  type HistoricalSourceOptionsResponse,
  type GoalConfigurationInput,
  type GoalConfigurationResponse,
  type CurrentDayExpenditureSync,
  type CurrentDayIntakeSync,
  type CurrentDayStepSync,
  type CurrentDayWorkoutSync,
  type DashboardPreferencesPatch,
  type DashboardPreferencesResponse,
  type IngestionSyncResult,
  type IngestionSyncSessionComplete,
  type IngestionSyncSessionResponse,
  type IngestionSyncSessionStart,
  type WorkoutSyncResult,
  type PlannedTreatGetResponse,
  type PlannedTreatInput,
  type ActivePlannedTreatResponse,
  type TodayResponse,
  type GoogleHealthSyncResponse,
  type ProviderSelectionInput,
  type ProviderSelectionResponse,
  type HealthConnectionsResponse,
  type OnboardingStatusResponse,
} from '@caloriebank/schemas';

export type HealthResponse = {
  status: 'ok';
  service: 'caloriebank-api';
};

export type ApiHealthState =
  | {
      status: 'loading';
      label: 'Checking API';
      detail: string;
    }
  | {
      status: 'connected';
      label: 'API connected';
      detail: string;
    }
  | {
      status: 'unavailable';
      label: 'API unavailable';
      detail: string;
    };

export type ApiNetworkDiagnostics = {
  baseUrl: string | null;
  reachability: 'not_checked' | 'reachable' | 'network_error' | 'timeout' | 'misconfigured';
  lastRequestAt: string | null;
  lastRequestPath: string | null;
  lastRequestStatus: string;
  lastHttpStatus: number | null;
};

export type ApiRequestFailureKind = 'timeout' | 'cancelled' | 'network' | 'unknown';

export type ApiHttpErrorKind = 'authentication' | 'forbidden' | 'conflict' | 'service' | 'unknown';

export class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly kind: ApiHttpErrorKind,
    readonly code: string | null,
  ) {
    super(`CalorieBank request failed with status ${status}.`);
    this.name = 'ApiHttpError';
  }
}

export class ApiAuthenticationPendingError extends Error {
  constructor() {
    super('Authentication is still becoming ready.');
    this.name = 'ApiAuthenticationPendingError';
  }
}

export class ProviderAuthorizationError extends Error {
  constructor(readonly code: 'CONFIGURATION_ERROR' | 'INVALID_REDIRECT' | 'ALREADY_CONNECTED' | 'TEMPORARY_ERROR') {
    super('Provider authorization could not start.');
    this.name = 'ProviderAuthorizationError';
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly kind: ApiRequestFailureKind,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function classifyApiRequestFailure(
  error: unknown,
  timeoutTriggered = false,
): ApiRequestFailureKind {
  if (error instanceof Error && error.name === 'AbortError') {
    return timeoutTriggered ? 'timeout' : 'cancelled';
  }
  if (error instanceof TypeError || (error instanceof Error && /network request failed/i.test(error.message))) {
    return 'network';
  }
  return 'unknown';
}

export function getApiRequestFailureKind(error: unknown): ApiRequestFailureKind {
  return error instanceof ApiRequestError ? error.kind : classifyApiRequestFailure(error);
}

let loggedApiBaseUrl: string | null = null;
let accessTokenProvider: (() => Promise<string | null>) | null = null;
let apiAuthState = { ready: false, activeSessionPresent: false };
let apiNetworkDiagnostics: ApiNetworkDiagnostics = {
  baseUrl: null,
  reachability: 'not_checked',
  lastRequestAt: null,
  lastRequestPath: null,
  lastRequestStatus: 'Not checked',
  lastHttpStatus: null,
};

function safeConfigurationFingerprint(value: string) {
  // FNV-1a is only a non-reversible diagnostic label, never an auth primitive.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

let loggedClerkConfigurationFingerprint: string | null = null;

export function logMobileClerkConfiguration() {
  if (!__DEV__) return;
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return;
  const fingerprint = safeConfigurationFingerprint(publishableKey);
  if (loggedClerkConfigurationFingerprint === fingerprint) return;
  loggedClerkConfigurationFingerprint = fingerprint;
  console.info('[CalorieBank Auth] clerk_configuration', {
    publishableKeyEnvironment: publishableKey.startsWith('pk_test_') ? 'test' : publishableKey.startsWith('pk_live_') ? 'live' : 'unknown',
    publishableKeyFingerprint: fingerprint,
  });
}

export function getApiBaseUrl() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const baseUrl = apiUrl && apiUrl.length > 0 ? apiUrl.replace(/\/$/, '') : null;
  if (__DEV__ && baseUrl && loggedApiBaseUrl !== baseUrl) {
    console.info(`[CalorieBank API] base_url ${baseUrl}`);
    loggedApiBaseUrl = baseUrl;
  }
  return baseUrl;
}

export function setApiAccessTokenProvider(
  provider: (() => Promise<string | null>) | null,
  state: { ready: boolean; activeSessionPresent: boolean } = { ready: false, activeSessionPresent: false },
) {
  accessTokenProvider = provider;
  apiAuthState = state;
}

export function getApiAuthenticationState() {
  return { ...apiAuthState, tokenGetterReady: accessTokenProvider !== null };
}

export function isApiAuthenticationReady(authMode = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'development') {
  return authMode !== 'clerk' || (
    apiAuthState.ready && apiAuthState.activeSessionPresent && accessTokenProvider !== null
  );
}

function classifyHttpStatus(status: number): ApiHttpErrorKind {
  if (status === 401) return 'authentication';
  if (status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'service';
  return 'unknown';
}

async function responseError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: { details?: { code?: unknown } } } | null;
  const rawCode = payload?.error?.details?.code;
  return new ApiHttpError(
    response.status,
    classifyHttpStatus(response.status),
    typeof rawCode === 'string' ? rawCode.slice(0, 80) : null,
  );
}

export function getApiNetworkDiagnostics(): ApiNetworkDiagnostics {
  return { ...apiNetworkDiagnostics, baseUrl: getApiBaseUrl() };
}

async function apiRequest(path: string, init?: RequestInit) {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    apiNetworkDiagnostics = {
      baseUrl: null,
      reachability: 'misconfigured',
      lastRequestAt: new Date().toISOString(),
      lastRequestPath: path,
      lastRequestStatus: 'API URL is not configured',
      lastHttpStatus: null,
    };
    throw new Error('EXPO_PUBLIC_API_URL is not configured.');
  }

  const controller = new AbortController();
  let timeoutTriggered = false;
  const timeoutId = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, 20000);

  try {
    const authMode = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'development';
    if (!isApiAuthenticationReady(authMode)) {
      throw new ApiAuthenticationPendingError();
    }
    const token = authMode === 'clerk' ? await accessTokenProvider?.() ?? null : null;
    if (authMode === 'clerk' && !token) {
      throw new ApiAuthenticationPendingError();
    }
    if (__DEV__ && authMode === 'clerk') {
      console.info('[CalorieBank API Auth] request_auth_attachment', {
        endpoint: path,
        activeSessionPresent: apiAuthState.activeSessionPresent,
        tokenResolved: Boolean(token),
        authorizationHeaderAttached: Boolean(token),
      });
    }
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
      signal: controller.signal,
    });
    apiNetworkDiagnostics = {
      baseUrl: apiBaseUrl,
      reachability: 'reachable',
      lastRequestAt: new Date().toISOString(),
      lastRequestPath: path,
      lastRequestStatus: `HTTP ${response.status}`,
      lastHttpStatus: response.status,
    };
    return response;
  } catch (error) {
    if (error instanceof ApiAuthenticationPendingError || error instanceof ApiHttpError) throw error;
    const failureKind = classifyApiRequestFailure(error, timeoutTriggered);
    apiNetworkDiagnostics = {
      baseUrl: apiBaseUrl,
      reachability: failureKind === 'timeout' ? 'timeout' : 'network_error',
      lastRequestAt: new Date().toISOString(),
      lastRequestPath: path,
      lastRequestStatus: failureKind === 'timeout'
        ? 'Request timed out'
        : failureKind === 'cancelled'
          ? 'Request cancelled'
          : 'Network request failed',
      lastHttpStatus: null,
    };
    throw new ApiRequestError(apiNetworkDiagnostics.lastRequestStatus, failureKind);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchApiHealth(): Promise<HealthResponse> {
  const response = await apiRequest('/health');

  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}.`);
  }

  return (await response.json()) as HealthResponse;
}

export async function checkApiReachability(): Promise<ApiNetworkDiagnostics> {
  const previous = apiNetworkDiagnostics;
  try {
    await fetchApiHealth();
  } catch {
    // The development diagnostics surface reports the sanitized request result.
  }
  const healthCheck = apiNetworkDiagnostics;
  if (previous.lastRequestAt !== null) {
    apiNetworkDiagnostics = {
      ...previous,
      baseUrl: healthCheck.baseUrl,
      reachability: healthCheck.reachability,
    };
  }
  return getApiNetworkDiagnostics();
}

export async function fetchGoalConfiguration(): Promise<GoalConfigurationResponse | null> {
  const response = await apiRequest('/v1/me/goal-configuration');

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Unable to load your goal configuration (${response.status}).`);
  }

  return goalConfigurationResponseSchema.parse(await response.json());
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatusResponse> {
  const response = await apiRequest('/v1/me/onboarding');
  if (!response.ok) throw await responseError(response);
  return onboardingStatusResponseSchema.parse(await response.json());
}

export async function completeOnboardingWelcome(): Promise<OnboardingStatusResponse> {
  const response = await apiRequest('/v1/me/onboarding/welcome', {
    method: 'PATCH',
    body: JSON.stringify(onboardingWelcomeInputSchema.parse({ completed: true })),
  });
  if (!response.ok) throw new Error('Unable to save setup progress.');
  return onboardingStatusResponseSchema.parse(await response.json());
}

export async function completeOnboarding(): Promise<OnboardingStatusResponse> {
  const response = await apiRequest('/v1/me/onboarding/complete', { method: 'POST' });
  if (!response.ok) throw new Error('Unable to finish setup.');
  return onboardingStatusResponseSchema.parse(await response.json());
}

export async function saveGoalConfiguration(
  input: GoalConfigurationInput,
): Promise<GoalConfigurationResponse> {
  const validInput = goalConfigurationInputSchema.parse(input);
  const response = await apiRequest('/v1/me/goal-configuration', {
    method: 'PUT',
    body: JSON.stringify(validInput),
  });

  if (!response.ok) {
    throw new Error(`Unable to save your goal configuration (${response.status}).`);
  }

  return goalConfigurationResponseSchema.parse(await response.json());
}

export async function fetchBankSummary(): Promise<BankSummaryResponse> {
  const response = await apiRequest('/v1/me/bank-summary');

  if (!response.ok) {
    throw new Error(`Unable to load your bank summary (${response.status}).`);
  }

  return bankSummaryResponseSchema.parse(await response.json());
}

export async function fetchBankHistory(range: BankHistoryRange): Promise<BankHistoryResponse> {
  const validRange = bankHistoryRangeSchema.parse(range);
  const response = await apiRequest(`/v1/me/bank-history?range=${encodeURIComponent(validRange)}`);

  if (!response.ok) {
    throw new Error(`Unable to load your bank history (${response.status}).`);
  }

  return bankHistoryResponseSchema.parse(await response.json());
}

export async function fetchOpeningBankDetail(): Promise<OpeningBankDetailResponse> {
  const response = await apiRequest('/v1/me/bank-opening');
  if (!response.ok) throw new Error(`Unable to load your Opening Bank (${response.status}).`);
  return openingBankDetailResponseSchema.parse(await response.json());
}

export async function fetchBankHistoryDay(
  logDate: string,
): Promise<BankHistoryDayDetailResponse> {
  const response = await apiRequest(`/v1/me/bank-history/${encodeURIComponent(logDate)}`);

  if (!response.ok) {
    throw new Error(`Unable to load that bank day (${response.status}).`);
  }

  return bankHistoryDayDetailResponseSchema.parse(await response.json());
}

export async function fetchHistoricalSourceOptions(logDate: string): Promise<HistoricalSourceOptionsResponse> {
  const response = await apiRequest(`/v1/me/bank-history/${encodeURIComponent(logDate)}/sources`);
  if (!response.ok) throw await responseError(response);
  return historicalSourceOptionsResponseSchema.parse(await response.json());
}

export async function changeHistoricalSource(
  logDate: string,
  role: 'expenditure' | 'intake',
  input: { optionId: string; expectedRevision: number; idempotencyKey: string },
): Promise<HistoricalSourceMutationResponse> {
  const response = await apiRequest(`/v1/me/bank-history/${encodeURIComponent(logDate)}/sources/${role}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response);
  return historicalSourceMutationResponseSchema.parse(await response.json());
}

export async function fetchPlannedTreat(): Promise<PlannedTreatGetResponse> {
  const response = await apiRequest('/v1/me/planned-treat');

  if (!response.ok) {
    throw new Error(`Unable to load your Planned Treat (${response.status}).`);
  }

  return plannedTreatGetResponseSchema.parse(await response.json());
}

export async function fetchToday(timezone?: string): Promise<TodayResponse> {
  const query = timezone ? `?timezone=${encodeURIComponent(timezone)}` : '';
  const response = await apiRequest(`/v1/me/today${query}`);

  if (!response.ok) {
    throw new Error(`Unable to load today's awareness values (${response.status}).`);
  }

  return todayResponseSchema.parse(await response.json());
}

export async function fetchProviderSelection(): Promise<ProviderSelectionResponse> {
  const response = await apiRequest('/v1/me/provider-selection');
  if (!response.ok) throw new Error('Unable to load health connection choices.');
  return providerSelectionResponseSchema.parse(await response.json());
}

export async function saveProviderSelection(input: ProviderSelectionInput) {
  const response = await apiRequest('/v1/me/provider-selection', {
    method: 'PUT', body: JSON.stringify(providerSelectionInputSchema.parse(input)),
  });
  if (!response.ok) throw new Error('Unable to update the calorie-burn source.');
  return providerSelectionResponseSchema.parse(await response.json());
}

export async function fetchHealthConnections(): Promise<HealthConnectionsResponse> {
  const response = await apiRequest('/v1/me/health-connections');
  if (!response.ok) throw await responseError(response);
  return healthConnectionsResponseSchema.parse(await response.json());
}

export async function selectHealthConnectionRole(
  role: 'burned' | 'eaten',
  optionId: string,
): Promise<HealthConnectionsResponse> {
  const response = await apiRequest(`/v1/me/health-connections/${role}`, {
    method: 'PUT',
    body: JSON.stringify(healthConnectionSelectionInputSchema.parse({ optionId })),
  });
  if (!response.ok) throw await responseError(response);
  return healthConnectionsResponseSchema.parse(await response.json());
}

export const MOBILE_INTEGRATION_REDIRECT_URI = 'caloriebank://integrations';

async function providerAuthorizationError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: { details?: { code?: unknown } } } | null;
  const code = payload?.error?.details?.code;
  throw new ProviderAuthorizationError(
    code === 'CONFIGURATION_ERROR' || code === 'INVALID_REDIRECT' || code === 'ALREADY_CONNECTED'
      ? code
      : 'TEMPORARY_ERROR',
  );
}

export async function startFitbitAuthorization(mobileRedirectUri = MOBILE_INTEGRATION_REDIRECT_URI) {
  const response = await apiRequest(
    `/v1/me/integrations/fitbit/authorize?mobileRedirectUri=${encodeURIComponent(mobileRedirectUri)}`,
  );
  if (!response.ok) await providerAuthorizationError(response);
  return googleHealthAuthorizationResponseSchema.parse(await response.json());
}

export async function syncFitbit(timezone: string, force = false, initialHistory = false): Promise<GoogleHealthSyncResponse> {
  const response = await apiRequest('/v1/me/integrations/fitbit/sync', {
    method: 'POST', body: JSON.stringify({ timezone, force, initialHistory }),
  });
  if (!response.ok) throw new Error('Fitbit could not refresh.');
  return googleHealthSyncResponseSchema.parse(await response.json());
}

export async function fetchGoogleHealthBurnParityDiagnostic(
  localDate: string,
  timezone: string,
): Promise<GoogleHealthBurnParityDiagnosticResponse> {
  const query = new URLSearchParams({ localDate, timezone });
  const response = await apiRequest(`/v1/me/integrations/fitbit/diagnostics/burn-parity?${query}`);
  if (!response.ok) throw new Error('Google Health burn parity diagnostic failed.');
  return googleHealthBurnParityDiagnosticResponseSchema.parse(await response.json());
}

export async function disconnectFitbit() {
  const response = await apiRequest('/v1/me/integrations/fitbit', { method: 'DELETE' });
  if (!response.ok) throw await responseError(response);
}

export async function startWhoopAuthorization() {
  const response = await apiRequest(
    `/v1/me/integrations/whoop/authorize?mobileRedirectUri=${encodeURIComponent('caloriebank://integrations')}`,
  );
  if (!response.ok) throw new Error('WHOOP connection is not available.');
  return providerAuthorizationResponseSchema.parse(await response.json());
}

export async function syncWhoop(timezone: string, force = false) {
  const response = await apiRequest('/v1/me/integrations/whoop/sync', {
    method: 'POST', body: JSON.stringify({ timezone, force }),
  });
  if (!response.ok) throw new Error('WHOOP could not refresh.');
  return providerRollingSyncResponseSchema.parse(await response.json());
}

export async function disconnectWhoop() {
  const response = await apiRequest('/v1/me/integrations/whoop', { method: 'DELETE' });
  if (!response.ok) throw new Error('WHOOP could not be disconnected.');
}

export async function startFatSecretAuthorization(mobileRedirectUri = MOBILE_INTEGRATION_REDIRECT_URI) {
  const response = await apiRequest(
    `/v1/me/integrations/fatsecret/authorize?mobileRedirectUri=${encodeURIComponent(mobileRedirectUri)}`,
  );
  if (!response.ok) throw new Error('FatSecret connection is not available.');
  return providerAuthorizationResponseSchema.parse(await response.json());
}

export async function syncFatSecret(timezone: string, force = false, initialHistory = false) {
  const response = await apiRequest('/v1/me/integrations/fatsecret/sync', {
    method: 'POST', body: JSON.stringify({ timezone, force, initialHistory }),
  });
  if (!response.ok) throw new Error('FatSecret could not refresh.');
  return providerRollingSyncResponseSchema.parse(await response.json());
}

export async function disconnectFatSecret() {
  const response = await apiRequest('/v1/me/integrations/fatsecret', { method: 'DELETE' });
  if (!response.ok) throw await responseError(response);
}

export async function runForegroundLifecycle(
  timezone: string,
  trigger: 'app_foreground' | 'manual_refresh',
) {
  const response = await apiRequest('/v1/me/lifecycle/foreground', {
    method: 'POST',
    body: JSON.stringify({ timezone, trigger }),
  });
  if (!response.ok) throw await responseError(response);
  return await response.json() as {
    shouldSyncHealthKit: boolean;
    unresolvedDates: string[];
    errors: Array<{ provider: string; code: string }>;
  };
}

export async function syncCurrentDayExpenditure(
  input: CurrentDayExpenditureSync,
): Promise<IngestionSyncResult> {
  const validInput = currentDayExpenditureSyncSchema.parse(input);
  const response = await apiRequest('/v1/me/ingestion/expenditure', {
    method: 'POST',
    body: JSON.stringify(validInput),
  });

  if (!response.ok) {
    throw new Error(`Unable to sync current-day expenditure (${response.status}).`);
  }

  return ingestionSyncResultSchema.parse(await response.json());
}

export async function syncRestingBurnEstimate(
  input: import('@caloriebank/schemas').RestingBurnEstimateInput,
) {
  const validInput = restingBurnEstimateInputSchema.parse(input);
  const response = await apiRequest('/v1/me/ingestion/resting-burn-estimate', {
    method: 'POST',
    body: JSON.stringify(validInput),
  });
  if (!response.ok) throw new Error(`Unable to sync resting-burn estimate (${response.status}).`);
}

export async function syncCurrentDayIntake(
  input: CurrentDayIntakeSync,
): Promise<IngestionSyncResult> {
  const validInput = currentDayIntakeSyncSchema.parse(input);
  const response = await apiRequest('/v1/me/ingestion/intake', {
    method: 'POST',
    body: JSON.stringify(validInput),
  });

  if (!response.ok) {
    throw new Error(`Unable to sync current-day intake (${response.status}).`);
  }

  return ingestionSyncResultSchema.parse(await response.json());
}

export async function syncCurrentDaySteps(
  input: CurrentDayStepSync,
): Promise<IngestionSyncResult> {
  const validInput = currentDayStepSyncSchema.parse(input);
  const response = await apiRequest('/v1/me/ingestion/steps', {
    method: 'POST',
    body: JSON.stringify(validInput),
  });
  if (!response.ok) throw new Error(`Unable to sync current-day steps (${response.status}).`);
  return ingestionSyncResultSchema.parse(await response.json());
}

export async function syncCurrentDayWorkouts(
  input: CurrentDayWorkoutSync,
): Promise<WorkoutSyncResult> {
  const validInput = currentDayWorkoutSyncSchema.parse(input);
  const response = await apiRequest('/v1/me/ingestion/workouts', {
    method: 'POST',
    body: JSON.stringify(validInput),
  });
  if (!response.ok) throw new Error(`Unable to sync current-day workouts (${response.status}).`);
  return workoutSyncResultSchema.parse(await response.json());
}

export async function startIngestionSyncSession(
  input: IngestionSyncSessionStart,
): Promise<IngestionSyncSessionResponse> {
  const validInput = ingestionSyncSessionStartSchema.parse(input);
  const response = await apiRequest('/v1/me/ingestion/sync-sessions', {
    method: 'POST',
    body: JSON.stringify(validInput),
  });
  if (!response.ok) throw new Error(`Unable to start health sync (${response.status}).`);
  return ingestionSyncSessionResponseSchema.parse(await response.json());
}

export async function completeIngestionSyncSession(
  sessionId: string,
  input: IngestionSyncSessionComplete,
): Promise<IngestionSyncSessionResponse> {
  const validInput = ingestionSyncSessionCompleteSchema.parse(input);
  const response = await apiRequest(`/v1/me/ingestion/sync-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(validInput),
  });
  if (!response.ok) throw new Error(`Unable to complete health sync (${response.status}).`);
  return ingestionSyncSessionResponseSchema.parse(await response.json());
}

export async function fetchDashboardPreferences(): Promise<DashboardPreferencesResponse> {
  const response = await apiRequest('/v1/me/dashboard-preferences');
  if (!response.ok) throw new Error(`Unable to load Today preferences (${response.status}).`);
  return dashboardPreferencesResponseSchema.parse(await response.json());
}

export async function updateDashboardPreferences(
  patch: DashboardPreferencesPatch,
): Promise<DashboardPreferencesResponse> {
  const validPatch = dashboardPreferencesPatchSchema.parse(patch);
  const response = await apiRequest('/v1/me/dashboard-preferences', {
    method: 'PATCH',
    body: JSON.stringify(validPatch),
  });
  if (!response.ok) throw new Error(`Unable to save Today preferences (${response.status}).`);
  return dashboardPreferencesResponseSchema.parse(await response.json());
}

export async function createOrReplacePlannedTreat(
  input: PlannedTreatInput,
): Promise<ActivePlannedTreatResponse> {
  const validInput = plannedTreatInputSchema.parse(input);
  const response = await apiRequest('/v1/me/planned-treat', {
    method: 'POST',
    body: JSON.stringify(validInput),
  });

  if (!response.ok) {
    throw new Error(`Unable to save your Planned Treat (${response.status}).`);
  }

  return activePlannedTreatResponseSchema.parse(await response.json());
}

export async function updatePlannedTreat(
  input: PlannedTreatInput,
): Promise<ActivePlannedTreatResponse> {
  const validInput = plannedTreatInputSchema.parse(input);
  const response = await apiRequest('/v1/me/planned-treat', {
    method: 'PATCH',
    body: JSON.stringify(validInput),
  });

  if (!response.ok) {
    throw new Error(`Unable to update your Planned Treat (${response.status}).`);
  }

  return activePlannedTreatResponseSchema.parse(await response.json());
}

export async function deletePlannedTreat(): Promise<void> {
  const response = await apiRequest('/v1/me/planned-treat', {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Unable to remove your Planned Treat (${response.status}).`);
  }
}
