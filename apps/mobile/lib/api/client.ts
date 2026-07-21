import {
  bankHistoryDayDetailResponseSchema,
  bankHistoryResponseSchema,
  bankHistoryRangeSchema,
  bankSummaryResponseSchema,
  goalConfigurationInputSchema,
  goalConfigurationResponseSchema,
  activePlannedTreatResponseSchema,
  plannedTreatGetResponseSchema,
  plannedTreatInputSchema,
  type BankHistoryDayDetailResponse,
  type BankHistoryRange,
  type BankHistoryResponse,
  type BankSummaryResponse,
  type GoalConfigurationInput,
  type GoalConfigurationResponse,
  type PlannedTreatGetResponse,
  type PlannedTreatInput,
  type ActivePlannedTreatResponse,
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

export function getApiBaseUrl() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  return apiUrl && apiUrl.length > 0 ? apiUrl.replace(/\/$/, '') : null;
}

async function apiRequest(path: string, init?: RequestInit) {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      signal: controller.signal,
    });
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

export async function fetchBankHistoryDay(
  logDate: string,
): Promise<BankHistoryDayDetailResponse> {
  const response = await apiRequest(`/v1/me/bank-history/${encodeURIComponent(logDate)}`);

  if (!response.ok) {
    throw new Error(`Unable to load that bank day (${response.status}).`);
  }

  return bankHistoryDayDetailResponseSchema.parse(await response.json());
}

export async function fetchPlannedTreat(): Promise<PlannedTreatGetResponse> {
  const response = await apiRequest('/v1/me/planned-treat');

  if (!response.ok) {
    throw new Error(`Unable to load your Planned Treat (${response.status}).`);
  }

  return plannedTreatGetResponseSchema.parse(await response.json());
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
