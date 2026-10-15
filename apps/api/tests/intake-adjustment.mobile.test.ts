import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { IntakeAdjustmentState } from '@caloriebank/schemas';
vi.mock('expo', () => ({ requireNativeModule: vi.fn() }));
const api = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: <T,>(x: T) => x } }));
vi.mock('../../mobile/lib/api/client', () => ({ saveIntakeAdjustment: api.save, ApiHttpError: class extends Error {} }));
const state: IntakeAdjustmentState = { localDate: '2026-10-13', revision: 0, selectionRevision: null, manualRevision: 0, source: 'Cronometer', baseCalories: 1800, calories: 1800, adjustment: null };
let view: ReactTestRenderer;
const saved = vi.fn(), cancel = vi.fn();
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); api.save.mockResolvedValue({}); });
afterEach(async () => { if (view) await act(async () => view.unmount()); });
async function mount(s = state) {
  const { IntakeAdjustmentEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/IntakeAdjustmentEditor.tsx'));
  await act(async () => { view = create(React.createElement(IntakeAdjustmentEditor, { state: s, onSaved: saved, onCancel: cancel })); });
}
async function press(label: string) {
  const button = view.root.findAll(node => String(node.type) === 'Pressable').find(node => node.findAll(child => String(child.type) === 'Text').some(child => child.children.join('').endsWith(label)));
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.props.onPress());
}
const field = () => view.root.find(node => String(node.type) === 'TextInput');
it('adds a distinct amount, previews the total and sends one revision-scoped adjustment', async () => {
  await mount(); expect(field().props.value).toBe(''); expect(field().props.selectTextOnFocus).toBe(true);
  await act(async () => field().props.onChangeText('300'));
  expect(JSON.stringify(view.toJSON())).toContain('2,100');
  await press('Save'); expect(api.save).toHaveBeenCalledWith({ localDate: state.localDate, expectedRevision: 0, selectionRevision: null, manualRevision: 0, mode: 'add', calories: 300 });
  expect(saved).toHaveBeenCalledOnce();
});
it('switches to replacement without reinterpreting the addition as a total', async () => {
  await mount(); await act(async () => field().props.onChangeText('300')); await press('Replace today’s total');
  expect(field().props.value).toBe('1800');
  await act(async () => field().props.onChangeText('2500')); await press('Save');
  expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ mode: 'replace', calories: 2500 }));
});
it('edits the existing addition instead of compounding it, and supports removal and cancellation', async () => {
  await mount({ ...state, revision: 1, calories: 2100, adjustment: { mode: 'add', calories: 300 } });
  expect(field().props.value).toBe('300'); await press('Cancel'); expect(api.save).not.toHaveBeenCalled();
  await press('Remove adjustment'); expect(api.save).not.toHaveBeenCalled(); // Cancelled screen cannot submit.
  await act(async () => view.unmount());
  await mount({ ...state, revision: 1, calories: 2100, adjustment: { mode: 'add', calories: 300 } });
  await press('Remove adjustment'); expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ mode: 'none', calories: 0, expectedRevision: 1 }));
});
it('keeps failed input and rejects missing or invalid additions', async () => {
  await mount({ ...state, baseCalories: null, calories: null });
  await act(async () => field().props.onChangeText('300')); await press('Save'); expect(api.save).not.toHaveBeenCalled();
  await press('Replace today’s total'); await act(async () => field().props.onChangeText('2500'));
  api.save.mockRejectedValueOnce(new Error('offline')); await press('Save'); expect(saved).not.toHaveBeenCalled(); expect(field().props.value).toBe('2500');
  await press('Save'); expect(saved).toHaveBeenCalledOnce();
});
it('retains an offline addition and retries the identical request without accumulating it', async () => {
  await mount(); await act(async () => field().props.onChangeText('300'));
  api.save.mockRejectedValueOnce(new Error('offline')); await press('Save');
  expect(saved).not.toHaveBeenCalled(); expect(field().props.value).toBe('300');
  await press('Save');
  expect(api.save.mock.calls[1]?.[0]).toEqual(api.save.mock.calls[0]?.[0]);
  expect(saved).toHaveBeenCalledOnce();
});
