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

export async function fetchApiHealth(): Promise<HealthResponse> {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);

  const response = await fetch(`${apiBaseUrl}/health`, {
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId);
  });

  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}.`);
  }

  return (await response.json()) as HealthResponse;
}
