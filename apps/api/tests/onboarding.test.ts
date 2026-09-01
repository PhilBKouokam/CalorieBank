import type { BankSummaryResponse, ProviderSelectionResponse } from '@caloriebank/schemas';
import { describe, expect, it } from 'vitest';

import { deriveOnboardingStatus, type OnboardingFacts } from '../src/modules/onboarding/onboarding.repository';
import { emptyTodayDetail, emptyTodayValue } from '../../mobile/lib/today/presentation';

const selection: ProviderSelectionResponse = {
  expenditure: { authoritativeProvider: 'google_health_fitbit', displayName: 'Fitbit', status: 'ready', fallbackActive: false },
  activityContext: { authoritativeProvider: 'google_health_fitbit', displayName: 'Fitbit', status: 'ready', fallbackActive: false },
  intake: {
    authoritativeProvider: 'fatsecret', displayName: 'FatSecret', status: 'ready',
    writerBundleIdentifier: null, writerDisplayName: null,
  },
  connectedProviders: [
    { provider: 'apple_health', displayName: 'Apple Health', capabilities: capabilities({ expenditure: true, expenditureCapability: 'derivable_total', intake: true, steps: true, workouts: true, workoutEnergy: true, workoutDuration: true, distance: true, historicalBackfill: true }), status: 'not_connected', lastSyncedAt: null },
    { provider: 'google_health_fitbit', displayName: 'Fitbit', capabilities: capabilities({ expenditure: true, expenditureCapability: 'full_total', steps: true, workouts: true, workoutEnergy: true, workoutDuration: true, distance: true, historicalBackfill: true, oauth: true }), status: 'connected', lastSyncedAt: null },
    { provider: 'fatsecret', displayName: 'FatSecret', capabilities: capabilities({ intake: true, historicalBackfill: true, oauth: true }), status: 'connected', lastSyncedAt: null },
  ],
};

function capabilities(overrides: Partial<ProviderSelectionResponse['connectedProviders'][number]['capabilities']>) {
  return {
    expenditure: false, expenditureCapability: 'unavailable' as const, intake: false,
    steps: false, workouts: false, workoutEnergy: false, workoutDuration: false,
    distance: false, heartRate: false, sleep: false, webhooks: false,
    historicalBackfill: false, oauth: false, ...overrides,
  };
}

const summary: BankSummaryResponse = {
  effectiveBankBalanceCalories: 0, availableBankCalories: 0, recoveryCalories: 0,
  openingBankStatus: 'initialized', openingBankCalories: 0, latestFinalizedDate: null,
  latestCompletedDate: null,
  latestDailyBankChange: null, latestOriginalDailyBankChange: null,
  latestContributionStatus: null, latestLocksAt: null, latestCorrectionCount: 0, finalizedDayCount: 0,
};

function facts(overrides: Partial<OnboardingFacts> = {}): OnboardingFacts {
  return {
    welcomeCompleted: true,
    completed: false,
    providerSelection: selection,
    goalConfigured: true,
    bankSummary: summary,
    preparation: { expenditure: 'complete', intake: 'complete', history: 'complete' },
    ...overrides,
  };
}

describe('connection-first onboarding', () => {
  it('progresses through welcome, provider, goal, preparation, and ready states', () => {
    expect(deriveOnboardingStatus(facts({ welcomeCompleted: false })).stage).toBe('welcome');
    const disconnectedExpenditure = structuredClone(selection);
    disconnectedExpenditure.connectedProviders[1]!.status = 'not_connected';
    expect(deriveOnboardingStatus(facts({ providerSelection: disconnectedExpenditure })).stage).toBe('calories_burned');
    const disconnectedIntake = structuredClone(selection);
    disconnectedIntake.connectedProviders[2]!.status = 'not_connected';
    expect(deriveOnboardingStatus(facts({ providerSelection: disconnectedIntake })).stage).toBe('calories_eaten');
    expect(deriveOnboardingStatus(facts({ goalConfigured: false })).stage).toBe('goal');
    expect(deriveOnboardingStatus(facts({
      bankSummary: { ...summary, openingBankStatus: 'waiting_for_opening_data' },
      preparation: { expenditure: 'preparing', intake: 'complete', history: 'preparing' },
    })).stage).toBe('preparing_bank');
    expect(deriveOnboardingStatus(facts()).stage).toBe('ready');
  });

  it('distinguishes connected sources from usable sources and permits completed no-history setup', () => {
    const waiting = structuredClone(selection);
    waiting.expenditure.status = 'unavailable';
    expect(deriveOnboardingStatus(facts({ providerSelection: waiting })).stage).toBe('calories_burned');
    expect(deriveOnboardingStatus(facts({
      bankSummary: { ...summary, openingBankStatus: 'waiting_for_opening_data' },
      preparation: { expenditure: 'complete', intake: 'complete', history: 'no_history' },
    })).stage).toBe('ready');
  });

  it('keeps a selected provider with broken credentials in needs-attention state', () => {
    const attention = structuredClone(selection);
    attention.expenditure.status = 'needs_attention';
    attention.connectedProviders[1]!.status = 'needs_attention';
    const result = deriveOnboardingStatus(facts({ providerSelection: attention }));
    expect(result.stage).toBe('calories_burned');
    expect(result.expenditure).toMatchObject({ connected: true, readiness: 'needs_attention' });
  });

  it('preserves zero and positive Opening Bank results', () => {
    expect(deriveOnboardingStatus(facts()).openingBankCalories).toBe(0);
    expect(deriveOnboardingStatus(facts({ bankSummary: { ...summary, openingBankCalories: 1250, availableBankCalories: 1250, effectiveBankBalanceCalories: 1250 } })).openingBankCalories).toBe(1250);
  });

  it('does not force an already completed user back through setup', () => {
    const disconnected = structuredClone(selection);
    disconnected.connectedProviders.forEach((provider) => { provider.status = 'not_connected'; });
    expect(deriveOnboardingStatus(facts({ completed: true, providerSelection: disconnected })).stage).toBe('complete');
  });
});

describe('consumer Today states', () => {
  it('keeps provider attribution in stale, partial, and error states', () => {
    expect(emptyTodayValue('stale', 'intake')).toBe('Out of date');
    expect(emptyTodayValue('partial', 'steps')).toBe('Some steps unavailable');
    expect(emptyTodayDetail('error', 'Fitbit', 'calories burned')).toBe('Fitbit needs attention');
    expect(emptyTodayDetail('unavailable', 'FatSecret', 'calories eaten')).toContain('FatSecret');
  });
});
