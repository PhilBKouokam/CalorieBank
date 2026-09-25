import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ discover: vi.fn(), select: vi.fn(), cancel: vi.fn() }));
vi.mock('react-native', () => ({ ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', View: 'View', Linking: { openURL: vi.fn() }, StyleSheet: { create: <T,>(x: T) => x } }));
vi.mock('@/lib/native-health', () => ({ nativeIntake: api }));
const source = (id = 'com.cronometer.android.gold') => ({ source: { namespace: 'android_package', id }, displayName: 'Cronometer' });
const discovery = (sources = [source()]) => ({ access: { state: 'available', granted: ['nutrition'], missing: [] }, sources, queryState: 'complete' });
let view: ReactTestRenderer;
const selected = vi.fn(async () => undefined);
async function mount() { const { AndroidFoodChoices } = await import(resolve(__dirname, '../../mobile/components/caloriebank/AndroidFoodChoices.tsx')); await act(async () => { view = create(React.createElement(AndroidFoodChoices, { onSelected: selected, onBusyChange: () => undefined })); }); }
async function choose() { await act(async () => { await view.root.findByProps({ accessibilityLabel: 'Choose Cronometer' }).props.onPress(); }); }
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); api.discover.mockResolvedValue(discovery()); api.select.mockResolvedValue('ready'); });
afterEach(async () => { if (view) await act(async () => view.unmount()); });
it('selects only the exact observed package and presents consumer choices', async () => {
  await mount(); await choose();
  expect(api.select).toHaveBeenCalledWith(source().source); expect(selected).toHaveBeenCalledOnce();
  expect(JSON.stringify(view.toJSON())).not.toMatch(/Find food trackers|Refresh selected tracker|Apple Health|Open Health Connect settings/);
});
it('rejects a same-label different package and never selects an unobserved tracker', async () => {
  api.discover.mockResolvedValue(discovery([source('other.writer')])); await mount(); await choose();
  expect(api.select).not.toHaveBeenCalled(); expect(JSON.stringify(view.toJSON())).toContain('No Cronometer calories were found');
});
it('recovers permission denial through the same choice', async () => {
  api.discover.mockResolvedValueOnce({ access: { state: 'permissions_missing', granted: [], missing: ['nutrition'] }, sources: [] });
  await mount(); await choose(); expect(api.select).not.toHaveBeenCalled();
  expect(JSON.stringify(view.toJSON())).toContain('Allow CalorieBank');
  await choose(); expect(selected).toHaveBeenCalledOnce();
});
it('keeps query failure distinct from a successful empty discovery and allows new evidence later', async () => {
  api.discover.mockResolvedValueOnce({ ...discovery([]), queryState: 'failed' }).mockResolvedValueOnce(discovery([]));
  await mount(); await choose(); expect(JSON.stringify(view.toJSON())).toContain('couldn’t check');
  await choose(); expect(JSON.stringify(view.toJSON())).toContain('No Cronometer calories');
  await choose(); expect(selected).toHaveBeenCalledOnce();
});
it('accepts a selected connected-empty result without inventing calories', async () => {
  api.select.mockResolvedValue('empty'); await mount(); await choose(); expect(selected).toHaveBeenCalledOnce();
});
it('discards discovery after unmount and cancels account-scoped native work', async () => {
  let resolve!: (value: ReturnType<typeof discovery>) => void;
  api.discover.mockReturnValue(new Promise((done) => { resolve = done; }));
  await mount(); await choose(); await act(async () => view.unmount());
  await act(async () => resolve(discovery())); expect(api.select).not.toHaveBeenCalled(); expect(api.cancel).toHaveBeenCalled();
});
it('keeps trackers visible before permission and offers setup only after an explicit choice', async () => {
  api.discover.mockResolvedValue({ access: { state: 'setup_required', granted: [], missing: ['nutrition'] }, sources: [] });
  await mount();
  expect(api.discover).not.toHaveBeenCalled();
  expect(JSON.stringify(view.toJSON())).toContain('Cronometer');
  expect(JSON.stringify(view.toJSON())).not.toContain('Set up Health Connect');
  await choose();
  expect(JSON.stringify(view.toJSON())).toContain('Set up Health Connect');
  expect(api.select).not.toHaveBeenCalled();
});
