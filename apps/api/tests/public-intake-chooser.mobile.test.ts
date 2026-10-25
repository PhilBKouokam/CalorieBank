import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ ActivityIndicator: 'ActivityIndicator', Linking: { openURL: vi.fn() }, Pressable: 'Pressable', View: 'View', Text: 'Text', StyleSheet: { create: <T,>(v: T) => v } }));
const fixture = vi.hoisted(() => ({ discover: vi.fn(), select: vi.fn(), cancel: vi.fn(), openSettings: vi.fn() }));
vi.mock('../../mobile/lib/native-health/index.ios.ts', () => ({ nativeIntake: fixture }));
vi.mock('../../mobile/components/caloriebank/ScaleAwareText', () => ({ Text: 'Text' }));
let view: ReactTestRenderer;
afterEach(async () => { if (view) await act(async () => view.unmount()); vi.clearAllMocks(); });
async function mount(allowed: boolean) {
  const { AndroidFoodChoices } = await import(resolve(__dirname, '../../mobile/components/caloriebank/AndroidFoodChoices.tsx'));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(async () => { view = create(React.createElement(AndroidFoodChoices, { allowFatSecret: allowed, onSelected: async () => {}, onBusyChange: () => {} })); });
}
it('uses an honest daily-estimate alternative when Health Connect is unavailable', async () => {
  fixture.discover.mockResolvedValue({ access: { state: 'unavailable', granted: [] } }); await mount(false);
  await act(async () => view.root.findByProps({ accessibilityLabel: 'Choose Cronometer' }).props.onPress());
  expect(JSON.stringify(view.toJSON())).toContain('daily estimate instead');
  expect(JSON.stringify(view.toJSON())).not.toContain('choose FatSecret');
});
it('keeps the existing private chooser message unchanged', async () => {
  fixture.discover.mockResolvedValue({ access: { state: 'unavailable', granted: [] } }); await mount(true);
  await act(async () => view.root.findByProps({ accessibilityLabel: 'Choose Cronometer' }).props.onPress());
  expect(JSON.stringify(view.toJSON())).toContain('choose FatSecret instead');
});
it('does not offer excluded native writers while retaining exact Cronometer choice', async () => {
  fixture.discover.mockResolvedValue({ access: { state: 'available', granted: ['nutrition'] }, queryState: 'complete', sources: [{ source: { id: 'com.fatsecret.android' }, displayName: 'FatSecret' }, { source: { id: 'com.cronometer.android.gold' }, displayName: 'Cronometer' }] });
  await mount(false);
  const button = view.root.findAll(node => String(node.type) === 'Pressable').find(node => node.findAll(node => String(node.type) === 'Text').some(text => text.children.join('') === 'Another app using Health Connect'))!;
  await act(async () => button.props.onPress());
  expect(JSON.stringify(view.toJSON())).not.toContain('FatSecret');
  expect(JSON.stringify(view.toJSON())).toContain('Cronometer');
});
