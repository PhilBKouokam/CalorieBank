import {
  BankCalculationError,
  buildActivityOpportunityBody,
  calculateAdjustedCurrentDayExpenditure,
  calculateFinalizedDailyBankChange,
  calculateRemainingTreatGapFromAvailableBank,
  estimateActivityCalorieRange,
  evaluateActivityOpportunityEligibility,
  roundCalories,
} from '@caloriebank/domain';
import { describe, expect, it } from 'vitest';

describe('finalized daily bank calculation', () => {
  it('calculates a cut day', () => {
    expect(
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 3625,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'cut',
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2085,
      }),
    ).toEqual({
      adjustedExpenditure: 2900,
      dailyAllowance: 2400,
      dailyBankChange: 315,
    });
  });

  it('calculates a maintain day', () => {
    expect(
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 2500,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'maintain',
        goalAdjustmentCalories: 999,
        importedCalorieIntake: 1950,
      }),
    ).toEqual({
      adjustedExpenditure: 2000,
      dailyAllowance: 2000,
      dailyBankChange: 50,
    });
  });

  it('calculates a bulk day', () => {
    expect(
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 3000,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'bulk',
        goalAdjustmentCalories: 300,
        importedCalorieIntake: 2500,
      }),
    ).toEqual({
      adjustedExpenditure: 2400,
      dailyAllowance: 2700,
      dailyBankChange: 200,
    });
  });

  it('allows negative bank results', () => {
    expect(
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 2800,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'cut',
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2500,
      }).dailyBankChange,
    ).toBe(-760);
  });

  it('rounds adjusted expenditure deterministically to the nearest calorie', () => {
    expect(roundCalories(100.4)).toBe(100);
    expect(roundCalories(100.5)).toBe(101);
  });

  it('calculates adjusted current-day expenditure for live awareness display', () => {
    expect(
      calculateAdjustedCurrentDayExpenditure({
        rawImportedExpenditureCalories: 2000,
        expenditureAdjustmentRate: 0.8,
      }),
    ).toBe(1600);

    expect(
      calculateAdjustedCurrentDayExpenditure({
        rawImportedExpenditureCalories: 2001,
        expenditureAdjustmentRate: 0.8,
      }),
    ).toBe(1601);
  });

  it('rejects invalid inputs', () => {
    expect(() =>
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: -1,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'cut',
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2000,
      }),
    ).toThrow(BankCalculationError);

    expect(() =>
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 3000,
        expenditureAdjustmentRate: 1.2,
        goalMode: 'cut',
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2000,
      }),
    ).toThrow(BankCalculationError);

    expect(() =>
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 3000,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'unsupported' as never,
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2000,
      }),
    ).toThrow(BankCalculationError);
  });
});

