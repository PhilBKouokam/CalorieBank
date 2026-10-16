import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { KeyboardGeometry } from '../../mobile/lib/keyboard/geometry';
const native = vi.hoisted(() => ({ handlesReady: true, measure: vi.fn(), watch: vi.fn(), unwatch: vi.fn(), remove: vi.fn(), scrollTo: vi.fn(), listener: (_event: { tag: number; owner: string }) => {} }));
vi.mock('expo', () => ({ requireNativeModule: () => ({ ...native, addListener: (_event: string, listener: typeof native.listener) => { native.listener = listener; return { remove: native.remove }; } }) }));
vi.mock('react-native', () => ({ findNodeHandle: (view: { tag: number } | null) => native.handlesReady ? view?.tag ?? null : null,
  AppState: { addEventListener: () => ({ remove: vi.fn() }) }, ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: <T,>(x: T) => x } }));
let view: ReactTestRenderer;
const geometry: KeyboardGeometry = { outerTop: 195, outerBottom: 1510, viewportTop: 195, viewportBottom: 1510, keyboardTop: 928, focusTop: 1117, focusBottom: 1243, scrollY: 515 };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); native.handlesReady = true; native.watch.mockResolvedValue({ status: 'attached' }); native.measure.mockResolvedValue(geometry); });
afterEach(async () => { if (view) await act(async () => view.unmount()); });
async function mount(layoutBeforeEffect = false, readiness = { session: true, data: true }) {
  const { AndroidKeyboardSafeScrollView } = await import(resolve(__dirname, '../../mobile/components/caloriebank/AndroidKeyboardSafeScrollView.tsx'));
  const Gate = ({ session, data }: { session: boolean; data: boolean }) => session && data ? React.createElement(AndroidKeyboardSafeScrollView) : null;
  await act(async () => { view = create(React.createElement(Gate, readiness), { createNodeMock: el => {
    if (el.type === 'View') {
      if (layoutBeforeEffect) (el.props as { onLayout: () => void }).onLayout();
      return { tag: 10 };
    }
    return { tag: 20, scrollTo: native.scrollTo };
  } }); });
  if (!readiness.session || !readiness.data) {
    expect(native.watch).not.toHaveBeenCalled();
    await act(async () => view.update(React.createElement(Gate, { ...readiness, session: true })));
    if (!readiness.data) expect(native.watch).not.toHaveBeenCalled();
    await act(async () => view.update(React.createElement(Gate, { session: true, data: true })));
  }
}

it('shrinks only after measured overlap and reveals focus after the viewport layout, not a timer', async () => {
  await mount(); expect(native.watch).toHaveBeenCalledWith(10, expect.any(String));
  let scroll = view.root.find(node => String(node.type) === 'ScrollView');
  expect(scroll.props.style[1].marginBottom).toBe(582);
  expect(native.scrollTo).not.toHaveBeenCalled();
  native.measure.mockResolvedValue({ ...geometry, viewportBottom: 928 });
  await act(async () => scroll.props.onLayout({ nativeEvent: {} }));
  expect(native.scrollTo).toHaveBeenCalledWith({ y: 830, animated: false });
  native.measure.mockResolvedValue({ ...geometry, keyboardTop: null });
  await act(async () => native.listener({ tag: 10, owner: native.watch.mock.calls.at(-1)![1] }));
  scroll = view.root.find(node => String(node.type) === 'ScrollView');
  expect(scroll.props.style[1].marginBottom).toBe(0);
  expect(scroll.props.keyboardDismissMode).toBe('none');
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
});
it('ignores another owner and removes native subscriptions on navigation', async () => {
  await mount(); native.measure.mockClear(); await act(async () => native.listener({ tag: 99, owner: native.watch.mock.calls.at(-1)![1] }));
  expect(native.measure).not.toHaveBeenCalled();
  await act(async () => view.unmount());
  expect(native.unwatch).toHaveBeenCalledWith(10, expect.any(String)); expect(native.remove).toHaveBeenCalledOnce();
});
it('does not apply a stale show measurement after dismissal or unmount', async () => {
  await mount(); native.scrollTo.mockClear();
  let complete: ((value: KeyboardGeometry) => void) | undefined;
  native.measure.mockImplementationOnce(() => new Promise<KeyboardGeometry>(resolve => { complete = resolve; }));
  await act(async () => native.listener({ tag: 10, owner: native.watch.mock.calls.at(-1)![1] }));
  native.measure.mockResolvedValue({ ...geometry, keyboardTop: null });
  await act(async () => native.listener({ tag: 10, owner: native.watch.mock.calls.at(-1)![1] }));
  await act(async () => complete?.(geometry));
  expect(view.root.find(node => String(node.type) === 'ScrollView').props.style[1].marginBottom).toBe(0);
  expect(native.scrollTo).not.toHaveBeenCalled();
});

