import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyBankTargetInputSchema } from '@caloriebank/schemas';
import type { TodayResponse } from '@caloriebank/schemas';
import { calculateBurnToStepPlan, calculateStepToBurnPlan, walkingTimeFromPace } from '@caloriebank/domain';
import { completedContributionSentence } from '../../mobile/lib/today/presentation';
import { foodTrackerGuidance } from '../../mobile/lib/healthkit/food-tracker-guidance';

const targetStore = vi.hoisted(() => ({ calories: 0, writes: [] as number[] }));
const homeStore = vi.hoisted(() => ({ recovery: 0 }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]), Link: 'Link' }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('../../mobile/lib/lifecycle/account-lifecycle', () => ({ isAccountLifecycleRunning: () => false, subscribeToAccountLifecycle: () => () => {}, runAccountLifecycle: async () => ({ detail: null }) }));
vi.mock('../../mobile/lib/api/client', () => ({
  getApiBaseUrl: () => 'https://fixture.invalid',
  fetchBankSummary: async () => ({ openingBankStatus: 'initialized', availableBankCalories: homeStore.recovery ? 0 : 2843, recoveryCalories: homeStore.recovery, latestCompletedDate: '2026-09-10', latestDailyBankChange: 547 }),
  fetchPlannedTreat: async () => ({ status: 'no_plan' }),
  fetchToday: async () => ({ burned: { status: 'unavailable' }, eaten: { status: 'unavailable' }, steps: { status: 'unavailable' }, workouts: { items: [], status: 'unavailable' }, dashboardVisibility: { showTodaySoFar: false, showSteps: false, showCurrentGoal: false, showWorkouts: false } }),
  fetchDashboardPreferences: async () => ({ showLatestFinalizedContribution: true, showTodaySoFar: false, showCurrentGoal: false, showSteps: false, showWorkouts: false }),
  fetchProviderSelection: async () => ({ expenditure: {}, intake: {} }),
  fetchOnboardingStatus: async () => ({ completed: true, stage: 'complete', preparation: { history: 'complete' }, expenditure: { provider: 'google_health_fitbit' }, intake: { provider: 'apple_health' } }),
  fetchDailyBankTarget: async () => ({ calories: targetStore.calories, chosen: targetStore.writes.length > 0 }),
  saveDailyBankTarget: async (calories: number) => { targetStore.calories = calories; targetStore.writes.push(calories); return { calories, chosen: true }; },
  fetchGoalConfiguration: async () => ({ goalMode: 'maintain', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: 0 }),
  saveGoalConfiguration: async (value: unknown) => value,
}));
beforeEach(() => { targetStore.calories = 0; targetStore.writes = []; });