describe('activity opportunity domain utilities', () => {
  it('estimates an activity calorie range deterministically with model provenance', () => {
    expect(
      estimateActivityCalorieRange({
        activityCode: 'dance',
        durationMinutes: 30,
        bodyWeightKg: 80,
        lowCaloriesPerKgHour: 5.5,
        highCaloriesPerKgHour: 8,
        estimationMethod: 'population_model',
        modelVersion: 'activity-energy-population-v0',
      }),
    ).toEqual({
      activityCode: 'dance',
      durationMinutes: 30,
      estimatedLowCalories: 220,
      estimatedHighCalories: 320,
      estimationMethod: 'population_model',
      modelVersion: 'activity-energy-population-v0',
      confidenceLevel: 'low',
      explanatoryLabel: 'estimated range',
    });
  });

  it('rejects invalid activity estimate inputs', () => {
    expect(() =>
      estimateActivityCalorieRange({
        activityCode: 'dance',
        durationMinutes: 0,
        bodyWeightKg: 80,
        lowCaloriesPerKgHour: 5.5,
        highCaloriesPerKgHour: 8,
        estimationMethod: 'population_model',
        modelVersion: 'activity-energy-population-v0',
      }),
    ).toThrow(BankCalculationError);

    expect(() =>
      estimateActivityCalorieRange({
        activityCode: 'dance',
        durationMinutes: 30,
        bodyWeightKg: -80,
        lowCaloriesPerKgHour: 5.5,
        highCaloriesPerKgHour: 8,
        estimationMethod: 'population_model',
        modelVersion: 'activity-energy-population-v0',
      }),
    ).toThrow(BankCalculationError);

    expect(() =>
      estimateActivityCalorieRange({
        activityCode: 'dance',
        durationMinutes: 30,
        bodyWeightKg: 80,
        lowCaloriesPerKgHour: 9,
        highCaloriesPerKgHour: 8,
        estimationMethod: 'population_model',
        modelVersion: 'activity-energy-population-v0',
      }),
    ).toThrow(BankCalculationError);
  });

  it('calculates remaining Planned Treat gap from Available Bank only', () => {
    expect(calculateRemainingTreatGapFromAvailableBank(305, 1500)).toBe(1195);
    expect(calculateRemainingTreatGapFromAvailableBank(-200, 1500)).toBe(1500);
    expect(calculateRemainingTreatGapFromAvailableBank(1650, 1500)).toBe(0);
  });

  it('allows an opportunity only when timing, consent, and explicit preference are valid', () => {
    const currentAt = new Date('2026-07-21T18:00:00.000Z');
    const plannedTreatAt = new Date('2026-07-24T23:00:00.000Z');

    expect(
      evaluateActivityOpportunityEligibility({
        notificationsEnabled: true,
        activityNudgesEnabled: true,
        quietHoursActive: false,
        frequencyCapReached: false,
        duplicateRecentlySent: false,
        hasMatchingExplicitActivityPreference: true,
        plannedTreatReady: false,
        remainingTreatCalories: 300,
        currentAt,
        plannedTreatAt,
      }),
    ).toEqual({
      deliveryEligibility: 'eligible',
      blockedReason: null,
      opportunityReasonCodes: [
        'active_planned_treat',
        'remaining_gap',
        'matching_explicit_activity_preference',
        'allowed_notification_window',
      ],
      expiresAt: plannedTreatAt,
    });
  });

  it('blocks opportunities for quiet hours, disabled nudges, duplicates, missing preference, passed events, or ready treats', () => {
    const base = {
      notificationsEnabled: true,
      activityNudgesEnabled: true,
      quietHoursActive: false,
      frequencyCapReached: false,
      duplicateRecentlySent: false,
      hasMatchingExplicitActivityPreference: true,
      plannedTreatReady: false,
      remainingTreatCalories: 300,
      currentAt: new Date('2026-07-21T18:00:00.000Z'),
      plannedTreatAt: new Date('2026-07-24T23:00:00.000Z'),
    };

    expect(evaluateActivityOpportunityEligibility({ ...base, quietHoursActive: true }).blockedReason).toBe(
      'quiet_hours',
    );
    expect(evaluateActivityOpportunityEligibility({ ...base, activityNudgesEnabled: false }).blockedReason).toBe(
      'activity_nudges_disabled',
    );
    expect(evaluateActivityOpportunityEligibility({ ...base, frequencyCapReached: true }).blockedReason).toBe(
      'frequency_cap_reached',
    );
    expect(evaluateActivityOpportunityEligibility({ ...base, duplicateRecentlySent: true }).blockedReason).toBe(
      'duplicate_recently_sent',
    );
    expect(
      evaluateActivityOpportunityEligibility({
        ...base,
        hasMatchingExplicitActivityPreference: false,
      }).blockedReason,
    ).toBe('no_matching_explicit_activity_preference');
    expect(evaluateActivityOpportunityEligibility({ ...base, plannedTreatReady: true }).blockedReason).toBe(
      'planned_treat_ready',
    );
    expect(
      evaluateActivityOpportunityEligibility({
        ...base,
        plannedTreatAt: new Date('2026-07-20T23:00:00.000Z'),
      }).blockedReason,
    ).toBe('planned_treat_passed');
  });

  it('builds qualified recommendation copy without guilt-based language', () => {
    const body = buildActivityOpportunityBody({
      remainingTreatCalories: 300,
      plannedTreatName: "Friday's dinner goal",
      activityDisplayName: 'dance',
      durationMinutes: 30,
      estimatedLowCalories: 220,
      estimatedHighCalories: 320,
    });

    expect(body).toContain('may burn around 220-320 kcal');
    expect(body).toContain('Based on your profile');
    expect(body).not.toMatch(/will burn|guaranteed|exactly|earn|burn off|undo|failed|work this off/i);
  });
});
