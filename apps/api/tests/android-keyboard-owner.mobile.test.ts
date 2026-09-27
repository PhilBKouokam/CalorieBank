import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { KeyboardGeometry } from '../../mobile/lib/keyboard/geometry';
const native = vi.hoisted(() => ({ measure: vi.fn(), watch: vi.fn(), unwatch: vi.fn(), remove: vi.fn(), scrollTo: vi.fn(), listener: (_event: { tag: number }) => {} }));
vi.mock('expo', () => ({ requireNativeModule: () => ({ ...native, addListener: (_event: string, listener: typeof native.listener) => { native.listener = listener; return { remove: native.remove }; } }) }));
vi.mock('react-native', () => ({ findNodeHandle: (view: { tag: number } | null) => view?.tag ?? null,
  ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: <T,>(x: T) => x } }));
let view: ReactTestRenderer;
const geometry: KeyboardGeometry = { outerTop: 195, outerBottom: 1510, viewportTop: 195, viewportBottom: 1510, keyboardTop: 928, focusTop: 1117, focusBottom: 1243, scrollY: 515 };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); native.measure.mockResolvedValue(geometry); });
afterEach(async () => { if (view) await act(async () => view.unmount()); });
async function mount() { const { AndroidKeyboardSafeScrollView } = await import(resolve(__dirname, '../../mobile/components/caloriebank/AndroidKeyboardSafeScrollView.tsx')); await act(async () => { view = create(React.createElement(AndroidKeyboardSafeScrollView), { createNodeMock: el => el.type === 'View' ? { tag: 10 } : { tag: 20, scrollTo: native.scrollTo } }); }); }
it('shrinks only after measured overlap and reveals focus after the viewport layout, not a timer', async () => {
  await mount(); expect(native.watch).toHaveBeenCalledWith(10);
  await act(async () => native.listener({ tag: 10 }));
  let scroll = view.root.find(node => String(node.type) === 'ScrollView');
  expect(scroll.props.style[1].marginBottom).toBe(582);
  expect(native.scrollTo).not.toHaveBeenCalled();
  native.measure.mockResolvedValue({ ...geometry, viewportBottom: 928 });
  await act(async () => scroll.props.onLayout({ nativeEvent: {} }));
  expect(native.scrollTo).toHaveBeenCalledWith({ y: 830, animated: false });
  native.measure.mockResolvedValue({ ...geometry, keyboardTop: null });
  await act(async () => native.listener({ tag: 10 }));
  scroll = view.root.find(node => String(node.type) === 'ScrollView');
  expect(scroll.props.style[1].marginBottom).toBe(0);
  expect(scroll.props.keyboardDismissMode).toBe('none');
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
});
it('ignores another owner and removes native subscriptions on navigation', async () => {
  await mount(); await act(async () => native.listener({ tag: 99 }));
  expect(native.measure).not.toHaveBeenCalled();
  await act(async () => view.unmount());
  expect(native.unwatch).toHaveBeenCalledWith(10); expect(native.remove).toHaveBeenCalledOnce();
});
it('does not apply a stale show measurement after dismissal or unmount', async () => {
  await mount();
  let complete: ((value: KeyboardGeometry) => void) | undefined;
  native.measure.mockImplementationOnce(() => new Promise<KeyboardGeometry>(resolve => { complete = resolve; }));
  await act(async () => native.listener({ tag: 10 }));
  native.measure.mockResolvedValue({ ...geometry, keyboardTop: null });
  await act(async () => native.listener({ tag: 10 }));
  await act(async () => complete?.(geometry));
  expect(view.root.find(node => String(node.type) === 'ScrollView').props.style[1].marginBottom).toBe(0);
  expect(native.scrollTo).not.toHaveBeenCalled();
});
