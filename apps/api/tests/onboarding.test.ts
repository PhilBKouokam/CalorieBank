import type { BankSummaryResponse, ProviderSelectionResponse } from '@caloriebank/schemas';
import { describe, expect, it } from 'vitest';

import { deriveOnboardingStatus, type OnboardingFacts } from '../src/modules/onboarding/onboarding.repository';
import {
  emptyTodayDetail,
  emptyTodayValue,
  firstRunTodayEmptyState,
  hasLatestCompletedContribution,
  hasUsableBankSummary,
  presentTodayContribution,
} from '../../mobile/lib/today/presentation';
import { deriveFirstRunBootstrapState } from '../../mobile/lib/onboarding/onboarding-recovery';

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

  it('lets a saved source continue setup while data is still arriving', () => {
    const waiting = structuredClone(selection);
    waiting.expenditure.status = 'unavailable';
    const result = deriveOnboardingStatus(facts({ providerSelection: waiting, goalConfigured: false }));
    expect(result.stage).toBe('goal');
    expect(result.expenditure).toMatchObject({
      connected: true,
      readiness: 'connected_waiting_for_data',
    });

    const intakeWaiting = structuredClone(selection);
    intakeWaiting.intake.status = 'unavailable';
    expect(deriveOnboardingStatus(facts({
      providerSelection: intakeWaiting,
      goalConfigured: false,
    })).stage).toBe('goal');
  });

  it('permits completed no-history setup', () => {
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

  it('does not accept a disconnected selected source as a completed decision', () => {
    const disconnected = structuredClone(selection);
    disconnected.connectedProviders[2]!.status = 'not_connected';
    disconnected.intake.status = 'unavailable';
    expect(deriveOnboardingStatus(facts({ providerSelection: disconnected })).stage).toBe('calories_eaten');
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
  it('keeps known accounting visible while background preparation remains unresolved', () => {
    const knownSummary = {
      ...summary,
      openingBankStatus: 'initialized' as const,
      availableBankCalories: 2296,
      latestCompletedDate: '2026-09-04',
      latestDailyBankChange: -83,
    };

    expect(hasUsableBankSummary(knownSummary)).toBe(true);
    expect(hasLatestCompletedContribution(knownSummary)).toBe(true);
    expect(presentTodayContribution(knownSummary.latestDailyBankChange)).toEqual({
      context: 'Enjoyed',
      value: '83 kcal',
    });
  });

  it('preserves setup only when no usable bank read model exists', () => {
    expect(hasUsableBankSummary({
      ...summary,
      openingBankStatus: 'waiting_for_opening_data',
      latestCompletedDate: null,
      latestDailyBankChange: null,
    })).toBe(false);
  });

  it('treats a completed contribution as usable accounting even if preparation is stale', () => {
    expect(hasUsableBankSummary({
      ...summary,
      openingBankStatus: 'waiting_for_opening_data',
      latestCompletedDate: '2026-09-04',
      latestDailyBankChange: -83,
    })).toBe(true);
  });

  it('presents signed completed contributions appropriately on Today', () => {
    expect(presentTodayContribution(500)).toEqual({ context: null, value: '+500 kcal' });
    expect(presentTodayContribution(-500)).toEqual({ context: 'Enjoyed', value: '500 kcal' });
    expect(presentTodayContribution(0)).toEqual({ context: null, value: '0 kcal' });
  });

  it('keeps provider attribution in stale, partial, and error states', () => {
    expect(emptyTodayValue('stale', 'intake')).toBe('Out of date');
    expect(emptyTodayValue('partial', 'steps')).toBe('Some steps unavailable');
    expect(emptyTodayDetail('error', 'Fitbit', 'calories burned')).toBe('Fitbit needs attention');
    expect(emptyTodayDetail('unavailable', 'FatSecret', 'calories eaten')).toContain('FatSecret');
  });

  it('shows checking rather than no-data while first-run intake is still hydrating', () => {
    expect(firstRunTodayEmptyState({
      checking: true,
      source: 'Cronometer',
      noun: 'intake',
    })).toEqual({
      value: 'Loading today’s calories…',
      detail: 'Checking Cronometer',
    });
    expect(firstRunTodayEmptyState({ checking: false, source: 'Cronometer', noun: 'intake' }))
      .toBeNull();
  });

  it('separates current-data readiness from history and Opening Bank readiness', () => {
    const state = deriveFirstRunBootstrapState({
      onboarding: {
        ...deriveOnboardingStatus(facts({ completed: true })),
        preparation: { expenditure: 'complete', intake: 'complete', history: 'preparing' },
      },
      bank: { ...summary, openingBankStatus: 'waiting_for_opening_data' },
      today: {
        burned: { adjusted: 2400 },
        eaten: { calories: 1800 },
      } as never,
    });
    expect(state).toEqual({
      currentBurnReady: true,
      currentIntakeReady: true,
      historyReady: false,
      bankReady: false,
      complete: false,
    });
  });
});
