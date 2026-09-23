import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ManualIntakeState } from '@caloriebank/schemas';
const api = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('react-native', () => ({ KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: <T,>(x: T) => x } }));
vi.mock('../../mobile/lib/api/client', () => ({ saveManualIntake: api.save, ApiHttpError: class extends Error {} }));
const state: ManualIntakeState = {
  selected: true, selectionEnabled: true, revision: 4, selectionRevision: null, localDate: '2026-09-23',
  estimate: { value: { localDate: '2026-09-23', calories: 2900, source: 'manual_estimate', semanticKind: 'estimated_total_day_intake', evidenceVersion: 'manual:override:4', updatedAt: '2026-09-23T12:00:00Z' }, usualCalories: 2500, overridden: true },
};
let view: ReactTestRenderer;
const saved = vi.fn(), cancel = vi.fn();
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); api.save.mockResolvedValue({}); });
afterEach(async () => { if (view) await act(async () => view.unmount()); });
async function mount(mode: 'today' | 'usual' | 'select' = 'today') {
  const { ManualEstimateEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/ManualEstimateEditor.tsx'));
  await act(async () => { view = create(React.createElement(ManualEstimateEditor, { state, mode, onSaved: saved, onCancel: cancel })); });
}
async function press(label: string) {
  const button = view.root.findAll((node) => String(node.type) === 'Pressable').find((node) => node.findAll((child) => String(child.type) === 'Text').some((child) => child.children.join('') === label));
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.props.onPress());
}
it('prefills the authoritative value, selects text on focus and saves a date-scoped replacement', async () => {
  await mount();
  const input = view.root.find((node) => String(node.type) === 'TextInput');
  expect(input.props.value).toBe('2900'); expect(input.props.selectTextOnFocus).toBe(true);
  await act(async () => input.props.onChangeText('3100'));
  await press('Save');
  expect(api.save).toHaveBeenCalledWith({ operation: 'today', calories: 3100, expectedRevision: 4, localDate: '2026-09-23' });
  expect(saved).toHaveBeenCalledOnce();
});
it('cancels without a write and resets using an explicit operation', async () => {
  await mount(); await press('Cancel'); expect(api.save).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledOnce();
  await press('Use my usual estimate'); expect(api.save).toHaveBeenCalledWith({ operation: 'reset', expectedRevision: 4, localDate: '2026-09-23' });
});
it('retains failed offline input, does not claim saved, and retries the same revision', async () => {
  api.save.mockRejectedValueOnce(new Error('offline')); await mount();
  await act(async () => view.root.find((node) => String(node.type) === 'TextInput').props.onChangeText('3000'));
  await press('Save'); expect(saved).not.toHaveBeenCalled();
  expect(view.root.find((node) => String(node.type) === 'TextInput').props.value).toBe('3000');
  expect(JSON.stringify(view.toJSON())).toContain('Couldn’t save');
  await press('Save'); expect(saved).toHaveBeenCalledOnce();
});
it('allows explicit Today zero but rejects zero as a usual estimate', async () => {
  await mount(); await act(async () => view.root.find((node) => String(node.type) === 'TextInput').props.onChangeText('0')); await press('Save');
  expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ calories: 0 }));
  await act(async () => view.unmount()); api.save.mockClear(); await mount('usual');
  await act(async () => view.root.find((node) => String(node.type) === 'TextInput').props.onChangeText('0')); await press('Save');
  expect(api.save).not.toHaveBeenCalled();
});