it.each([{ session: true, data: true }, { session: true, data: false }, { session: false, data: true }, { session: false, data: false }])(
  'recovers pending registration with readiness %j without treating it as attached', async readiness => {
    native.watch.mockResolvedValueOnce({ status: 'pending', reason: 'view_unavailable' });
    await mount(false, readiness);
    expect(native.measure).not.toHaveBeenCalled();
    const lifetime = native.watch.mock.calls[0]![1];
    // Fabric becomes available; the native attachment event arrives, even without another JS layout.
    await act(async () => native.listener({ tag: 10, owner: lifetime }));
    expect(view.root.find(node => String(node.type) === 'ScrollView').props.style[1].marginBottom).toBe(582);
    native.measure.mockResolvedValue({ ...geometry, viewportBottom: 928 });
    await act(async () => view.root.find(node => String(node.type) === 'ScrollView').props.onLayout({ nativeEvent: {} }));
    expect(native.watch).toHaveBeenLastCalledWith(10, lifetime);
  });
it('measures immediately after attachment with the keyboard already open', async () => {
  await mount();
  expect(native.measure).toHaveBeenCalledWith(10, 20, expect.any(String));
  expect(view.root.find(node => String(node.type) === 'ScrollView').props.style[1].marginBottom).toBe(582);
});
it('rejects a retired owner even when the native tag is reused after root recreation', async () => {
  await mount();
  const retired = native.watch.mock.calls[0]![1];
  await act(async () => view.unmount());
  await mount();
  native.measure.mockClear();
  await act(async () => native.listener({ tag: 10, owner: retired }));
  expect(native.measure).not.toHaveBeenCalled();
});

it('recovers when layout precedes the effect and native registration is initially pending', async () => {
  native.watch.mockResolvedValueOnce({ status: 'pending', reason: 'view_unavailable' });
  await mount(true);
  expect(native.measure).not.toHaveBeenCalled();
  const lifetime = native.watch.mock.calls[0]![1];
  await act(async () => native.listener({ tag: 10, owner: lifetime }));
  const reductionDp = view.root.find(node => String(node.type) === 'ScrollView').props.style[1].marginBottom;
  expect(reductionDp).toBe(582);
  // The same actual device geometry expressed in dp gives exactly 582 physical pixels.
  const density = 1.875;
  native.measure.mockResolvedValue({ ...geometry, outerTop: 195 / density, outerBottom: 1510 / density,
    viewportTop: 195 / density, viewportBottom: 1510 / density, keyboardTop: 928 / density });
  await act(async () => native.listener({ tag: 10, owner: lifetime }));
  expect(view.root.find(node => String(node.type) === 'ScrollView').props.style[1].marginBottom * density).toBeCloseTo(582);
});

it('recovers a missing JS tag and owns subsequent events and cleanup', async () => {
  native.handlesReady = false;
  await mount();
  expect(native.watch).not.toHaveBeenCalled();
  native.handlesReady = true;
  await act(async () => view.root.find(node => String(node.type) === 'View').props.onLayout());
  const lifetime = native.watch.mock.calls.at(-1)![1];
  native.measure.mockClear();
  await act(async () => native.listener({ tag: 10, owner: lifetime }));
  expect(native.measure).toHaveBeenCalledWith(10, 20, lifetime);
  await act(async () => view.unmount());
  expect(native.unwatch).toHaveBeenCalledWith(10, lifetime);
});
it('cannot apply an old measurement to the recreated root', async () => {
  await mount();
  let finish: ((value: KeyboardGeometry) => void) | undefined;
  native.measure.mockImplementationOnce(() => new Promise<KeyboardGeometry>(resolve => { finish = resolve; }));
  await act(async () => native.listener({ tag: 10, owner: native.watch.mock.calls.at(-1)![1] }));
  await act(async () => view.unmount());
  native.measure.mockResolvedValue({ ...geometry, keyboardTop: null });
  await mount();
  await act(async () => finish?.(geometry));
  expect(view.root.find(node => String(node.type) === 'ScrollView').props.style[1].marginBottom).toBe(0);
});
