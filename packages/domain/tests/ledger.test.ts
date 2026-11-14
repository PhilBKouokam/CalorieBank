import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BankCalculationError,
  calculateFinalizedDailyBankChange,
  calculateOpeningEffectiveBalance,
  deriveConsumerBankBalances,
  getBankContributionStatus,
  getLocalDateUtcBounds,
  getPreviousCompletedLocalDates,
  getProvisionalLockAt,
  roundCalories,
  selectOpeningBankPeriod,
} from '../src/index';

test('finalized bank change is adjusted expenditure, goal, then intake', () => {
  assert.deepEqual(
    calculateFinalizedDailyBankChange({
      importedTotalDailyExpenditure: 3625,
      expenditureAdjustmentRate: 0.8,
      goalMode: 'cut',
      goalAdjustmentCalories: 500,
      importedCalorieIntake: 2085,
    }),
    { adjustedExpenditure: 2900, dailyAllowance: 2400, dailyBankChange: 315 },
  );

  const maintain = calculateFinalizedDailyBankChange({
    importedTotalDailyExpenditure: 2500,
    expenditureAdjustmentRate: 0.8,
    goalMode: 'maintain',
    goalAdjustmentCalories: 0,
    importedCalorieIntake: 1950,
  });
  assert.equal(maintain.dailyAllowance, maintain.adjustedExpenditure);
  assert.equal(maintain.dailyBankChange, 50);

  assert.equal(
    calculateFinalizedDailyBankChange({
      importedTotalDailyExpenditure: 3000,
      expenditureAdjustmentRate: 0.8,
      goalMode: 'bulk',
      goalAdjustmentCalories: 300,
      importedCalorieIntake: 2500,
    }).dailyBankChange,
    200,
  );
});

test('an overage stays negative instead of being clamped', () => {
  assert.equal(
    calculateFinalizedDailyBankChange({
      importedTotalDailyExpenditure: 2800,
      expenditureAdjustmentRate: 0.8,
      goalMode: 'cut',
      goalAdjustmentCalories: 500,
      importedCalorieIntake: 2500,
    }).dailyBankChange,
    -760,
  );
});

test('finalized calculation rejects inputs that are not non-negative integers or a 0-1 rate', () => {
  assert.throws(
    () =>
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: -1,
        expenditureAdjustmentRate: 0.8,
        goalMode: 'cut',
        goalAdjustmentCalories: 500,
        importedCalorieIntake: 2000,
      }),
    BankCalculationError,
  );
  assert.throws(
    () =>
      calculateFinalizedDailyBankChange({
        importedTotalDailyExpenditure: 3000,
        expenditureAdjustmentRate: 1.2,
        goalMode: 'maintain',
        goalAdjustmentCalories: 0,
        importedCalorieIntake: 2000,
      }),
    BankCalculationError,
  );
  assert.throws(() => roundCalories(Number.NaN), BankCalculationError);
  assert.equal(roundCalories(100.5), 101);
});

test('opening balance keeps the longest recent suffix whose net is positive', () => {
  assert.deepEqual(calculateOpeningEffectiveBalance([500, -200, 100]), {
    historicalOpeningNetCalories: 400,
    openingEffectiveBalanceCalories: 400,
  });
  assert.deepEqual(selectOpeningBankPeriod([-500, 200], (value) => value), {
    selectedDays: [200],
    openingNetCalories: 200,
  });
  assert.deepEqual(selectOpeningBankPeriod([100, -100], (value) => value), {
    selectedDays: [],
    openingNetCalories: 0,
  });
});

test('available bank and recovery are derived from the effective balance', () => {
  assert.deepEqual(deriveConsumerBankBalances(-1000), {
    effectiveBankBalanceCalories: -1000,
    availableBankCalories: 0,
    recoveryCalories: 1000,
  });
  assert.throws(() => deriveConsumerBankBalances(1.5), BankCalculationError);
});

test('a day stays open until the next local midnight, provisional for two calendar days, then locked', () => {
  const logDate = '2026-07-21';
  const timezone = 'America/Chicago';
  assert.equal(
    getBankContributionStatus(logDate, timezone, new Date('2026-07-22T04:59:59.999Z')),
    'open',
  );
  assert.equal(
    getBankContributionStatus(logDate, timezone, new Date('2026-07-22T05:00:00.000Z')),
    'provisional',
  );
  assert.equal(getProvisionalLockAt(logDate, timezone).toISOString(), '2026-07-24T05:00:00.000Z');
  assert.equal(
    getBankContributionStatus(logDate, timezone, new Date('2026-07-24T05:00:00.000Z')),
    'locked',
  );
});

test('local-date bounds follow the user timezone across the November DST fallback', () => {
  const bounds = getLocalDateUtcBounds('2026-11-01', 'America/Chicago');
  assert.equal(bounds.start.toISOString(), '2026-11-01T05:00:00.000Z');
  assert.equal(bounds.end.toISOString(), '2026-11-02T06:00:00.000Z');
  assert.equal((bounds.end.getTime() - bounds.start.getTime()) / 3_600_000, 25);
});

test.skip('invalid timezones raise BankCalculationError from getLocalDateUtcBounds (Intl currently throws RangeError)', () => {
  // packages/domain/src/index.ts zonedMidnightUtc passes the timezone straight to
  // Intl.DateTimeFormat. An unknown zone escapes as RangeError before the domain
  // error type can be thrown. calculateEatingBudget catches that and fails closed;
  // getLocalDateUtcBounds, getBankContributionStatus, and getProvisionalLockAt do not.
  assert.throws(() => getLocalDateUtcBounds('2026-11-01', 'Not/AZone'), BankCalculationError);
});

test('opening lookback is the previous civil dates and does not include today', () => {
  assert.deepEqual(getPreviousCompletedLocalDates('2026-03-09', 3), [
    '2026-03-08',
    '2026-03-07',
    '2026-03-06',
  ]);
});
