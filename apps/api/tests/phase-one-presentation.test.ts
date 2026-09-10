import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyBankTargetInputSchema } from '@caloriebank/schemas';
import { completedContributionSentence } from '../../mobile/lib/today/presentation';
import { foodTrackerGuidance } from '../../mobile/lib/healthkit/food-tracker-guidance';

const targetStore = vi.hoisted(() => ({ calories: 0, writes: [] as number[] }));
vi.mock('../../mobile/lib/api/client', () => ({
  fetchDailyBankTarget: async () => ({ calories: targetStore.calories, chosen: targetStore.writes.length > 0 }),
  saveDailyBankTarget: async (calories: number) => { targetStore.calories = calories; targetStore.writes.push(calories); return { calories, chosen: true }; },
  fetchGoalConfiguration: async () => ({ goalMode: 'maintain', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: 0 }),
  saveGoalConfiguration: async (value: unknown) => value,
}));
beforeEach(() => { targetStore.calories = 0; targetStore.writes = []; });

vi.mock('react-native', () => ({
  Text: 'Text', View: 'View', Pressable: 'Pressable', TextInput: 'TextInput', ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
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
  it('onboarding explicitly saves the chosen target through the shared preference API', async () => {
    const { GoalConfigurationForm } = await import(resolve(__dirname, '../../mobile/components/caloriebank/GoalConfigurationForm.tsx')) as { GoalConfigurationForm: React.ComponentType<{ mode: string; onSaved: () => void }> };
    const rendered = await render(React.createElement(GoalConfigurationForm, { mode: 'onboarding', onSaved: vi.fn() }));
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
    expect(home.indexOf('>Banking Goal</Text>')).toBeLessThan(home.indexOf('>Today so far</Text>'));
    expect(home.indexOf('{latestChangeValue}</Text>')).toBeLessThan(home.indexOf('>Banking Goal</Text>'));
    expect(home.indexOf('>Eaten</Text>')).toBeLessThan(home.indexOf('>Burned</Text>'));
    expect(home.indexOf('>Burned</Text>')).toBeLessThan(home.indexOf('>Steps</Text>'));
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
