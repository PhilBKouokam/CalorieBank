import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyBankTargetInputSchema } from '@caloriebank/schemas';
import type { TodayResponse } from '@caloriebank/schemas';
import { calculateBurnToStepPlan, calculateStepToBurnPlan, walkingTimeFromPace } from '@caloriebank/domain';
import { completedContributionSentence } from '../../mobile/lib/today/presentation';
import { foodTrackerGuidance } from '../../mobile/lib/healthkit/food-tracker-guidance';

const budgetStore=vi.hoisted(()=>({enabled:false,plan:vi.fn(),read:vi.fn(async()=>null)}));
vi.mock('../../mobile/lib/api/eating-budget',()=>({get eatingBudgetEnabled(){return budgetStore.enabled;},fetchEatingBudget:()=>budgetStore.enabled?budgetStore.read():Promise.resolve(null),fetchEatingPlan:(...args:unknown[])=>budgetStore.plan(...args)}));
const targetStore = vi.hoisted(() => ({ calories: 0, writes: [] as number[] }));
const homeStore = vi.hoisted(() => ({ recovery: 0 }));
const navigation=vi.hoisted(()=>({push:vi.fn(),replace:vi.fn()}));
const viewport=vi.hoisted(()=>({width:390,fontScale:1}));
const appStateStore = vi.hoisted(() => ({ onChange: null as null | ((state: string) => void) }));
vi.mock('expo-router', () => ({ useRouter: () => navigation, useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]), Link: 'Link' }));
vi.mock('expo-web-browser',()=>({openBrowserAsync:vi.fn()}));
vi.mock('../../mobile/lib/notifications/morning-bank-update',()=>({detachMorningBankUpdateDevice:vi.fn()}));
vi.mock('@clerk/expo',()=>({useClerk:()=>({signOut:vi.fn()})}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('../../mobile/lib/lifecycle/account-lifecycle', () => ({ isAccountLifecycleRunning: () => false, subscribeToAccountLifecycleActivity: () => () => {}, subscribeToAccountLifecycle: () => () => {}, runAccountLifecycle: async () => ({ detail: null }) }));
vi.mock('../../mobile/lib/api/settings-concurrency', () => ({ SettingsConflictError: class extends Error {},
 fetchProtectedGoal: async () => ({ value: { goalMode: 'maintain', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: 0 }, revision: '0' }), saveProtectedGoal: async (value: unknown) => value,
fetchProtectedTarget: async () => ({ value: { calories: targetStore.calories, chosen: targetStore.writes.length > 0 }, revision: String(targetStore.writes.length) }),
 saveProtectedTarget: async (calories: number) => { targetStore.calories = calories; targetStore.writes.push(calories); return { calories, chosen: true }; },
}));
vi.mock('../../mobile/lib/api/client', () => ({
  getApiBaseUrl: () => 'https://fixture.invalid',
  fetchBankSummary: async () => ({ openingBankStatus: 'initialized', availableBankCalories: homeStore.recovery ? 0 : 2843, recoveryCalories: homeStore.recovery, latestCompletedDate: '2026-09-10', latestDailyBankChange: 547 }),
  fetchPlannedTreat: async () => ({ status: 'no_plan' }),
  fetchToday: async () => ({ burned: { status: 'unavailable' }, eaten: { status: 'unavailable' }, steps: { status: 'unavailable' }, workouts: { items: [], status: 'unavailable' }, dashboardVisibility: { showTodaySoFar: false, showSteps: false, showCurrentGoal: false, showWorkouts: false } }),
  fetchDashboardPreferences: async () => ({ showLatestFinalizedContribution: true, showTodaySoFar: true, showCurrentGoal: false, showSteps: true, showWorkouts: false }),
  fetchProviderSelection: async () => ({ expenditure: {}, intake: {} }),
  fetchOnboardingStatus: async () => ({ completed: true, stage: 'complete', preparation: { history: 'complete' }, expenditure: { provider: 'google_health_fitbit' }, intake: { provider: 'apple_health' } }),
  fetchDailyBankTarget: async () => ({ calories: targetStore.calories, chosen: targetStore.writes.length > 0 }),
  saveDailyBankTarget: async (calories: number) => { targetStore.calories = calories; targetStore.writes.push(calories); return { calories, chosen: true }; },
  fetchGoalConfiguration: async () => ({ goalMode: 'maintain', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: 0 }),
  saveGoalConfiguration: async (value: unknown) => value,
}));
beforeEach(() => { budgetStore.enabled=false;budgetStore.plan.mockReset(); targetStore.calories = 0; targetStore.writes = []; });

vi.mock('expo', () => ({ requireNativeModule: () => ({ watch: vi.fn(), unwatch: vi.fn(), measure: vi.fn(), addListener: () => ({ remove: vi.fn() }) }) }));
vi.mock('react-native', () => ({
  findNodeHandle: () => null,
  Keyboard: { isVisible: () => false, addListener: () => ({ remove: vi.fn() }) },
  AppState: { addEventListener: (_event: string, callback: (state: string) => void) => { appStateStore.onChange = callback; return { remove: vi.fn() }; } },
  Platform: { OS: 'ios' },
  Text: 'Text', View: 'View', Pressable: 'Pressable', TextInput: 'TextInput', ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl',
  useWindowDimensions: () => viewport,
  StyleSheet: { flatten: (value: unknown) => Object.assign({}, ...[value].flat(Infinity).filter(Boolean)), create: <T,>(value: T) => value },
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null,
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
let screen: ReactTestRenderer | undefined;
afterEach(async () => { if (screen) await act(async () => screen!.unmount()); screen = undefined; vi.useRealTimers(); });
async function render(component: React.ReactElement) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(async () => { screen = create(component); });
  return screen!;
}
const source = (path: string) => readFileSync(resolve(__dirname, '../../mobile', path), 'utf8');
const textContent = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : textContent(child)).join('');

describe('Phase 1 consumer release invariants', () => {
  it('updates midnight feasibility on both cards without changing steps or unsaved inputs, then expires coverage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T23:39:30Z'));
    const { StepPlanningCards } = await import(resolve(__dirname, '../../mobile/components/caloriebank/StepPlanningCards.tsx')) as { StepPlanningCards: React.ComponentType<{ today: TodayResponse }> };
    const today = { date: '2026-10-15', timezone: 'UTC', burned: { status: 'ready', source: 'Fitbit', adjustmentFactor: .8 }, steps: { status: 'ready', count: 2000, caloriesPerStep: .05, walkingPace: { stepsPerMinute: 100, sampleCount: 3 } }, restOfDayProjection: { status: 'ready', coverageStatus: 'known', coverageAt: '2026-10-15T23:39:30Z', projectedProviderBurnCalories: 4900, unroundedProjectedProviderBurnCalories: 4900 } } as unknown as TodayResponse;
    const rendered = await render(React.createElement(StepPlanningCards, { today }));
    const inputs = rendered.root.findAll(node => String(node.type) === 'TextInput');
    await act(async () => { inputs[0]!.props.onChangeText('4000'); inputs[1]!.props.onChangeText('4000'); });
    const notices = () => rendered.root.findAll(node => String(node.type) === 'Text' && textContent(node).includes('won’t fit before midnight'));
    expect(notices()).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(notices()).toHaveLength(2);
    expect(textContent(rendered.root)).toContain('2,000 steps remaining');
    expect(inputs.map(input => input.props.value)).toEqual(['4000', '4000']);
    await act(async () => { vi.advanceTimersByTime(30 * 60000); });
    expect(textContent(rendered.root)).not.toContain('2,000 steps remaining');
    expect(JSON.stringify(rendered.toJSON())).toContain('Waiting for newer activity data.');
    expect(inputs.map(input => input.props.value)).toEqual(['4000', '4000']);
  });

  it('uses the ordinary baseline in both cards and withholds on expiry rather than changing models', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    const { StepPlanningCards } = await import(resolve(__dirname, '../../mobile/components/caloriebank/StepPlanningCards.tsx')) as { StepPlanningCards: React.ComponentType<{ today: TodayResponse }> };
    const today = {
      date: '2026-10-30', timezone: 'UTC', burned: { status: 'ready', source: 'Fitbit', adjustmentFactor: 0.8 },
      steps: {
        status: 'ready', count: 9000, caloriesPerStep: 0.04, planningSnapshotReady: true,
        ordinaryProjection: {
          basis: 'recorded_sessions_proxy', expiresAt: '2026-10-30T12:05:00Z',
          rawProjectedBurnBeforeWalking: 2000, rawIncrementalKcalPerStep: 0.04 + (50 - 75) / 6000,
          stepsPerMinute: 100, walkingSampleCount: 2, includedHistoryHours: 117, missingHistoryHours: 0,
        },
      },
      restOfDayProjection: { status: 'ready', planningExpiresAt: '2026-10-30T12:30:00Z',
        projectedProviderBurnCalories: 1700, unroundedProjectedProviderBurnCalories: 1700 },
    } as unknown as TodayResponse;
    const rendered = await render(React.createElement(StepPlanningCards, { today }));
    const inputs = rendered.root.findAll(node => String(node.type) === 'TextInput');
    await act(async () => { inputs[0]!.props.onChangeText('2000'); inputs[1]!.props.onChangeText('14000'); });
    expect(textContent(rendered.root)).toContain('14,000 extra walking steps');
    expect(textContent(rendered.root)).not.toContain('23,000 total steps');
    expect(textContent(rendered.root)).toContain('14,000 extra walking steps remaining');
    expect(textContent(rendered.root)).toContain('~2,500 kcal');
    expect(textContent(rendered.root)).toContain('Some exercise may be included.');
    await act(async () => { vi.advanceTimersByTime(5 * 60000 + 1); });
    expect(textContent(rendered.root)).not.toContain('29,000 total steps');
    expect(textContent(rendered.root)).not.toContain('20,000 steps remaining');
    expect(textContent(rendered.root)).not.toContain('Rest-only estimate.');
    expect(textContent(rendered.root)).toContain('Waiting for newer activity data.');
    expect(textContent(rendered.root)).not.toContain('Some exercise may be included.');
    expect(inputs.map(input => input.props.value)).toEqual(['2000', '14000']);
  });

  it('expires a persisted assumption on both cards across refresh and remount without losing edits', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T08:00:00Z'));
    const { StepPlanningCards } = await import(resolve(__dirname, '../../mobile/components/caloriebank/StepPlanningCards.tsx')) as { StepPlanningCards: React.ComponentType<{ today: TodayResponse }> };
    const today = { date: '2026-10-15', timezone: 'UTC', burned: { status: 'ready', source: 'Fitbit', adjustmentFactor: .8 }, steps: { status: 'ready', count: 2000, caloriesPerStep: .05, walkingPace: { stepsPerMinute: 100, sampleCount: 3 } }, restOfDayProjection: { status: 'ready', coverageStatus: 'uncertain', coverageAt: null, planningAnchorAt: '2026-10-15T08:00:00Z', planningExpiresAt: '2026-10-15T08:30:00Z', planningAnchorKind: 'retrieval_assumption', projectedProviderBurnCalories: 3540, unroundedProjectedProviderBurnCalories: 3540 } } as unknown as TodayResponse;
    const rendered = await render(React.createElement(StepPlanningCards, { today }));
    const inputs = rendered.root.findAll(node => String(node.type) === 'TextInput');
    await act(async () => { inputs[0]!.props.onChangeText('4000'); inputs[1]!.props.onChangeText('31200'); });
    expect(textContent(rendered.root)).toContain('29,200 steps remaining');
    await act(async () => { vi.advanceTimersByTime(30 * 60000); });
    expect(textContent(rendered.root)).toContain('29,200 steps remaining');
    await act(async () => { vi.setSystemTime(new Date('2026-10-15T08:30:00.001Z')); appStateStore.onChange?.('active'); });
    expect(textContent(rendered.root)).not.toContain('29,200 steps remaining');
    expect(inputs.map(input => input.props.value)).toEqual(['4000', '31200']);
    await act(async () => { rendered.update(React.createElement(StepPlanningCards, { today: { ...today } })); });
    expect(textContent(rendered.root).match(/Waiting for newer activity data\./g)).toHaveLength(2);
    await act(async () => { rendered.unmount(); });
    const remounted = await render(React.createElement(StepPlanningCards, { today }));
    expect(textContent(remounted.root).match(/Waiting for newer activity data\./g)).toHaveLength(2);
    expect(textContent(remounted.root)).not.toContain('Review Health Connections');
  });

  it.each([0, 35])('keeps Recovery adjacent to the bank only when active (%s)', async (recovery) => {
    homeStore.recovery = recovery;
    const { default: Home } = await import(resolve(__dirname, '../../mobile/app/(tabs)/today.tsx')) as { default: React.ComponentType };
    const rendered = await render(React.createElement(Home));
    const labels = rendered.root.findAll(node => String(node.type) === 'Text').map(node => node.children.join(''));
    const ordered = labels.filter(label => ['Available Bank', 'Recovery', 'Today so far', 'If I walk…'].includes(label));
    expect(ordered).toEqual(recovery ? ['Available Bank', 'Recovery', 'Today so far', 'If I walk…'] : ['Available Bank', 'Today so far', 'If I walk…']);
    expect(labels).not.toContain('Banking Goal');
  });
  it.each([true, false])('renders compact planning inputs and unchanged answers; walking evidence=%s', async (hasPace) => {
    const { StepPlanningCards } = await import(resolve(__dirname, '../../mobile/components/caloriebank/StepPlanningCards.tsx')) as { StepPlanningCards: React.ComponentType<{ today: TodayResponse }> };
    const today = { date: '2026-10-15', timezone: 'UTC', burned: { status: 'ready', source: 'Fitbit', adjustmentFactor: .8 }, steps: { status: 'ready', count: 8500, caloriesPerStep: .06, walkingPace: hasPace ? { stepsPerMinute: 100, sampleCount: 3 } : null }, restOfDayProjection: { status: 'ready', projectedProviderBurnCalories: 3600, unroundedProjectedProviderBurnCalories: 3600 } } as unknown as TodayResponse;
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
    const text = rendered.root.findAll(node => String(node.type) === 'Text').map(textContent).join('|');
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
    const total = rendered.root.findAll(node => String(node.type) === 'Text').find(node => textContent(node) === `${inverse.totalDailyStepsNeeded.toLocaleString()} total steps`)!;
    const remaining = rendered.root.findAll(node => String(node.type) === 'Text').find(node => textContent(node) === `${inverse.remainingSteps.toLocaleString()} steps remaining`)!;
    expect(remaining.props.style.fontWeight).toBe('700');
    expect(remaining.props.style.color).toBe('#171717');
    expect(remaining.props.style.fontSize).toBe(20);
    expect(remaining.props.style.fontSize).toBeLessThan(total.props.style.fontSize);
    const walkRemaining = rendered.root.findAll(node => String(node.type) === 'Text').find(node => textContent(node) === `About ${forward.additionalSteps.toLocaleString()} more steps`)!;
    expect(walkRemaining.props.style).toEqual(remaining.props.style);
    expect(total.props.style.color).toBe('#176E61');
    if (hasPace) {
      const times = rendered.root.findAll(node => String(node.type) === 'Text' && textContent(node).startsWith('About ') && textContent(node).includes(' hr'));
      expect(times).toHaveLength(2);
      for (const time of times) expect(time.props.style.color).toBe('#17483C');
    }
    const actual = rendered.root.findAll(node => String(node.type) === 'Text').find(node => textContent(node) === `${forward.projectedAdjustedBurnCalories.toLocaleString()} kcal`)!;
    expect(actual.props.style.color).toBe('#17483C');
    expect(actual.props.style.fontWeight).toBe('800');
    let paragraph = actual.parent!;
    while (String(paragraph.type) !== 'Text') paragraph = paragraph.parent!;
    expect(textContent(paragraph)).toBe(`${forward.projectedProviderBurnCalories.toLocaleString()} × 0.8 = ${forward.projectedAdjustedBurnCalories.toLocaleString()} kcal`);
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
    const summary = detail.slice(detail.indexOf('<FrostedView style={styles.card}>'), detail.indexOf('<Text style={styles.sectionTitle}>'));
    expect(summary.match(/<FrostedView style=\{styles.card\}>/g)).toHaveLength(1);
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
    expect(textContent(session)).toBe(`${estimate.sessionCount} × ~${estimate.minutesPerSession} min ${noun}`);
    expect(session.props.style.fontWeight).toBe('600');
  });
  it('planning results remain prominent while using unchanged domain functions', () => {
    const planning = source('components/caloriebank/StepPlanningCards.tsx');
    expect(planning).toContain("result: { color: '#176E61', fontSize: 28, fontWeight: '800'");
    expect(planning).toContain('traceBurnToStepPlan(snapshot,');
    expect(planning).toContain('calculateStepToBurnPlan({ ...snapshot.plannerInput');
    expect(planning.match(/<WalkingTime steps=/g)).toHaveLength(2);
  });
  it('does not calculate a step target from a mixed sync generation', async () => {
    const { StepPlanningCards } = await import(resolve(__dirname, '../../mobile/components/caloriebank/StepPlanningCards.tsx')) as { StepPlanningCards: React.ComponentType<{ today: TodayResponse }> };
    const today = { date: '2026-10-15', timezone: 'UTC', burned: { status: 'ready', source: 'Fitbit', adjustmentFactor: .8 }, steps: { status: 'ready', count: 13000, caloriesPerStep: .05, planningSnapshotReady: false }, restOfDayProjection: { status: 'ready', projectedProviderBurnCalories: 3935 } } as unknown as TodayResponse;
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
  it('keeps the approved Home hierarchy and Banking Goal in Settings only', () => {
    const home=source('app/(tabs)/today.tsx');
    expect(home.indexOf('>Available Bank</Text>')).toBeLessThan(home.indexOf('>Recovery</Text>'));
    expect(home.indexOf('>Recovery</Text>')).toBeLessThan(home.indexOf('>Today so far</Text>'));
    expect(home.indexOf('>Today so far</Text>')).toBeLessThan(home.indexOf('<WalkingEatingCard'));
    expect(home.indexOf('>Burned</Text>')).toBeLessThan(home.indexOf('>Eaten</Text>'));
    expect(home.indexOf('>Eaten</Text>')).toBeLessThan(home.indexOf('>Projected burn</Text>'));
    expect(home.indexOf('>Projected burn</Text>')).toBeLessThan(home.indexOf('>Eating budget</Text>'));
    expect(home).not.toContain('>Banking Goal</Text>');expect(home).not.toContain('fetchPlannedTreat');
    expect(source('app/(tabs)/settings.tsx')).toContain("href: '/planned-treat'");
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

it('renders quiet-compatible forward/inverse with no active contribution and withholds on expiry without active fallback',async()=>{
 vi.useFakeTimers();const now=new Date('2026-02-10T12:00:00Z');vi.setSystemTime(now);
 const {StepPlanningCards}=await import(resolve(__dirname,'../../mobile/components/caloriebank/StepPlanningCards.tsx'));
 const today={date:'2026-02-10',timezone:'UTC',burned:{status:'ready',source:'Fitbit',adjustmentFactor:.8,raw:1200},steps:{status:'ready',source:'Fitbit',count:10000,caloriesPerStep:null,estimationStatus:'unavailable',planningSnapshotReady:true,quietWalkingForecast:{status:'ready',basis:'matched_total_above_selected_quiet',rawIncrementalKcalPerStep:.04,baselineModelVersion:'synthetic-model',calibrationVersion:'synthetic-calibration',baselineProviderKcalPerHour:60,rawProjectedBurnBeforeWalking:1920,planningAnchorAt:now.toISOString(),expiresAt:new Date(now.getTime()+5*60000).toISOString(),localDate:'2026-02-10',timezone:'UTC',source:'Fitbit',stepsPerMinute:100,walkingSampleCount:1}},restOfDayProjection:{status:'ready',evidenceType:'historical_low_activity_hours',modelVersion:'synthetic-model',providerKcalPerHour:60,planningAnchorAt:now.toISOString(),planningExpiresAt:new Date(now.getTime()+30*60000).toISOString(),coverageStatus:'known',unroundedProjectedProviderBurnCalories:1920,projectedProviderBurnCalories:1920}} as unknown as TodayResponse;
 const rendered=await render(React.createElement(StepPlanningCards,{today}));const inputs=rendered.root.findAll(node=>String(node.type)==='TextInput');
 await act(async()=>{inputs[0]!.props.onChangeText('2000');inputs[1]!.props.onChangeText('24500');});
 expect(textContent(rendered.root)).toContain('24,500 total steps');expect(textContent(rendered.root)).toContain('14,500 steps remaining');expect(textContent(rendered.root)).toContain('2,000 kcal');
 await act(async()=>{vi.advanceTimersByTime(5*60000+1);});
 expect(textContent(rendered.root)).not.toContain('24,500 total steps');
});
it('a new client does not relabel an old API active coefficient as quiet-compatible',async()=>{
 const {StepPlanningCards}=await import(resolve(__dirname,'../../mobile/components/caloriebank/StepPlanningCards.tsx'));
 const now=new Date(),today={date:now.toISOString().slice(0,10),timezone:'UTC',burned:{status:'ready',source:'Fitbit',adjustmentFactor:.8},steps:{status:'ready',source:'Fitbit',count:10000,caloriesPerStep:.02},restOfDayProjection:{status:'ready',evidenceType:'historical_low_activity_hours',coverageAt:now.toISOString(),unroundedProjectedProviderBurnCalories:1920,projectedProviderBurnCalories:1920}} as unknown as TodayResponse;
 const rendered=await render(React.createElement(StepPlanningCards,{today}));expect(textContent(rendered.root)).toContain('This estimate needs recent step and calorie-burn data.');
});

it.each([[320,1],[390,1],[320,2],[390,2]])('renders the actual new walking card at width%s scale%s with honest eating state',async(width,fontScale)=>{
 viewport.width=width;viewport.fontScale=fontScale;vi.useFakeTimers();const now=new Date('2026-02-10T12:00:00Z');vi.setSystemTime(now);
 const {WalkingEatingCard}=await import(resolve(__dirname,'../../mobile/components/caloriebank/WalkingEatingCard.tsx'));
 const q={status:'ready',basis:'matched_total_above_selected_quiet',rawIncrementalKcalPerStep:.04,baselineModelVersion:'synthetic-model',calibrationVersion:'synthetic-cal',baselineProviderKcalPerHour:60,rawProjectedBurnBeforeWalking:1920,planningAnchorAt:now.toISOString(),expiresAt:new Date(now.getTime()+5*60000).toISOString(),localDate:'2026-02-10',timezone:'UTC',source:'Fitbit',stepsPerMinute:100,walkingSampleCount:1};
 const today={date:'2026-02-10',timezone:'UTC',burned:{status:'ready',adjustmentFactor:.8,source:'Fitbit'},steps:{status:'ready',source:'Fitbit',count:10000,caloriesPerStep:null,planningSnapshotReady:true,quietWalkingForecast:q},restOfDayProjection:{status:'ready',evidenceType:'historical_low_activity_hours',modelVersion:'synthetic-model',providerKcalPerHour:60,planningAnchorAt:now.toISOString(),planningExpiresAt:new Date(now.getTime()+30*60000).toISOString(),unroundedProjectedProviderBurnCalories:1920}} as unknown as TodayResponse;
 const open=vi.fn(),rendered=await render(React.createElement(WalkingEatingCard,{today,pending:false,onOpenDetails:open}));
 const input=rendered.root.find(node=>String(node.type)==='TextInput');expect(input.props.selectTextOnFocus).toBe(true);
 await act(async()=>input.props.onChangeText('24500'));expect(textContent(rendered.root)).toContain('2,000 kcal');expect(textContent(rendered.root)).toContain('Your eating budget isn’t available yet.');
 expect(input.props.style).toEqual(expect.arrayContaining([expect.objectContaining({maxWidth:'100%',minHeight:48})]));
 const action=rendered.root.find(node=>String(node.type)==='Pressable');await act(async()=>action.props.onPress());expect(open).toHaveBeenCalledOnce();
 await act(async()=>rendered.update(React.createElement(WalkingEatingCard,{today,pending:false,guidanceAllowed:false,onOpenDetails:open})));expect(textContent(rendered.root)).not.toContain('2,000 kcal');
 await act(async()=>rendered.update(React.createElement(WalkingEatingCard,{today,pending:true,onOpenDetails:open})));expect(textContent(rendered.root)).not.toContain('2,000 kcal');
 await act(async()=>rendered.update(React.createElement(WalkingEatingCard,{today:{...today,steps:{...today.steps,ordinaryProjection:{expiresAt:new Date(now.getTime()+3600000).toISOString()} as never}},pending:false,onOpenDetails:open})));expect(textContent(rendered.root)).not.toContain('2,000 kcal');
 await act(async()=>rendered.update(React.createElement(WalkingEatingCard,{today,pending:false,onOpenDetails:open})));await act(async()=>{vi.advanceTimersByTime(5*60000+1);});expect(textContent(rendered.root)).not.toContain('2,000 kcal');
 viewport.width=390;viewport.fontScale=1;
});

it('keeps Banking Goal accessible through the actual Settings row without placing it in History',async()=>{
 navigation.push.mockClear();const {default:Settings}=await import(resolve(__dirname,'../../mobile/app/(tabs)/settings.tsx'));
 const rendered=await render(React.createElement(Settings));const row=rendered.root.find(node=>String(node.type)==='Pressable'&&node.props.accessibilityLabel==='Banking Goal');
 await act(async()=>row.props.onPress());expect(navigation.push).toHaveBeenCalledWith('/planned-treat');
});

it('renders qualified total intake and discards an in-flight plan after refresh/source generation changes',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));budgetStore.enabled=true;
 const {WalkingEatingCard}=await import(resolve(__dirname,'../../mobile/components/caloriebank/WalkingEatingCard.tsx'));
 const anchor='2026-02-10T12:00:00.000Z',expiresAt='2026-02-10T12:05:00.000Z',context=`g1:${'a'.repeat(64)}`;
 const q={status:'ready',basis:'matched_total_above_selected_quiet',rawIncrementalKcalPerStep:.04,baselineModelVersion:'synthetic-model',calibrationVersion:'synthetic-cal',baselineProviderKcalPerHour:60,rawProjectedBurnBeforeWalking:1920,planningAnchorAt:anchor,expiresAt,localDate:'2026-02-10',timezone:'UTC',source:'Synthetic',stepsPerMinute:100,walkingSampleCount:1};
 const today={date:'2026-02-10',timezone:'UTC',guidanceContextVersion:context,burned:{status:'ready',adjustmentFactor:.8,source:'Synthetic'},steps:{status:'ready',source:'Synthetic',count:10000,planningSnapshotReady:true,quietWalkingForecast:q},restOfDayProjection:{status:'ready',evidenceType:'historical_low_activity_hours',modelVersion:'synthetic-model',providerKcalPerHour:60,planningAnchorAt:anchor,planningExpiresAt:expiresAt,unroundedProjectedProviderBurnCalories:1920}} as unknown as TodayResponse;
 const budget={version:1,localDate:today.date,timezone:today.timezone,guidanceContextVersion:context,signedGoalAdjustmentCalories:0,dailyBankTargetCalories:0,intake:{calories:null,semantic:'unknown'},budget:{status:'ready',estimated:true,totalCalories:1536,comparison:null,comparisonExpiresAt:null,expiresAt},planningAvailable:true,planningModel:{basis:q.basis,baselineModelVersion:q.baselineModelVersion,calibrationVersion:q.calibrationVersion,coverageAt:anchor,currentSteps:10000,rawProviderCaloriesPerAdditionalStep:.04,stepsPerMinute:100,expiresAt}} as import('@caloriebank/schemas').EatingBudgetResponse;
 let complete:(value:unknown)=>void=()=>{};budgetStore.plan.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
 const rendered=await render(React.createElement(WalkingEatingCard,{today,budget,pending:false,onOpenDetails:()=>{}}));
 const input=rendered.root.find(node=>String(node.type)==='TextInput');await act(async()=>input.props.onChangeText('12000'));await act(async()=>{vi.advanceTimersByTime(301);});
 const response={version:1,localDate:today.date,timezone:today.timezone,snapshot:budget,plan:{status:'ready',hypothetical:true,totalSteps:12000,additionalSteps:2000,totalIntakeCalories:1600,expiresAt}};
 await act(async()=>complete(response));expect(textContent(rendered.root)).toContain('1,600 kcal');
 await act(async()=>input.props.onChangeText('13000'));await act(async()=>{vi.advanceTimersByTime(301);});
 await act(async()=>rendered.update(React.createElement(WalkingEatingCard,{today,budget,pending:true,guidanceAllowed:false,onOpenDetails:()=>{}})));
 await act(async()=>complete({...response,plan:{...response.plan,totalSteps:13000,totalIntakeCalories:1632}}));expect(textContent(rendered.root)).not.toContain('1,632 kcal');expect(textContent(rendered.root)).not.toContain('1,600 kcal');
});
