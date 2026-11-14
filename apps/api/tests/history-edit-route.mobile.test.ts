import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ focused: true, params: {} as { localDate?: string | string[] }, current: vi.fn(), history: vi.fn(), back: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: h.back }), useLocalSearchParams: () => h.params, useFocusEffect: (callback: () => void) => React.useEffect(() => h.focused ? callback() : undefined, [callback, h.focused]) }));
vi.mock('react-native', () => ({ Pressable: 'Pressable', View: 'View', Text: 'Text', StyleSheet: { create: <T,>(x: T) => x } }));
vi.mock('../../mobile/components/caloriebank/FrostedSurface', () => ({ FrostedScreen: 'Screen' }));
vi.mock('../../mobile/components/caloriebank/IntakeAdjustmentEditor', () => ({ IntakeAdjustmentEditor: 'Editor' }));
vi.mock('../../mobile/lib/api/client', () => ({ fetchIntakeAdjustment: h.current, fetchHistoricalIntakeAdjustment: h.history, ApiHttpError: class extends Error {} }));
let view: ReactTestRenderer;
const state = { localDate: '2026-11-12', source: 'Cronometer', revision: 0 };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); h.focused = true; h.params = {}; h.current.mockResolvedValue(state); h.history.mockResolvedValue(state); });
afterEach(async () => { if (view) await act(async () => view.unmount()); });
async function mount() {
  const { default: Screen } = await import(resolve(__dirname, '../../mobile/app/(settings)/edit-calories.tsx'));
  await act(async () => { view = create(React.createElement(Screen)); });
}
it('loads the requested historical date and returns to History after save', async () => {
  h.params = { localDate: state.localDate }; await mount();
  expect(h.history).toHaveBeenCalledExactlyOnceWith(state.localDate); expect(h.current).not.toHaveBeenCalled();
  const editor = view.root.find(node => String(node.type) === 'Editor'); expect(editor.props.historical).toBe(true);
  await act(async () => editor.props.onSaved(state)); expect(h.back).toHaveBeenCalledOnce();
});
it('keeps Today on its existing read/save route', async () => {
  await mount(); expect(h.current).toHaveBeenCalledOnce(); expect(h.history).not.toHaveBeenCalled();
  expect(view.root.find(node => String(node.type) === 'Editor').props.historical).toBe(false);
});
it('fails closed on invalid date params instead of opening Today', async () => {
  h.params = { localDate: ['2026-11-12', '2026-11-11'] }; await mount();
  expect(h.current).not.toHaveBeenCalled(); expect(h.history).not.toHaveBeenCalled();
  expect(view.root.findAll(node => String(node.type) === 'Editor')).toHaveLength(0);
});
it('refuses a mismatched-date response', async () => {
  h.params = { localDate: '2026-11-11' }; await mount();
  expect(view.root.findAll(node => String(node.type) === 'Editor')).toHaveLength(0);
  expect(JSON.stringify(view.toJSON())).toContain('selected day changed');
});


it.each([false, true])('does not pop a newer route when a pending save completes (refocused=%s)', async refocused => {
  h.params = { localDate: state.localDate }; await mount();
  // Model the callback retained by the async editor save, not the latest render.
  const completePendingSave = view.root.find(node => String(node.type) === 'Editor').props.onSaved;
  const { default: Screen } = await import(resolve(__dirname, '../../mobile/app/(settings)/edit-calories.tsx'));
  await act(async () => { h.focused = false; view.update(React.createElement(Screen)); });
  if (refocused) await act(async () => { h.focused = true; view.update(React.createElement(Screen)); });
  await act(async () => completePendingSave(state));
  expect(h.back).not.toHaveBeenCalled();
  if (refocused) {
    await act(async () => view.root.find(node => String(node.type) === 'Editor').props.onSaved(state));
    expect(h.back).toHaveBeenCalledOnce();
  }
});

it('invalidates a pending completion when the dated route changes', async () => {
  h.params = { localDate: state.localDate }; await mount();
  const completePendingSave = view.root.find(node => String(node.type) === 'Editor').props.onSaved;
  const { default: Screen } = await import(resolve(__dirname, '../../mobile/app/(settings)/edit-calories.tsx'));
  h.history.mockResolvedValue({ ...state, localDate: '2026-11-11' });
  await act(async () => { h.params = { localDate: '2026-11-11' }; view.update(React.createElement(Screen)); });
  await act(async () => completePendingSave(state));
  expect(h.back).not.toHaveBeenCalled();
});
