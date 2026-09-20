import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ os: 'android', open: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: { get OS() { return mocks.os; } }, Text: 'Text', View: 'View',
}));
vi.mock('expo-web-browser', () => ({ openBrowserAsync: mocks.open }));
vi.mock('../../mobile/components/caloriebank/SettingsRow', () => ({ SettingsRow: 'SettingsRow' }));

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.os = 'android'; mocks.open.mockReset(); mocks.open.mockResolvedValue({ type: 'opened' });
});
async function render() {
  const { PrivacyPolicyRow } = await import(resolve(__dirname, '../../mobile/components/caloriebank/PrivacyPolicyRow.tsx')) as { PrivacyPolicyRow: React.ComponentType };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(React.createElement(PrivacyPolicyRow)); });
  return view;
}
it('opens the public HTTPS privacy page from Android Settings', async () => {
  const view = await render();
  await act(async () => view.root.findByProps({ title: 'Privacy Policy' }).props.onPress());
  expect(mocks.open).toHaveBeenCalledExactlyOnceWith('https://caloriebank.philbk.dev/privacy');
  expect(view.root.findByProps({ title: 'Privacy Policy' }).props.disabled).toBe(false);
  await act(async () => view.unmount());
});
it('offers a recoverable failure and clears it after retry', async () => {
  mocks.open.mockRejectedValueOnce(new Error('no browser'));
  const view = await render();
  await act(async () => view.root.findByProps({ title: 'Privacy Policy' }).props.onPress());
  expect(JSON.stringify(view.toJSON())).toContain('Please try again.');
  await act(async () => view.root.findByProps({ title: 'Privacy Policy' }).props.onPress());
  expect(JSON.stringify(view.toJSON())).not.toContain('Please try again.');
  expect(mocks.open).toHaveBeenCalledTimes(2);
  await act(async () => view.unmount());
});
it('does not change the iOS Settings presentation', async () => {
  mocks.os = 'ios';
  const view = await render();
  expect(view.toJSON()).toBeNull();
  expect(mocks.open).not.toHaveBeenCalled();
  await act(async () => view.unmount());
});
