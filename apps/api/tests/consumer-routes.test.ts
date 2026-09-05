import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getConsumerSourceName } from '../../mobile/lib/providers/presentation';
import { historicalSourceChangeMessage } from '../../mobile/lib/history/source-change-errors';
import {
  formatContributionPercentage,
  formatStepContributions,
  formatWorkoutCalorieLines,
} from '../../mobile/lib/today/presentation';

function mobileFile(path: string) {
  return readFileSync(resolve(process.cwd(), '../mobile', path), 'utf8');
}

describe('consumer routes', () => {
  it('maps historical source failures to actionable consumer messages', () => {
    expect(historicalSourceChangeMessage('SOURCE_NO_DATA_FOR_DATE', 'FatSecret'))
      .toBe('FatSecret doesn’t have calorie data for this day.');
    expect(historicalSourceChangeMessage('APPLE_HEALTH_WRITER_UNAVAILABLE', 'Cronometer'))
      .toBe('Cronometer data is no longer available from Apple Health.');
    expect(historicalSourceChangeMessage('DAY_NO_LONGER_CHANGEABLE', 'FatSecret'))
      .toBe('This day can no longer be changed.');
    expect(historicalSourceChangeMessage('STALE_SELECTION', 'FatSecret'))
      .toBe('This source changed. Try again.');
    expect(historicalSourceChangeMessage('UNEXPECTED', 'FatSecret'))
      .toBe('Couldn’t change the source. Try again.');
  });

  it('uses the real Bank History implementation in the History tab', () => {
    const source = mobileFile('app/(tabs)/history.tsx');
    expect(source).toContain('bank-history');
    expect(source).not.toContain('Placeholder');
    expect(source).not.toContain('Ledger Placeholder');
  });

  it('does not expose known development placeholders from Settings', () => {
    const source = mobileFile('app/(tabs)/settings.tsx');
    expect(source).not.toMatch(/Onboarding Placeholder|Sign In Placeholder|Ledger Placeholder|foundation|demo/i);
    expect(source).toContain('Health Connections');
    expect(source).toContain('Goal');
  });

  it('does not hard-code Apple Health as the workout source', () => {
    const source = mobileFile('app/(details)/today-workouts.tsx');
    expect(source).not.toContain('recorded in Apple Health');
    expect(source).toContain('formatWorkoutCalorieLines');
    expect(source).toContain('Imported from {getConsumerSourceName(workout.source)}');
    expect(source).not.toContain('Workout calories are already included in your burned total.');
  });

  it('presents provider and actual step contributions with dynamic source naming', () => {
    expect(formatStepContributions({
      providerContributionCalories: 2_390,
      actualContributionCalories: 1_910,
      providerTotalBurnCalories: 4_241,
      actualTotalBurnCalories: 3_393,
      burnSource: 'google_health_fitbit',
    })).toEqual({
      providerContribution: 'Contributed ~2,390 kcal (56%)',
      providerContext: 'out of your 4,241 kcal Fitbit burn',
      actualContribution: 'Contributed ~1,910 kcal (56%)',
      actualContext: 'out of your 3,393 kcal estimated actual burn',
    });
    expect(formatStepContributions({
      providerContributionCalories: 660,
      actualContributionCalories: 530,
      providerTotalBurnCalories: 1_292,
      actualTotalBurnCalories: 1_034,
      burnSource: 'google_health_fitbit',
    })).toEqual({
      providerContribution: 'Contributed ~660 kcal (51%)',
      providerContext: 'out of your 1,292 kcal Fitbit burn',
      actualContribution: 'Contributed ~530 kcal (51%)',
      actualContext: 'out of your 1,034 kcal estimated actual burn',
    });
    expect(formatStepContributions({
      providerContributionCalories: 660,
      actualContributionCalories: 530,
      providerTotalBurnCalories: 1_292,
      actualTotalBurnCalories: 1_034,
      burnSource: 'apple_health',
    }).providerContext).toContain('Apple Health burn');
    expect(formatStepContributions({
      providerContributionCalories: 660,
      actualContributionCalories: 530,
      providerTotalBurnCalories: 1_292,
      actualTotalBurnCalories: 1_034,
      burnSource: null,
    }).providerContext).toContain('Connected source burn');
  });

  it('formats contribution percentages safely as whole numbers', () => {
    expect(formatContributionPercentage(1_980, 3_693)).toBe(54);
    expect(formatContributionPercentage(1_580, 2_954)).toBe(53);
    expect(formatContributionPercentage(10, 0)).toBeNull();
    expect(formatContributionPercentage(10, Number.NaN)).toBeNull();
    expect(formatContributionPercentage(110, 100)).toBeNull();
  });

  it('uses Cut, Maintain, and Bulk as the primary Goal Settings labels', () => {
    const source = mobileFile('components/caloriebank/GoalConfigurationForm.tsx');
    expect(source).toContain("value: 'cut', label: 'Cut'");
    expect(source).toContain("value: 'maintain', label: 'Maintain'");
    expect(source).toContain("value: 'bulk', label: 'Bulk'");
    expect(source).not.toContain("label: 'Lose weight'");
    expect(source).not.toContain("label: 'Gain weight'");
  });

  it('keeps Customize Today terminology and option order aligned with Today', () => {
    const source = mobileFile('app/(settings)/customize-today.tsx');
    expect(source).toContain("label: 'Latest completed contribution'");
    expect(source).not.toContain("label: 'Latest finalized contribution'");
    expect(source.indexOf("key: 'showLatestFinalizedContribution'"))
      .toBeLessThan(source.indexOf("key: 'showCurrentGoal'"));
    expect(source.indexOf("key: 'showCurrentGoal'"))
      .toBeLessThan(source.indexOf("key: 'showTodaySoFar'"));
  });

  it('uses one card-level walking-estimate fallback and qualifies actual burn', () => {
    const source = mobileFile('app/(details)/steps-detail.tsx');
    const today = mobileFile('app/(tabs)/today.tsx');
    expect(source.match(/Walking calorie estimate unavailable/g)).toHaveLength(1);
    expect(source).toContain('kcal estimated actual burn');
    expect(source).toContain('formatContributionPercentage(contribution, total)');
    expect(source).toContain('` (${percentage}%)`');
    expect(today).toContain('formatStepContributions({');
    expect(source).not.toContain('kcal actual burn`');
  });

  it('offers an in-place History retry and omits raw Planned Treat date entry', () => {
    const historySource = mobileFile('app/(details)/bank-history.tsx');
    const plannedTreatSource = mobileFile('app/(settings)/planned-treat.tsx');
    expect(historySource).toContain('Try again');
    expect(historySource).toContain('setRetryAttempt');
    expect(plannedTreatSource).not.toContain('YYYY-MM-DD');
    expect(plannedTreatSource).not.toContain('Optional target date');
  });

  it('keeps workout calories adjacent to their compact multiplier expression', () => {
    expect(formatWorkoutCalorieLines({
      totalSteps: 2_300,
      rawCalories: 148,
      adjustmentFactor: 0.8,
    })).toEqual({
      reported: '2,300 steps · 148 kcal',
      estimated: '148 × 0.8 = 118 kcal est. actual burn',
    });
    expect(formatWorkoutCalorieLines({
      totalSteps: null,
      rawCalories: 320,
      adjustmentFactor: 0.8,
    })).toEqual({
      reported: '320 kcal',
      estimated: '320 × 0.8 = 256 kcal est. actual burn',
    });
  });

  it('maps provider identifiers to recognizable consumer source names without inventing unknown brands', () => {
    expect(getConsumerSourceName('google_health_fitbit')).toBe('Fitbit');
    expect(getConsumerSourceName('apple_health')).toBe('Apple Health');
    expect(getConsumerSourceName('apple_watch')).toBe('Apple Watch');
    expect(getConsumerSourceName('fatsecret')).toBe('FatSecret');
    expect(getConsumerSourceName('unknown_transport')).toBe('Connected source');
  });

  it('offers recognizable activity and verified food-tracker routes during iOS onboarding', () => {
    const source = mobileFile('app/(onboarding)/onboarding.tsx');
    expect(source).toContain('What do you use to track your activity?');
    expect(source).toContain('title="Apple Watch"');
    expect(source).toContain('title="Fitbit"');
    expect(source).toContain('Where do you track your food?');
    for (const tracker of ['MyFitnessPal', 'Cronometer', 'Lose It!', 'MacroFactor', 'FatSecret']) {
      expect(source).toContain(`title="${tracker}"`);
    }
    expect(source).toContain('Another app using Apple Health');
  });

  it('opens beta HealthKit diagnostics once outside the Apple Health modal', () => {
    const integrations = mobileFile('app/(settings)/integrations.tsx');
    const diagnostics = mobileFile('app/(settings)/health-diagnostics.tsx');
    expect(integrations).toContain("requestAnimationFrame(() => router.push('/health-diagnostics'))");
    expect(integrations).toContain('if (diagnosticsOpening.current) return');
    expect(integrations).toContain("setService(null)");
    expect(integrations).not.toContain('<Link href="/health-diagnostics"');
    expect(integrations).toContain('reopenAppleHealthDetails.current = true');
    expect(diagnostics).toContain('betaDiagnosticsEnabled(process.env.EXPO_PUBLIC_APP_ENV, __DEV__)');
    expect(diagnostics).toContain('Share or copy diagnostic report');
  });

  it('presents Available Bank as an unsigned balance and keeps Today contribution concise', () => {
    const source = mobileFile('app/(tabs)/today.tsx');
    expect(source).toContain('formatBankBalance(bankSummary.availableBankCalories)');
    expect(source).toContain('style={[styles.secondaryValue, styles.contributionValue]}');
    expect(source).not.toMatch(/latestDailyBankChange < 0[\s\S]*negativeValue/);
    expect(source).not.toMatch(/Added to your bank|Withdrawn from your bank|Adjusted from|May still update/);
    expect(source.indexOf('hasInitializedBank && bankSummary'))
      .toBeLessThan(source.indexOf("bankStatus === 'loading'"));
    expect(source.indexOf('hasCompletedDays && bankSummary'))
      .toBeLessThan(source.indexOf("bankStatus === 'loading'", source.indexOf('const latestChangeValue')));
    expect(source).toContain('{latestContributionContext}');
  });

  it('keeps progressive detail behind accessible Today cards', () => {
    const today = mobileFile('app/(tabs)/today.tsx');
    const steps = mobileFile('app/(details)/steps-detail.tsx');
    const burn = mobileFile('app/(details)/today-burn.tsx');

    expect(today).toContain("router.push('/steps-detail')");
    expect(today).toContain("router.push('/planned-treat')");
    expect(today).toContain("router.push('/today-burn')");
    expect(today).toContain('accessibilityHint="Opens step contribution and what-if details."');
    expect(today).toContain('accessibilityHint="Opens today\'s burn details."');
    expect(steps).toContain('calculateStepToBurnPlan');
    expect(steps).toContain('calculateBurnToStepPlan');
    expect(steps).toContain('suggestNextStepTarget');
    expect(steps).toContain('`${stepSource} reported`');
    expect(steps).toContain('`Projected Total Daily ${burnSource} burn`');
    expect(steps).toContain('targetActualBurnCalories: burnTarget');
    expect(steps).toContain('{burnSource} calories');
    expect(steps).toContain('I’d need about');
    expect(steps).toContain('currentProviderBurn.toLocaleString()');
    expect(steps).toContain('currentAdjustedBurn.toLocaleString()');
    expect(steps).not.toContain('restOfDayProjection.projectedProviderBurnCalories.toLocaleString()');
    expect(steps).not.toContain('Fitbit');
    expect(today).not.toContain('<Link href="/steps-detail" asChild>');
    expect(today).not.toContain('<Link href="/planned-treat" asChild>');
    expect(steps).toContain('automaticallyAdjustKeyboardInsets');
    expect(steps).toContain('keyboardDismissMode="interactive"');
    expect(steps).toContain('onFocus={() => revealCard(inverseCardY.current)}');
    expect(steps).toContain('If I walk…');
    expect(steps).not.toContain('What if I walk…');
    expect(steps.indexOf('If I want to burn…')).toBeLessThan(steps.indexOf('If I walk…'));
    expect(today.indexOf("Yesterday's contribution")).toBeLessThan(today.indexOf('Current goal'));
    expect(burn).toContain('getConsumerSourceName(today?.burned.source)');
    expect(burn).toContain('getConsumerSourceName(today?.eaten.source)');
    expect(today).toContain('accessibilityLabel="Why does CalorieBank use 80 percent?"');
    expect(burn).not.toContain('Why 80%?');
    expect(today).toContain('visible={showWhyEighty}');
    expect(today).toContain('CalorieBank’s founder trusted his watch burn during his cut but wasn’t losing weight.');
    expect(today).toContain('After learning that watches can overestimate calories burned');
    expect(today).toContain('That’s why CalorieBank uses the 80% rule.');
    expect(today).not.toContain('ChatGPT');
    expect(today).not.toContain('You’ll always still see the full burn reported by your device.');
    expect(today).toContain('onRequestClose={() => setShowWhyEighty(false)}');
    expect(today).not.toContain('href="/why-80"');
    expect(today).not.toMatch(/exactly|20% inaccurate/i);
    expect(mobileFile('app/(details)/_layout.tsx')).not.toContain('why-80');
    expect(burn).toContain('mobile_today_detail_received');
    expect(burn).toContain('projectedProviderBurnCalories.toLocaleString()');
    expect(burn).toContain('projectedAdjustedBurnCalories.toLocaleString()');
    expect(burn).toContain('<Text style={styles.cardTitle}>At rest, you burn</Text>');
    expect(burn).toContain('label={`${burnSource} reported`}');
    expect(burn).toContain('providerKcalPerHour');
    expect(burn).toContain('label="Estimated actual"');
    expect(burn).toContain('adjustedKcalPerHour');
    expect(burn).toContain('providerKcalPerHour).toLocaleString()} × ${today.burned.adjustmentFactor} = ~');
    expect(burn).toContain('Projected Total Daily ${burnSource} burn');
    expect(burn).toContain('Estimated Total Daily Actual Burn');
    expect(burn.indexOf('If you rested for the rest of today'))
      .toBeLessThan(burn.indexOf('At rest, you burn'));
    expect(burn).not.toContain('label="At rest"');
    expect(burn).not.toContain('label="Time remaining"');
  });

  it('keeps Planned Treat fields visible with the established keyboard-aware scroll behavior', () => {
    const plannedTreat = mobileFile('app/(settings)/planned-treat.tsx');
    const placeholder = mobileFile('components/caloriebank/PlaceholderScreen.tsx');
    expect(plannedTreat).toContain('keyboardAware');
    expect(plannedTreat).toContain('scrollViewRef={scrollRef}');
    expect(plannedTreat).toContain('scrollResponderScrollNativeHandleToKeyboard');
    expect(plannedTreat).toContain('onFocus={() => revealInput(nameInputRef.current)}');
    expect(plannedTreat).toContain('onFocus={() => revealInput(caloriesInputRef.current)}');
    expect(placeholder).toContain('automaticallyAdjustKeyboardInsets={keyboardAware}');
    expect(placeholder).toContain("keyboardDismissMode={keyboardAware ? 'interactive' : 'none'}");
    expect(placeholder).toContain("keyboardShouldPersistTaps={keyboardAware ? 'handled' : 'never'}");
  });

  it('keeps History rows free of lifecycle noise and explains the consumer calculation', () => {
    const source = mobileFile('app/(details)/bank-history.tsx');
    expect(source).toContain('formatBankBalance(history.availableBankCalories)');
    expect(source).toContain('Estimated actual burn');
    expect(source).toContain('value={`× ${Number(selectedDay.expenditureAdjustmentRate.toFixed(2))}');
    expect(source).toContain('Calories burned · {sourceOptions?.expenditure.selected.label');
    expect(source).toContain('Calories eaten · {sourceOptions?.intake.selected.label');
    expect(source).toContain("openSourcePicker('expenditure')");
    expect(source).toContain("openSourcePicker('intake')");
    expect(source).toContain("if (value < 0) return 'Enjoyed'");
    expect(source).toContain('<Text style={styles.dayChange}>');
    expect(source).not.toMatch(/dailyBankChange < 0[\s\S]*negativeChange/);
    expect(source).toContain("flexBasis: '48%'");
    expect(source).toContain("textAlign: 'left'");
    expect(source).not.toContain("if (value < 0) return 'Withdrawn'");
    expect(source).not.toMatch(/Credited|% adjusted burn|goal deficit|goal surplus/);
    expect(source).not.toMatch(/Adjusted from|May still update|Original contribution|Effective contribution|Sources:/);
  });
});
