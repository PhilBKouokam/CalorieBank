import { describe, expect, it } from 'vitest';

import { composeAppleHealthConnections } from '../../mobile/lib/healthkit/health-connections-presentation';
import type { HealthConnectionsResponse } from '@caloriebank/schemas';

const option = (input: Partial<HealthConnectionsResponse['burned']['alternatives'][number]> = {}) => ({
  optionId: 'apple-burn',
  label: 'Apple Health',
  transportLabel: null,
  status: 'connected' as const,
  primaryAction: null,
  deviceManaged: true,
  ...input,
});

function connections(): HealthConnectionsResponse {
  return {
    burned: {
      selected: option({ optionId: 'fitbit', label: 'Fitbit', deviceManaged: false }),
      alternatives: [option()],
      canChange: true,
      canAddSource: false,
    },
    eaten: {
      selected: option({
        optionId: 'apple-intake',
        label: 'Cronometer',
        transportLabel: 'Apple Health',
      }),
      alternatives: [],
      canChange: false,
      canAddSource: true,
    },
    connectedServices: [option({ optionId: 'apple-service' })],
  };
}

describe('Apple Health account-scoped presentation', () => {
  it('does not reuse server evidence as current-account role readiness before refresh', () => {
    const result = composeAppleHealthConnections(connections(), 'not_connected');
    expect(result.burned.alternatives[0]).toMatchObject({
      label: 'Apple Health', status: 'no_data', primaryAction: 'refresh_apple_health',
    });
    expect(result.burned.canChange).toBe(false);
    expect(result.eaten.selected).toMatchObject({
      label: 'Cronometer', transportLabel: 'Apple Health', status: 'no_data',
      primaryAction: 'refresh_apple_health',
    });
  });

  it('preserves role-specific server readiness after a successful current-account refresh', () => {
    const result = composeAppleHealthConnections(connections(), 'connected');
    expect(result.burned.alternatives[0]?.status).toBe('connected');
    expect(result.burned.canChange).toBe(true);
    expect(result.eaten.selected?.status).toBe('connected');
  });

  it('shows completed empty burn separately without poisoning writer-specific intake', () => {
    const result = composeAppleHealthConnections(connections(), 'connected_partial', 'no_burn_data');
    expect(result.burned.alternatives[0]).toMatchObject({
      label: 'Apple Health', status: 'no_data', primaryAction: null,
    });
    expect(result.burned.canChange).toBe(false);
    expect(result.eaten.selected).toMatchObject({
      label: 'Cronometer', transportLabel: 'Apple Health', status: 'connected',
    });
  });

  it('keeps failed burn refresh retryable', () => {
    const result = composeAppleHealthConnections(connections(), 'sync_error', 'refresh_failed');
    expect(result.burned.alternatives[0]).toMatchObject({
      status: 'needs_attention', primaryAction: 'refresh_apple_health',
    });
  });
});
