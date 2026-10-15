import React, { createContext, useEffect, useState } from 'react';
import { resolve } from 'node:path';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const Insets = createContext(null);

const native = vi.hoisted(() => ({ scale: 1, navigatorMounts: 0, barMounts: 0 }));
vi.mock('react-native', () => ({ Text: 'Text', useWindowDimensions: () => ({ fontScale: native.scale }) }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@react-navigation/bottom-tabs', () => ({ BottomTabBar: function Bar() {
  useEffect(() => { native.barMounts++; }, []);
  return React.createElement('TabBar');
} }));
vi.mock('expo-router', () => ({ Tabs: Object.assign(function Navigator({ tabBar }: { tabBar: (props: BottomTabBarProps) => React.ReactNode }) {
  const [route, setRoute] = useState('today');
  useEffect(() => { native.navigatorMounts++; }, []);
  // Match BottomTabView: invoke the render callback directly inside a Consumer.
  // Rendering the callback as a component hides invalid hook calls.
  return React.createElement('Navigator', { route, onNavigate: setRoute, renderBar: tabBar },
    React.createElement(Insets.Consumer, { children: () => tabBar({} as BottomTabBarProps) }));
}, { Screen: () => null }) }));

it('refreshes only the library tab bar while preserving navigator identity and selected route', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { FontScaleProvider } = await import(resolve(__dirname, '../../mobile/components/caloriebank/ScaleAwareText.tsx'));
  const { default: TabLayout } = await import(resolve(__dirname, '../../mobile/app/(tabs)/_layout.tsx'));
  Object.assign(native, { scale: 1, navigatorMounts: 0, barMounts: 0 });
  const tree = () => React.createElement(FontScaleProvider, null, React.createElement(TabLayout));
  let view!: ReturnType<typeof create>;
  await act(async () => { view = create(tree()); });
  try {
    expect(native.barMounts).toBe(1);
    expect(view.root.findAll(node => String(node.type) === 'TabBar')).toHaveLength(1);
    const navigator = view.root.find(node => String(node.type) === 'Navigator');
    await act(async () => navigator.props.onNavigate('settings'));
    for (const scale of [3.2, 1]) {
      native.scale = scale;
      await act(async () => view.update(tree()));
      expect(view.root.find(node => String(node.type) === 'Navigator')).toBe(navigator);
      expect(navigator.props.route).toBe('settings');
      expect(native.navigatorMounts).toBe(1);
    }
    expect(native.barMounts).toBe(3);
  } finally { await act(async () => view.unmount()); }
});


it('returns a component element from the callback without executing its hooks', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { default: TabLayout } = await import(resolve(__dirname, '../../mobile/app/(tabs)/_layout.tsx'));
  let view!: ReturnType<typeof create>;
  await act(async () => { view = create(React.createElement(TabLayout)); });
  try {
    const navigator = view.root.find(node => String(node.type) === 'Navigator');
    // No React render dispatcher exists here: a callback must only return an element.
    const props = {} as BottomTabBarProps;
    const element: unknown = navigator.props.renderBar(props);
    expect(React.isValidElement(element)).toBe(true);
    expect(native.barMounts).toBeGreaterThan(0);
  } finally { await act(async () => view.unmount()); }
});
