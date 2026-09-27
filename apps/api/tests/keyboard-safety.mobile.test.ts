import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('expo', () => ({ requireNativeModule: () => ({ watch: vi.fn(), unwatch: vi.fn(), measure: vi.fn(), addListener: () => ({ remove: vi.fn() }) }) }));
const platform = vi.hoisted(() => ({ OS: 'ios' }));
const api = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }));
vi.mock('react-native', () => ({
  findNodeHandle: () => null, Platform: platform, useWindowDimensions: () => ({ width: 320, fontScale: 2 }), ScrollView: 'ScrollView', Pressable: 'Pressable', Text: 'Text',
  View: 'View', TextInput: 'TextInput', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: <T,>(x: T) => x },
}));
vi.mock('../../mobile/lib/api/client', () => ({ fetchGoalConfiguration: api.fetch, saveGoalConfiguration: api.save }));
let view: ReactTestRenderer | undefined;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); vi.useFakeTimers();
  api.fetch.mockResolvedValue({ goalMode: 'cut', adjustmentSource: 'manual_calories', dailyEnergyAdjustment: -300, desiredWeeklyWeightChange: null });
  api.save.mockResolvedValue({ goalMode: 'cut', dailyEnergyAdjustment: -500 });
});
afterEach(async () => { if (view) await act(async () => view?.unmount()); vi.useRealTimers(); });

it.each(['ios', 'android'])('keeps field, explanation and Save in the same native scroll owner on %s', async os => {
  platform.OS = os;
  const { KeyboardSafeScrollView } = await import(resolve(__dirname, '../../mobile/components/caloriebank/KeyboardSafeScrollView.tsx'));
  const { GoalConfigurationForm } = await import(resolve(__dirname, '../../mobile/components/caloriebank/GoalConfigurationForm.tsx'));
  const saved = vi.fn();
  await act(async () => { view = create(React.createElement(KeyboardSafeScrollView, {}, React.createElement(GoalConfigurationForm, { mode: 'settings', onSaved: saved }))); });
  const scroll = view!.root.find(node => String(node.type) === 'ScrollView');
  expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(os === 'ios');
  expect(scroll.props.keyboardDismissMode).toBe(os === 'ios' ? 'interactive' : 'none');
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  const input = scroll.find(node => String(node.type) === 'TextInput');
  expect(input.props.keyboardType).toBe('number-pad');
  await act(async () => input.props.onChangeText('500'));
  expect(JSON.stringify(view!.toJSON())).toContain('estimated actual burn');
  const save = scroll.findAll(node => String(node.type) === 'Pressable').find(node => node.findAll(child => String(child.type) === 'Text').some(child => child.children.join('').startsWith('Save ')));
  expect(save).toBeDefined();
  await act(async () => save!.props.onPress());
  expect(api.save).toHaveBeenCalledOnce();
  await act(async () => { vi.runAllTimers(); });
  expect(saved).toHaveBeenCalledOnce();
});