vi.mock('react-native', () => ({
  Text: 'Text', View: 'View', Pressable: 'Pressable', TextInput: 'TextInput', ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl',
  useWindowDimensions: () => ({ width: 390, fontScale: 1 }),
  StyleSheet: { create: <T,>(value: T) => value },
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null,
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
let screen: ReactTestRenderer | undefined;
afterEach(async () => { if (screen) await act(async () => screen!.unmount()); screen = undefined; });
async function render(component: React.ReactElement) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(async () => { screen = create(component); });
  return screen!;
}
const source = (path: string) => readFileSync(resolve(__dirname, '../../mobile', path), 'utf8');

describe('Phase 1 consumer release invariants', () => {
  it.each([0, 35])('keeps Recovery adjacent to the bank only when active (%s)', async (recovery) => {
    homeStore.recovery = recovery;
    const { default: Home } = await import(resolve(__dirname, '../../mobile/app/(tabs)/today.tsx')) as { default: React.ComponentType };
    const rendered = await render(React.createElement(Home));
    const labels = rendered.root.findAll(node => String(node.type) === 'Text').map(node => node.children.join(''));
    const ordered = labels.filter(label => ['Available Bank', 'Recovery', 'Banking Goal'].includes(label));
    expect(ordered).toEqual(recovery ? ['Available Bank', 'Recovery', 'Banking Goal'] : ['Available Bank', 'Banking Goal']);
  });
  it.each([true, false])('renders compact planning inputs and unchanged answers; walking evidence=%s', async (hasPace) => {
    const { StepPlanningCards } = await import(resolve(__dirname, '../../mobile/components/caloriebank/StepPlanningCards.tsx')) as { StepPlanningCards: React.ComponentType<{ today: TodayResponse }> };
    const today = { burned: { status: 'ready', source: 'Fitbit', adjustmentFactor: .8 }, steps: { status: 'ready', count: 8500, caloriesPerStep: .06, walkingPace: hasPace ? { stepsPerMinute: 100, sampleCount: 3 } : null }, restOfDayProjection: { status: 'ready', projectedProviderBurnCalories: 3600 } } as unknown as TodayResponse;
    const rendered = await render(React.createElement(StepPlanningCards, { today }));
    const inputs = rendered.root.findAll(node => String(node.type) === 'TextInput');
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input.props.style[1].width).toBe(132);
      expect(input.parent!.props.style.flexDirection).toBe('row');
      expect(input.parent!.props.style.flexWrap).toBe('wrap');
      expect(input.props.keyboardType).toBe('number-pad');
      expect(input.props.selectTextOnFocus).toBe(true);
      expect(input.props.clearTextOnFocus).toBeUndefined();
      const original = input.props.value;
      await act(async () => { input.props.onFocus?.(); input.props.onBlur?.(); });
      expect(input.props.value).toBe(original);
      await act(async () => input.props.onChangeText('3'));
      expect(input.props.value).toBe('3');
      await act(async () => input.props.onChangeText('3500'));
      expect(input.props.value).toBe('3500');
      await act(async () => input.props.onChangeText('35x10'));
      expect(input.props.value).toBe('3510');
    }
    await act(async () => { inputs[0]!.props.onChangeText('4000'); inputs[1]!.props.onChangeText('30000'); });
    const shared = { currentSteps: 8500, providerCaloriesPerStep: .06, projectedProviderBurnAtRest: 3600, adjustmentFactor: .8 };
    const inverse = calculateBurnToStepPlan({ ...shared, targetActualBurnCalories: 4000 });
    const forward = calculateStepToBurnPlan({ ...shared, targetSteps: 30000 });
    const output = JSON.stringify(rendered.toJSON());
    expect(output).toContain(inverse.totalDailyStepsNeeded.toLocaleString());
    expect(output).toContain(forward.projectedAdjustedBurnCalories.toLocaleString());
    expect(output.includes('min ')).toBe(hasPace);
    const text = rendered.root.findAll(node => String(node.type) === 'Text').map(node => node.children.join('')).join('|');
    const burnCard = text.slice(0, text.indexOf('If I walk'));
    const walkCard = text.slice(text.indexOf('If I walk'));
    const ordered = (content: string, pieces: string[]) => {
      let previous = -1;
      for (const piece of pieces) { const index = content.indexOf(piece); expect(index, piece).toBeGreaterThan(previous); previous = index; }
    };
    ordered(burnCard, ['calories', `~${inverse.requiredProviderBurnCalories.toLocaleString()} Fitbit calories`, 'I’d need about', `${inverse.totalDailyStepsNeeded.toLocaleString()} total steps`, `${inverse.remainingSteps.toLocaleString()} steps remaining`]);
    ordered(walkCard, ['steps', 'Projected Total Daily Fitbit burn', `~${forward.projectedProviderBurnCalories.toLocaleString()} kcal`, 'Estimated Total Daily Actual Burn', `${forward.projectedProviderBurnCalories.toLocaleString()} × 0.8 = ${forward.projectedAdjustedBurnCalories.toLocaleString()} kcal`, `About ${forward.additionalSteps.toLocaleString()} more steps`]);
    if (hasPace) {
      expect(burnCard.indexOf(' hr')).toBeGreaterThan(burnCard.indexOf('steps remaining'));
      expect(walkCard.indexOf(' hr')).toBeGreaterThan(walkCard.indexOf('more steps'));
      expect(burnCard.indexOf('min walks')).toBeGreaterThan(burnCard.indexOf(' hr'));
      expect(walkCard.indexOf('min walks')).toBeGreaterThan(walkCard.indexOf(' hr'));
    }
    const primary = rendered.root.findAll(node => String(node.type) === 'Text' && node.props.style?.fontWeight === '800');
    expect(primary).toHaveLength(2);
  });
  it.each(['You banked 573 kcal yesterday.', 'You enjoyed 83 kcal yesterday.', 'You were right on target yesterday.'])('keeps contribution emphasis and speech coherent: %s', async (sentence) => {
    const { CompletedContribution } = await import(resolve(__dirname, '../../mobile/components/caloriebank/CompletedContribution.tsx')) as { CompletedContribution: React.ComponentType<{ sentence: string }> };
    const rendered = await render(React.createElement(CompletedContribution, { sentence }));
    expect(rendered.root.findByProps({ accessibilityLabel: sentence.replace('kcal', 'kilocalories') })).toBeDefined();
    const emphasis = rendered.root.findAll(node => String(node.type) === 'Text' && node.props.style?.fontWeight === '800');
    expect(emphasis).toHaveLength(sentence.includes('kcal') ? 1 : 0);
    if (emphasis.length) expect(emphasis[0]!.props.style.fontSize).toBeGreaterThan(18);
  });
  it('keeps Fitness Goal and Daily Bank Target on separate onboarding pages', async () => {
    const { GoalConfigurationForm } = await import(resolve(__dirname, '../../mobile/components/caloriebank/GoalConfigurationForm.tsx')) as { GoalConfigurationForm: React.ComponentType<{ mode: string; onSaved: () => void }> };
    const rendered = await render(React.createElement(GoalConfigurationForm, { mode: 'onboarding', onSaved: vi.fn() }));
    expect(JSON.stringify(rendered.toJSON())).not.toContain('Daily Bank Target');
    expect(JSON.stringify(rendered.toJSON())).not.toContain('How much would you like');
  });
  it('places burned, eaten, and steps within the same first detail card', () => {
    const detail = source('app/(details)/today-burn.tsx');
    const summary = detail.slice(detail.indexOf('<View style={styles.card}>'), detail.indexOf('<Text style={styles.sectionTitle}>'));
    expect(summary.match(/<View style=\{styles.card\}>/g)).toHaveLength(1);
    expect(summary.indexOf('>Burned</Text>')).toBeLessThan(summary.indexOf('>Eaten</Text>'));
    expect(summary.indexOf('>Eaten</Text>')).toBeLessThan(summary.indexOf('>Steps</Text>'));
    expect(summary).toContain('adjustmentFactor');
  });
  it.each([2000, 2900, 6700, 20000])('formats sessions without changing the estimate for %s steps', async (steps) => {
    const { WalkingTime } = await import(resolve(__dirname, '../../mobile/components/caloriebank/StepPlanningCards.tsx')) as { WalkingTime: React.ComponentType<{ steps: number; pace: TodayResponse['steps']['walkingPace'] }> };
    const estimate = walkingTimeFromPace(steps, 100, 3)!;
    const rendered = await render(React.createElement(WalkingTime, { steps, pace: { stepsPerMinute: 100, sampleCount: 3 } as TodayResponse['steps']['walkingPace'] }));
    const noun = estimate.sessionCount === 1 ? 'walk' : 'walks';
    const session = rendered.root.findByProps({ accessibilityLabel: `${estimate.sessionCount} ${noun} of approximately ${estimate.minutesPerSession} minutes each.` });
    expect(session.children.join('')).toBe(`${estimate.sessionCount} × ~${estimate.minutesPerSession} min ${noun}`);
    expect(session.props.style.fontWeight).toBe('600');
  });
  it('planning results remain prominent while using unchanged domain functions', () => {
    const planning = source('components/caloriebank/StepPlanningCards.tsx');
    expect(planning).toContain("result: { color: colors.primaryDark, fontSize: 26, fontWeight: '800'");
    expect(planning).toContain('calculateBurnToStepPlan({ ...shared');
    expect(planning).toContain('calculateStepToBurnPlan({ ...shared');
    expect(planning.match(/<WalkingTime steps=/g)).toHaveLength(2);
  });
  it('does not calculate a step target from a mixed sync generation', async () => {
    const { StepPlanningCards } = await import(resolve(__dirname, '../../mobile/components/caloriebank/StepPlanningCards.tsx')) as { StepPlanningCards: React.ComponentType<{ today: TodayResponse }> };
    const today = { burned: { status: 'ready', source: 'Fitbit', adjustmentFactor: .8 }, steps: { status: 'ready', count: 13000, caloriesPerStep: .05, planningSnapshotReady: false }, restOfDayProjection: { status: 'ready', projectedProviderBurnCalories: 3935 } } as unknown as TodayResponse;
    const rendered = await render(React.createElement(StepPlanningCards, { today }));
    const text = JSON.stringify(rendered.toJSON());
    expect(text).toContain('Refresh your activity data to update this estimate.');
    expect(text).not.toContain('34,300');
    expect(rendered.root.findAll(node => String(node.type) === 'Text' && node.props.style?.fontWeight === '800')).toHaveLength(0);
  });
  it('onboarding explicitly saves the chosen target through the shared preference API', async () => {
    const { DailyBankTargetForm } = await import(resolve(__dirname, '../../mobile/components/caloriebank/DailyBankTargetForm.tsx')) as { DailyBankTargetForm: React.ComponentType<{ initialCalories: number; onSaved: () => void }> };
    const rendered = await render(React.createElement(DailyBankTargetForm, { initialCalories: 0, onSaved: vi.fn() }));
    await act(async () => rendered.root.findByProps({ accessibilityLabel: '300 calories per day' }).props.onPress());
    const buttons = rendered.root.findAll((node) => String(node.type) === 'Pressable');
    await act(async () => { buttons[buttons.length - 1]!.props.onPress(); });
    expect(targetStore.writes).toEqual([300]);
  });
  it('Settings saves zero and reloads persisted preference without a goal mutation', async () => {
    targetStore.calories = 200;
    const { default: Settings } = await import(resolve(__dirname, '../../mobile/app/(settings)/daily-bank-target.tsx')) as { default: React.ComponentType };
    const rendered = await render(React.createElement(Settings));
    expect(rendered.root.findByProps({ accessibilityLabel: 'Daily Bank Target in calories' }).props.value).toBe('200');
    await act(async () => rendered.root.findByProps({ accessibilityLabel: '0 calories per day' }).props.onPress());
    const buttons = rendered.root.findAll((node) => String(node.type) === 'Pressable');
    await act(async () => { buttons[buttons.length - 1]!.props.onPress(); });
    expect(targetStore.writes).toEqual([0]);
    await act(async () => rendered.unmount());
    screen = undefined;
    const remounted = await render(React.createElement(Settings));
    expect(remounted.root.findByProps({ accessibilityLabel: 'Daily Bank Target in calories' }).props.value).toBe('0');
  });
  it.each([[500, 'You banked 500 kcal yesterday.'], [-500, 'You enjoyed 500 kcal yesterday.'], [0, 'You were right on target yesterday.']])('describes signed contribution %s', (value, expected) => {
    expect(completedContributionSentence(Number(value))).toBe(expected);
  });
  it('never calls an older completed date yesterday', () => {
    expect(completedContributionSentence(-83, 'on September 4')).toBe('You enjoyed 83 kcal on September 4.');
  });
  it('keeps Home bank-first and example content presentation-only', () => {
    const home = source('app/(tabs)/today.tsx');
    expect(home.indexOf('>Available Bank</Text>')).toBeLessThan(home.indexOf('>Banking Goal</Text>'));
    expect(home.indexOf('>Available Bank</Text>')).toBeLessThan(home.indexOf('>Recovery</Text>'));
    expect(home.indexOf('>Recovery</Text>')).toBeLessThan(home.indexOf('>Banking Goal</Text>'));
    expect(home).toContain('bankSummary && bankSummary.recoveryCalories > 0 ? (');
    expect(home.indexOf('>Banking Goal</Text>')).toBeLessThan(home.indexOf('>Today so far</Text>'));
    expect(home.indexOf('<CompletedContribution')).toBeLessThan(home.indexOf('>Banking Goal</Text>'));
    expect(home.indexOf('>Burned</Text>')).toBeLessThan(home.indexOf('>Eaten</Text>'));
    expect(home).not.toContain('>Steps</Text>');
    expect(home).toContain('Steps today');
    expect(home).toContain('Example Banking Goal: Crumbl cookies');
    expect(home).not.toContain('createOrReplacePlannedTreat');
  });
  it('keeps legacy model naming out of consumer screens', () => {
    for (const file of ['app/(tabs)/today.tsx', 'app/(settings)/planned-treat.tsx', 'app/(settings)/customize-today.tsx', 'app/(settings)/_layout.tsx']) {
      expect(source(file)).not.toContain('Planned Treat');
    }
    const history = source('app/(details)/bank-history.tsx');
    expect(history).not.toContain('Deposited');
    for (const term of ['Banked', 'Deficit', 'Maintenance', 'Surplus']) expect(history).toContain(term);
  });
  it.each([0, 100, 200, 300, 2000])('allows target %i', (calories) => {
    expect(dailyBankTargetInputSchema.parse({ calories })).toEqual({ calories });
  });
  it.each([-1, 1.5, 2001, Infinity])('rejects invalid target %s', (calories) => {
    expect(dailyBankTargetInputSchema.safeParse({ calories }).success).toBe(false);
  });
  it('uses exact tracker identity and isolates direct providers', () => {
    expect(foodTrackerGuidance('apple_health', 'CRONOMETER-GOLD')?.action).toBe('See how to connect Cronometer');
    expect(foodTrackerGuidance('apple_health', 'unknown')?.message).toContain('food-tracking app');
    expect(foodTrackerGuidance('fatsecret', 'CRONOMETER-GOLD')).toBeNull();
  });
  it('renders accessible target presets and explicit zero', async () => {
    const { DailyBankTargetInput } = await import(resolve(__dirname, '../../mobile/components/caloriebank/DailyBankTargetInput.tsx')) as { DailyBankTargetInput: React.ComponentType<{ value: string; onChange: (value: string) => void }> };
    const change = vi.fn();
    const rendered = await render(React.createElement(DailyBankTargetInput, { value: '0', onChange: change }));
    const zero = rendered.root.findByProps({ accessibilityLabel: '0 calories per day' });
    expect(zero.props.accessibilityState.selected).toBe(true);
    await act(async () => rendered.root.findByProps({ accessibilityLabel: '200 calories per day' }).props.onPress());
    expect(change).toHaveBeenCalledWith('200');
  });
  it('renders walking estimate only with sufficient evidence', async () => {
    const { WalkingTime } = await import(resolve(__dirname, '../../mobile/components/caloriebank/StepPlanningCards.tsx')) as { WalkingTime: React.ComponentType<{ steps: number; pace: { stepsPerMinute: number; sampleCount: number } | null }> };
    const rendered = await render(React.createElement(WalkingTime, { steps: 6000, pace: { stepsPerMinute: 100, sampleCount: 2 } }));
    expect(JSON.stringify(rendered.toJSON())).toContain('20');
    await act(async () => rendered.update(React.createElement(WalkingTime, { steps: 6000, pace: null })));
    expect(rendered.toJSON()).toBeNull();
  });
  it('opens and closes actionable Cronometer help', async () => {
    const { FoodTrackerHelp } = await import(resolve(__dirname, '../../mobile/components/caloriebank/FoodTrackerHelp.tsx')) as { FoodTrackerHelp: React.ComponentType<{ provider: string; bundleId: string }> };
    const rendered = await render(React.createElement(FoodTrackerHelp, { provider: 'apple_health', bundleId: 'CRONOMETER-GOLD' }));
    await act(async () => rendered.root.findAll((node) => String(node.type) === 'Pressable')[0]!.props.onPress());
    expect(JSON.stringify(rendered.toJSON())).toContain('Connect Apps & Devices');
    await act(async () => rendered.root.findAll((node) => String(node.type) === 'Pressable')[1]!.props.onPress());
    expect(JSON.stringify(rendered.toJSON())).not.toContain('Connect Apps & Devices');
  });
});
