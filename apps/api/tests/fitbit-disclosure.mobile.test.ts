import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../mobile/components/caloriebank/ScaleAwareText', () => ({ Text: 'Text' }));
vi.mock('../../mobile/components/caloriebank/PrivacyPolicyRow', () => ({ PrivacyPolicyRow: 'PrivacyPolicyRow' }));
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
async function render(onContinue: () => Promise<void> = vi.fn(async () => undefined), onCancel = vi.fn()) {
  const { FitbitConnectionDisclosure } = await import(resolve(__dirname, '../../mobile/components/caloriebank/FitbitConnectionDisclosure.tsx')) as { FitbitConnectionDisclosure: React.ComponentType<{ onContinue: () => Promise<void>; onCancel: () => void }> };
  let view!: ReactTestRenderer;
  await act(async () => { view = create(React.createElement(FitbitConnectionDisclosure, { onContinue, onCancel })); });
  return { view, onContinue, onCancel };
}
it('discloses access, purpose, server storage and sharing before any authorization request', async () => {
  const { view, onContinue } = await render();
  const output = JSON.stringify(view.toJSON());
  for (const copy of ['calorie burn, steps and workouts', 'bank and history', 'our servers', 'service providers', 'notification services', 'advertising', 'PrivacyPolicyRow']) expect(output).toContain(copy);
  expect(onContinue).not.toHaveBeenCalled();
  expect(output).toContain('ScrollView');
  expect(output).not.toContain('numberOfLines');
  await act(async () => view.unmount());
});
it('cancel leaves authorization unstarted', async () => {
  const { view, onContinue, onCancel } = await render();
  await act(async () => view.root.findAllByProps({ accessibilityRole: 'button' })[1]!.props.onPress());
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onContinue).not.toHaveBeenCalled();
  await act(async () => view.unmount());
});
it('continuation starts once even with repeated taps before rerender and disables actions while pending', async () => {
  let finish!: () => void;
  const onContinue = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const { view } = await render(onContinue);
  const press = view.root.findAllByProps({ accessibilityRole: 'button' })[0]!.props.onPress;
  await act(async () => { press(); press(); });
  expect(onContinue).toHaveBeenCalledOnce();
  for (const action of view.root.findAllByProps({ accessibilityRole: 'button' })) expect(action.props.disabled).toBe(true);
  await act(async () => finish());
  for (const action of view.root.findAllByProps({ accessibilityRole: 'button' })) expect(action.props.disabled).toBe(false);
  await act(async () => view.unmount());
});
it('onboarding and all Health Connections Fitbit actions request the shared disclosure first', () => {
  const onboarding = readFileSync(resolve(__dirname, '../../mobile/app/(onboarding)/onboarding.tsx'), 'utf8');
  const integrations = readFileSync(resolve(__dirname, '../../mobile/app/(settings)/integrations.tsx'), 'utf8');
  expect(onboarding).toContain('if (fitbitDisclosure) return <FitbitConnectionDisclosure');
  expect(onboarding).toContain('onPress={() => setFitbitDisclosure(true)}');
  expect(onboarding).not.toContain('onPress={() => void connectFitbit()}');
  expect(integrations).toContain("onFitbit={() => setFitbitDisclosure('connect')}");
  expect(integrations.match(/onReconnect=\{\(name\) => name === 'Fitbit' \? setFitbitDisclosure\('reconnect'\)/g)).toHaveLength(2);
  expect(integrations).not.toContain('onReconnect={(name) => void reconnectService(name)}');
});
