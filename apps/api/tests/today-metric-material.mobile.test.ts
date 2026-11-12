import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ os: 'ios', query: vi.fn(), listener: null as null | ((value: boolean) => void) }));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable', Platform: { get OS() { return state.os; } },
  AccessibilityInfo: { isReduceTransparencyEnabled: () => state.query(), addEventListener: (_: string, listener: (value: boolean) => void) => { state.listener = listener; return { remove() {} }; } },
  StyleSheet: { absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, flatten: (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
let FrostedMetric: React.ComponentType<Record<string, unknown>>, FrostedScreen: React.ComponentType<Record<string, unknown>>;
let TodayMetricBackdrop: React.ComponentType<Record<string, unknown>>, IOSBackdrop: React.ComponentType<Record<string, unknown>>;
beforeAll(async () => {
  ({ FrostedMetric, FrostedScreen } = await import(resolve(__dirname, '../../mobile/components/caloriebank/FrostedSurface.tsx')));
  ({ TodayMetricBackdrop } = await import(resolve(__dirname, '../../mobile/components/caloriebank/TodayMetricBackdrop.tsx')));
  ({ TodayMetricBackdrop: IOSBackdrop } = await import(resolve(__dirname, '../../mobile/components/caloriebank/TodayMetricBackdrop.ios.tsx')));
});
let tree: ReactTestRenderer;
const flatten = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
beforeEach(() => { state.os = 'ios'; state.query.mockImplementation(() => new Promise(() => {})); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });
afterEach(() => { if (tree) act(() => tree.unmount()); vi.unstubAllGlobals(); });
it('native iOS uses a clipped light UIKit material without an opaque overlay', () => {
  act(() => { tree = create(React.createElement(IOSBackdrop, { reduced: false, style: { borderRadius: 17, overflow: 'hidden' } })); });
  const blur = tree.root.find(node => String(node.type) === 'BlurView');
  expect(blur.props.tint).toBe('systemThinMaterialLight'); expect(blur.props.intensity).toBe(100);
  expect(flatten(blur.props.style)).toMatchObject({ borderRadius: 17, overflow: 'hidden' });
  expect(flatten(blur.props.style).backgroundColor).toBeUndefined();
  expect(blur.props.pointerEvents).toBe('none'); expect(blur.props.accessibilityElementsHidden).toBe(true);
});
it('native iOS reduced material is opaque and does not mount a blur view', () => {
  act(() => { tree = create(React.createElement(IOSBackdrop, { reduced: true, style: {} })); });
  expect(tree.root.findAll(node => String(node.type) === 'BlurView')).toHaveLength(0);
  expect(flatten(tree.root.find(node => String(node.type) === 'View').props.style).backgroundColor).toBe('#FFFFFF');
});
it('Android fallback is opaque with no experimental blur', () => {
  state.os = 'android';
  act(() => { tree = create(React.createElement(TodayMetricBackdrop, { reduced: false, style: {} })); });
  const style = flatten(tree.root.find(node => String(node.type) === 'View').props.style);
  expect(style.backgroundColor).toBe('#FFFFFF'); expect(style.backdropFilter).toBeUndefined();
});
it('web approximation removes blur for reduced transparency', () => {
  state.os = 'web';
  act(() => { tree = create(React.createElement(TodayMetricBackdrop, { reduced: false, style: {} })); });
  expect(flatten(tree.root.find(node => String(node.type) === 'View').props.style).backdropFilter).toContain('blur');
  act(() => { tree.update(React.createElement(TodayMetricBackdrop, { reduced: true, style: {} })); });
  expect(flatten(tree.root.find(node => String(node.type) === 'View').props.style).backdropFilter).toBeUndefined();
  expect(flatten(tree.root.find(node => String(node.type) === 'View').props.style).backgroundColor).toBe('#FFFFFF');
});
it('metric shell preserves layout, children and semantics; shared preference controls its backdrop', async () => {
  const onLayout = vi.fn();
  await act(async () => { tree = create(React.createElement(FrostedScreen, {}, React.createElement(FrostedMetric, { testID: 'metric', accessibilityLabel: 'Steps today', onLayout, style: { padding: 10, borderRadius: 18, backgroundColor: '#FFFFFF' } }, '10,000'))); });
  const shell = tree.root.findAll(node => String(node.type) === 'View').find(node => node.props.testID === 'metric')!;
  expect(flatten(shell.props.style)).toMatchObject({ backgroundColor: 'transparent', zIndex: 0, padding: 10, borderRadius: 18 });
  expect(shell.props.accessibilityLabel).toBe('Steps today'); expect(shell.props.onLayout).toBe(onLayout);
  expect(tree.root.findByType(TodayMetricBackdrop).props.reduced).toBe(true);
  expect(tree.root.findByType(TodayMetricBackdrop).props.style.zIndex).toBe(-1);
  act(() => state.listener?.(false)); expect(tree.root.findByType(TodayMetricBackdrop).props.reduced).toBe(false);
  act(() => state.listener?.(true)); expect(tree.root.findByType(TodayMetricBackdrop).props.reduced).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('10,000');
});
