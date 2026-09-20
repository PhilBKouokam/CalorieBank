import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { compatibleProviderSelectionResponseSchema, healthConnectionsResponseSchema, isKnownIntakeProvider, providerSelectionInputSchema, providerSelectionResponseSchema } from '@caloriebank/schemas';
import { initialImportPlan } from '../../mobile/lib/onboarding/onboarding-recovery';

const selection = (provider: string) => ({
  expenditure: { selected: true, authoritativeProvider: 'google_health_fitbit', displayName: 'Fitbit', status: 'ready', fallbackActive: false },
  activityContext: { authoritativeProvider: 'google_health_fitbit', displayName: 'Fitbit', status: 'ready', fallbackActive: false },
  intake: { selected: true, authoritativeProvider: provider, displayName: 'Calorie source', status: 'ready', writerBundleIdentifier: null, writerDisplayName: null },
  connectedProviders: [],
});
// Frozen pre-1A intake contract: intentionally independent of the new validator.
const legacyIntake = z.object({ selected: z.boolean().optional(), authoritativeProvider: z.enum(['apple_health', 'fatsecret', 'health_connect']), displayName: z.string().min(1), status: z.enum(['not_connected', 'connected', 'ready', 'unavailable', 'needs_attention']), writerBundleIdentifier: z.string().nullable(), writerDisplayName: z.string().nullable() });

describe('intake wire compatibility without enabling future authorities', () => {
  it.each(['apple_health', 'fatsecret', 'health_connect'])('retains legacy %s serialization and parsing', (provider) => {
    const response = providerSelectionResponseSchema.parse(selection(provider));
    expect(legacyIntake.parse(response.intake)).toEqual(response.intake);
    expect(compatibleProviderSelectionResponseSchema.parse(response)).toEqual(response);
  });
  it('accepts future identity for reads but neither emits nor accepts it as a server mutation', () => {
    const fixture = selection('manual_estimate');
    const parsed = compatibleProviderSelectionResponseSchema.parse(fixture);
    expect(parsed.intake.authoritativeProvider).toBe('manual_estimate');
    expect(isKnownIntakeProvider(parsed.intake.authoritativeProvider)).toBe(false);
    expect(providerSelectionResponseSchema.safeParse(fixture).success).toBe(false);
    expect(legacyIntake.safeParse(fixture.intake).success).toBe(false);
    expect(providerSelectionInputSchema.safeParse({ authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeIntakeProvider: 'manual_estimate' }).success).toBe(false);
    expect(initialImportPlan(parsed)).toEqual({ fitbit: true, fatSecret: false, appleHealth: false });
  });
  it('represents authoritative availability without inventing an external connection', () => {
    const empty = { selected: null, alternatives: [], canChange: false, canAddSource: true };
    const response = healthConnectionsResponseSchema.parse({ burned: empty, eaten: { ...empty, selected: { optionId: 'future-intake-v1', label: 'Calorie source', status: 'available', transportLabel: null, primaryAction: null, deviceManaged: false } }, connectedServices: [] });
    expect(response.eaten.selected?.status).toBe('available');
    expect(response.connectedServices).toEqual([]);
  });
});
