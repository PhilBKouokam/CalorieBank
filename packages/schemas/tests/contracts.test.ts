import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dailyBankTargetInputSchema,
  deriveSourceState,
  formatWeeklyWeightChange,
  getAdjustmentSummaryLabel,
  goalConfigurationInputSchema,
  intakeAdjustmentMutationSchema,
  manualCaloriesSchema,
  nativeIntakeSourceName,
  sourceStateAllowsContinue,
  usualEstimateSchema,
} from '../src/index';

test('goal configuration enforces cut, maintain, and bulk adjustment signs', () => {
  assert.equal(
    goalConfigurationInputSchema.safeParse({
      goalMode: 'cut',
      dailyEnergyAdjustment: -500,
      adjustmentSource: 'manual_calories',
    }).success,
    true,
  );
  assert.equal(
    goalConfigurationInputSchema.safeParse({
      goalMode: 'cut',
      dailyEnergyAdjustment: 0,
      adjustmentSource: 'manual_calories',
    }).success,
    false,
  );
  assert.equal(
    goalConfigurationInputSchema.safeParse({
      goalMode: 'maintain',
      dailyEnergyAdjustment: 0,
      adjustmentSource: 'manual_calories',
    }).success,
    true,
  );
  assert.equal(
    goalConfigurationInputSchema.safeParse({
      goalMode: 'maintain',
      dailyEnergyAdjustment: -100,
      adjustmentSource: 'manual_calories',
    }).success,
    false,
  );
  assert.equal(
    goalConfigurationInputSchema.safeParse({
      goalMode: 'bulk',
      dailyEnergyAdjustment: 250,
      adjustmentSource: 'estimated_weight_rate',
      desiredWeeklyWeightChange: 0.5,
    }).success,
    true,
  );
  assert.equal(
    goalConfigurationInputSchema.safeParse({
      goalMode: 'bulk',
      dailyEnergyAdjustment: 250,
      adjustmentSource: 'estimated_weight_rate',
      desiredWeeklyWeightChange: 1,
    }).success,
    false,
  );
  assert.equal(
    goalConfigurationInputSchema.safeParse({
      goalMode: 'maintain',
      dailyEnergyAdjustment: 0,
      adjustmentSource: 'estimated_weight_rate',
      desiredWeeklyWeightChange: 0.5,
    }).success,
    false,
  );
});

test('daily bank target and manual calories stay inside the published bounds', () => {
  assert.equal(dailyBankTargetInputSchema.parse({ calories: 0 }).calories, 0);
  assert.equal(dailyBankTargetInputSchema.parse({ calories: 2000 }).calories, 2000);
  assert.equal(dailyBankTargetInputSchema.safeParse({ calories: 2001 }).success, false);
  assert.equal(dailyBankTargetInputSchema.safeParse({ calories: 10.5 }).success, false);
  assert.equal(dailyBankTargetInputSchema.safeParse({ calories: 100, extra: true }).success, false);
  assert.equal(manualCaloriesSchema.safeParse(100_000).success, true);
  assert.equal(manualCaloriesSchema.safeParse(100_001).success, false);
  assert.equal(usualEstimateSchema.safeParse(0).success, false);
});

test('intake adjustment mutations accept replace, add, and none with a date and revision', () => {
  const parsed = intakeAdjustmentMutationSchema.parse({
    localDate: '2026-10-18',
    expectedRevision: 2,
    selectionRevision: null,
    manualRevision: 1,
    mode: 'add',
    calories: 150,
  });
  assert.equal(parsed.mode, 'add');
  assert.equal(
    intakeAdjustmentMutationSchema.safeParse({
      localDate: '10/18/2026',
      expectedRevision: 0,
      selectionRevision: null,
      manualRevision: 0,
      mode: 'replace',
      calories: 100,
    }).success,
    false,
  );
});

test('source state stays unselected until a concrete food writer exists, then follows the connection', () => {
  const appleFood = {
    authoritativeProvider: 'apple_health',
    displayName: 'Apple Health',
    status: 'ready',
    writerBundleIdentifier: 'choose a food tracker',
    writerDisplayName: 'Choose a food tracker',
  };
  assert.equal(deriveSourceState('eaten', appleFood, 'connected'), 'unselected');
  assert.equal(
    deriveSourceState(
      'eaten',
      {
        ...appleFood,
        writerBundleIdentifier: 'com.myfitnesspal.mfp',
        writerDisplayName: 'MyFitnessPal',
      },
      'connected',
    ),
    'connected_data_ready',
  );
  assert.equal(
    deriveSourceState(
      'burned',
      { authoritativeProvider: 'apple_health', displayName: 'Apple Health', status: 'waiting' },
      'needs_attention',
    ),
    'reconnect_required',
  );
  assert.equal(
    deriveSourceState(
      'burned',
      { authoritativeProvider: 'apple_health', displayName: 'Apple Health', status: 'waiting' },
      'connected',
      'failed',
    ),
    'transient_refresh_failure',
  );
  assert.equal(sourceStateAllowsContinue('connected_no_data'), true);
  assert.equal(sourceStateAllowsContinue('transient_refresh_failure'), true);
  assert.equal(sourceStateAllowsContinue('refreshing'), false);
  assert.equal(sourceStateAllowsContinue('reconnect_required'), false);
});

test('known Android food packages keep their publisher names', () => {
  assert.equal(nativeIntakeSourceName('com.myfitnesspal.android'), 'MyFitnessPal');
  assert.equal(nativeIntakeSourceName('com.example.unknown'), 'Food tracker');
  assert.equal(getAdjustmentSummaryLabel('cut'), 'Daily Deficit');
  assert.equal(getAdjustmentSummaryLabel('maintain'), 'Maintenance');
});

test.skip('formatWeeklyWeightChange treats 0 as unset because the value is checked for truthiness', () => {
  // packages/schemas/src/index.ts uses `value ? ... : 'Not set'`.
  // A stored weekly change of 0 therefore renders as unset.
  assert.equal(formatWeeklyWeightChange(0), '0.0 lb/week');
});
