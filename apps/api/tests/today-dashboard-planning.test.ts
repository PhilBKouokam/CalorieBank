import {
  activityOpportunityCandidateSchema,
  todaySoFarAwarenessSchema,
  todayDashboardVisibilityPreferencesSchema,
  TODAY_CARD_ORDER,
} from '@caloriebank/schemas';
import { describe, expect, it } from 'vitest';

describe('Today dashboard planning schemas', () => {
  it('keeps Available Bank first in the approved fixed card order', () => {
    expect(TODAY_CARD_ORDER).toEqual([
      'availableBank',
      'latestFinalizedContribution',
      'todaySoFar',
      'plannedTreat',
      'steps',
      'workouts',
      'currentGoal',
    ]);
  });
  it('does not allow Available Bank to be hidden', () => {
    expect(todayDashboardVisibilityPreferencesSchema.parse({}).availableBank).toBe(true);

    const parsed = todayDashboardVisibilityPreferencesSchema.safeParse({
      availableBank: false,
      plannedTreat: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('keeps current-day Today so far awareness separate from the official bank', () => {
    const awareness = todaySoFarAwarenessSchema.parse({
      localDate: '2026-07-21',
      timezone: 'America/Chicago',
      adjustedExpenditureCalories: 1600,
      rawImportedExpenditureCalories: 2000,
      expenditureAdjustmentRate: 0.8,
      expenditureSource: 'Fitbit',
      expenditureLastSyncedAt: '2026-07-21T14:12:00.000Z',
      importedCalorieIntake: 1500,
      intakeSource: 'MyFitnessPal',
      intakeLastSyncedAt: '2026-07-21T14:10:00.000Z',
      dataFreshnessStatus: 'partial',
      isCurrentDay: true,
      isPartial: true,
    });

    expect(awareness).not.toHaveProperty('availableBankCalories');
    expect(awareness).not.toHaveProperty('projectedBankChange');
    expect(awareness.adjustedExpenditureCalories).toBe(1600);
    expect(awareness.rawImportedExpenditureCalories).toBe(2000);
    expect(awareness.importedCalorieIntake).toBe(1500);
    expect(awareness.isPartial).toBe(true);
  });

  it('supports missing expenditure or intake source states without fabricating values', () => {
    const awareness = todaySoFarAwarenessSchema.parse({
      localDate: '2026-07-21',
      timezone: 'America/Chicago',
      adjustedExpenditureCalories: null,
      rawImportedExpenditureCalories: null,
      expenditureAdjustmentRate: 0.8,
      expenditureSource: null,
      expenditureLastSyncedAt: null,
      importedCalorieIntake: null,
      intakeSource: null,
      intakeLastSyncedAt: null,
      dataFreshnessStatus: 'not_connected',
      isCurrentDay: true,
      isPartial: true,
    });

    expect(awareness.adjustedExpenditureCalories).toBeNull();
    expect(awareness.importedCalorieIntake).toBeNull();
  });

  it('defines structured future activity opportunities without ledger or forecast fields', () => {
    const candidate = activityOpportunityCandidateSchema.parse({
      opportunityId: '00000000-0000-4000-8000-000000000101',
      userId: '00000000-0000-4000-8000-000000000001',
      plannedTreatId: '00000000-0000-4000-8000-000000000201',
      activityCode: 'dance',
      activityDisplayName: 'Dance',
      durationMinutes: 30,
      estimatedLowCalories: 220,
      estimatedHighCalories: 320,
      estimationMethod: 'population_model',
      estimationModelVersion: 'activity-energy-population-v0',
      remainingTreatCalories: 300,
      plannedTreatDate: '2026-07-24',
      hoursUntilPlannedTreat: 53,
      opportunityReasonCodes: ['matching_explicit_activity_preference', 'remaining_gap'],
      opportunityScore: 0.72,
      generatedAt: '2026-07-21T18:00:00.000Z',
      expiresAt: '2026-07-24T23:00:00.000Z',
      notificationCategory: 'personalized_activity_opportunity',
      suggestedTitle: 'A way to get closer',
      suggestedBody:
        "You're about 300 kcal from Friday's dinner goal. Based on your profile, a 30-minute dance session may burn around 220-320 kcal.",
      deliveryEligibility: 'eligible',
      blockedReason: null,
      deduplicationKey: 'activity-opportunity:00000000-0000-4000-8000-000000000001:dance:2026-07-24',
    });

    expect(candidate).not.toHaveProperty('amountCalories');
    expect(candidate).not.toHaveProperty('ledgerTransactionId');
    expect(candidate).not.toHaveProperty('projectedBankChange');
  });

  it('rejects activity opportunities where the low estimate exceeds the high estimate', () => {
    const parsed = activityOpportunityCandidateSchema.safeParse({
      opportunityId: '00000000-0000-4000-8000-000000000101',
      userId: '00000000-0000-4000-8000-000000000001',
      plannedTreatId: '00000000-0000-4000-8000-000000000201',
      activityCode: 'dance',
      activityDisplayName: 'Dance',
      durationMinutes: 30,
      estimatedLowCalories: 320,
      estimatedHighCalories: 220,
      estimationMethod: 'population_model',
      estimationModelVersion: 'activity-energy-population-v0',
      remainingTreatCalories: 300,
      plannedTreatDate: '2026-07-24',
      hoursUntilPlannedTreat: 53,
      opportunityReasonCodes: ['matching_explicit_activity_preference'],
      opportunityScore: 0.72,
      generatedAt: '2026-07-21T18:00:00.000Z',
      expiresAt: '2026-07-24T23:00:00.000Z',
      notificationCategory: 'personalized_activity_opportunity',
      suggestedTitle: 'A way to get closer',
      suggestedBody: 'A 30-minute dance session may burn around 220-320 kcal.',
      deliveryEligibility: 'eligible',
      blockedReason: null,
      deduplicationKey: 'activity-opportunity:00000000-0000-4000-8000-000000000001:dance:2026-07-24',
    });

    expect(parsed.success).toBe(false);
  });
});
