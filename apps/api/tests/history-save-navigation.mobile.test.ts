import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { IntakeAdjustmentState } from '@caloriebank/schemas';
const h = vi.hoisted(() => ({ focused: true, read: vi.fn(), save: vi.fn(), todaySave: vi.fn(), back: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: h.back }), useLocalSearchParams: () => ({ localDate: '2026-11-12' }),
  useFocusEffect: (callback: () => void) => React.useEffect(() => h.focused ? callback() : undefined, [callback, h.focused]) }));
vi.mock('react-native', () => ({ Pressable: 'Pressable', View: 'View', Text: 'Text', TextInput: 'TextInput', StyleSheet: { create: <T,>(x: T) => x } }));
vi.mock('../../mobile/components/caloriebank/FrostedSurface', () => ({ FrostedScreen: 'Screen' }));
vi.mock('../../mobile/components/caloriebank/KeyboardSafeScrollView', () => ({ KeyboardSafeScrollView: 'ScrollView' }));
vi.mock('../../mobile/lib/api/client', () => ({ fetchHistoricalIntakeAdjustment: h.read, fetchIntakeAdjustment: h.read,
  saveHistoricalIntakeAdjustment: h.save, saveIntakeAdjustment: h.todaySave, ApiHttpError: class extends Error {} }));
let view: ReactTestRenderer;
let Screen: React.ComponentType;
const state: IntakeAdjustmentState = { localDate: '2026-11-12', source: 'Cronometer', revision: 0, selectionRevision: null, manualRevision: 1, baseCalories: 1800, calories: 1800, adjustment: null };
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
const field = () => view.root.find(node => String(node.type) === 'TextInput');
const button = (label: string) => view.root.findAll(node => String(node.type) === 'Pressable').find(node => node.findAll(child => String(child.type) === 'Text').some(child => child.children.join('').endsWith(label)));
async function focus(value: boolean) { await act(async () => { h.focused = value; view.update(React.createElement(Screen)); }); }
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); h.focused = true; h.read.mockResolvedValue(state);
  Screen = (await import(resolve(__dirname, '../../mobile/app/(settings)/edit-calories.tsx'))).default;
  await act(async () => { view = create(React.createElement(Screen)); });
});
afterEach(async () => { await act(async () => { button('Cancel')?.props.onPress(); view.unmount(); }); });

it.each([false, true])('rebases an acknowledged historical save without popping new navigation (refocused=%s)', async refocused => {
  const pending = deferred<IntakeAdjustmentState>(); h.save.mockReturnValueOnce(pending.promise);
  await act(async () => field().props.onChangeText('300'));
  await act(async () => button('Save')!.props.onPress());
  await focus(false); // A notification opens Today while this route stays mounted.
  if (refocused) await focus(true);
  const saved = { ...state, revision: 1, manualRevision: 2, calories: 2100, adjustment: { mode: 'add' as const, calories: 300 } };
  await act(async () => pending.resolve(saved));
  expect(h.back).not.toHaveBeenCalled();
  if (!refocused) await focus(true);
  expect(button('Remove adjustment')).toBeDefined();
  expect(field().props.value).toBe('300');
  h.save.mockResolvedValueOnce({ ...saved, revision: 2, calories: 2200, adjustment: { mode: 'add', calories: 400 } });
  await act(async () => field().props.onChangeText('400'));
  await act(async () => button('Save')!.props.onPress());
  expect(h.save).toHaveBeenLastCalledWith(expect.objectContaining({ localDate: state.localDate, expectedRevision: 1, manualRevision: 2, mode: 'add', calories: 400 }));
  expect(h.back).toHaveBeenCalledOnce();
  expect(h.todaySave).not.toHaveBeenCalled();
});

it('retains a failed draft and retries its original revision after interruption', async () => {
  const pending = deferred<IntakeAdjustmentState>(); h.save.mockReturnValueOnce(pending.promise);
  await act(async () => field().props.onChangeText('333'));
  await act(async () => button('Save')!.props.onPress());
  await focus(false);
  await act(async () => pending.reject(new Error('Offline')));
  await focus(true);
  expect(field().props.value).toBe('333'); expect(button('Remove adjustment')).toBeUndefined();
  expect(h.back).not.toHaveBeenCalled();
  h.save.mockResolvedValueOnce({ ...state, revision: 1, calories: 2133, adjustment: { mode: 'add', calories: 333 } });
  await act(async () => button('Save')!.props.onPress());
  expect(h.save.mock.calls[1]![0]).toEqual(h.save.mock.calls[0]![0]);
  expect(h.back).toHaveBeenCalledOnce();
});
