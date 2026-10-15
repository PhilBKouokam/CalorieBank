import { resolve } from 'node:path';
import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { IntakeAdjustmentState, ManualIntakeState } from '@caloriebank/schemas';

const native = vi.hoisted(() => ({ scale: 1, width: 390, textMounts: 0 }));
const api = vi.hoisted(() => ({ save: vi.fn(), saveManual: vi.fn() }));
vi.mock('react-native', () => ({
  Text: function NativeText(props: Record<string, unknown>) {
    useEffect(() => { native.textMounts++; }, []);
    return React.createElement('Text', props);
  },
  TextInput: 'TextInput', Pressable: 'Pressable', View: 'View', ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  useWindowDimensions: () => ({ fontScale: native.scale, width: native.width, height: 800, scale: 3 }),
}));
vi.mock('../../mobile/components/caloriebank/KeyboardSafeScrollView', () => ({ KeyboardSafeScrollView: 'ScrollView' }));
vi.mock('../../mobile/lib/api/client', () => ({ saveIntakeAdjustment: api.save, saveManualIntake: api.saveManual, ApiHttpError: class extends Error {} }));

let view: ReactTestRenderer;
const state: IntakeAdjustmentState = { localDate: '2026-10-13', revision: 0, selectionRevision: null, manualRevision: 0, source: 'Cronometer', baseCalories: 1535, calories: 1535, adjustment: null };
const manual: ManualIntakeState = { selected: true, selectionEnabled: true, revision: 0, selectionRevision: null, localDate: state.localDate, estimate: null };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); Object.assign(native, { scale: 1, width: 390, textMounts: 0 }); vi.clearAllMocks(); });
afterEach(async () => { if (view) await act(async () => view.unmount()); });

it('remeasures nested text on both size transitions without changing accessibility or native scaling', async () => {
  const { FontScaleProvider, Text } = await import(resolve(__dirname, '../../mobile/components/caloriebank/ScaleAwareText.tsx'));
  const tree = () => React.createElement(FontScaleProvider, null, React.createElement(Text, { accessibilityLabel: 'You banked 100 kcal', style: { fontSize: 16 } }, 'You banked ', React.createElement(Text, { style: { fontWeight: '800' } }, '100 kcal')));
  await act(async () => { view = create(tree()); });
  const initial = native.textMounts;
  native.width = 320;
  await act(async () => view.update(tree()));
  expect(native.textMounts).toBe(initial);
  for (const scale of [3.2, 1]) {
    const previous = native.textMounts; native.scale = scale;
    await act(async () => view.update(tree()));
    expect(native.textMounts).toBeGreaterThan(previous);
    const paragraph = view.root.findAll(node => String(node.type) === 'Text')[0]!;
    expect(paragraph.props.accessibilityLabel).toBe('You banked 100 kcal');
    expect(paragraph.props.allowFontScaling).toBeUndefined();
    expect(paragraph.props.maxFontSizeMultiplier).toBeUndefined();
    expect(paragraph.props.style.fontSize).toBe(16);
  }
});

it.each(['add', 'replace', 'usual'] as const)('keeps the mounted route, input and unsaved %s draft through larger text and back', async (mode) => {
  const { FontScaleProvider } = await import(resolve(__dirname, '../../mobile/components/caloriebank/ScaleAwareText.tsx'));
  const { IntakeAdjustmentEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/IntakeAdjustmentEditor.tsx'));
  const { ManualEstimateEditor } = await import(resolve(__dirname, '../../mobile/components/caloriebank/ManualEstimateEditor.tsx'));
  let routeMounts = 0;
  const saved = vi.fn(), cancel = vi.fn();
  function Route() {
    useEffect(() => { routeMounts++; }, []);
    return mode === 'usual'
      ? React.createElement(ManualEstimateEditor, { state: manual, mode: 'usual', onSaved: saved, onCancel: cancel })
      : React.createElement(IntakeAdjustmentEditor, { state: { ...state, adjustment: mode === 'replace' ? { mode: 'replace', calories: 2000 } : null }, onSaved: saved, onCancel: cancel });
  }
  const route = React.createElement(Route);
  const tree = () => React.createElement(FontScaleProvider, null, route);
  await act(async () => { view = create(tree()); });
  const input = view.root.find(node => String(node.type) === 'TextInput');
  const scroll = view.root.find(node => String(node.type) === 'ScrollView');
  await act(async () => input.props.onChangeText('2345'));
  for (const scale of [3.2, 1]) {
    native.scale = scale;
    await act(async () => view.update(tree()));
    expect(view.root.find(node => String(node.type) === 'TextInput')).toBe(input);
    expect(view.root.find(node => String(node.type) === 'ScrollView')).toBe(scroll);
    expect(input.props.value).toBe('2345');
    expect(routeMounts).toBe(1);
    expect(JSON.stringify(view.toJSON())).toContain('Save');
  }
  expect(api.save).not.toHaveBeenCalled(); expect(api.saveManual).not.toHaveBeenCalled();
  expect(saved).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
});
