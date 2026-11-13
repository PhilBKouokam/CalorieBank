import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  useUser: vi.fn(), useClerk: vi.fn(), signOut: vi.fn(), detach: vi.fn(),
  push: vi.fn(), replace: vi.fn(), os: 'ios',
}));
vi.mock('@clerk/expo', () => ({ useUser: h.useUser, useClerk: h.useClerk }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: h.push, replace: h.replace }) }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('react-native', () => ({
  Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Platform: { get OS() { return h.os; } }, StyleSheet: { create: <T,>(value: T) => value, hairlineWidth: 1 },
}));
vi.mock('../../mobile/components/caloriebank/FrostedSurface', () => ({ FrostedView: 'View', FrostedScreen: 'SafeAreaView' }));
vi.mock('../../mobile/lib/health-connect/capabilities', () => ({ healthConnectQualificationEnabled: () => false }));
vi.mock('../../mobile/lib/notifications/morning-bank-update', () => ({ detachMorningBankUpdateDevice: h.detach }));
vi.mock('expo-web-browser', () => ({ openBrowserAsync: vi.fn() }));
let screen: ReactTestRenderer | undefined;
let Settings: React.ComponentType;
const account = (email: string | null) => ({
  isLoaded: true, isSignedIn: true,
  user: { primaryEmailAddress: email ? { emailAddress: email } : null },
});
const output = () => screen!.root.findAll(node => String(node.type) === 'Text')
  .map(node => node.children.filter(child => typeof child === 'string').join('')).join('\n');
async function render() {
  await act(async () => { screen = create(React.createElement(Settings)); });
}
async function rerender() {
  await act(async () => { screen!.update(React.createElement(Settings)); });
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubEnv('EXPO_PUBLIC_AUTH_MODE', 'clerk');
  vi.clearAllMocks();
  h.os = 'ios';
  h.useUser.mockReturnValue(account('current@example.test'));
  h.useClerk.mockReturnValue({ signOut: h.signOut });
  h.detach.mockResolvedValue(undefined); h.signOut.mockResolvedValue(undefined);
  ({ default: Settings } = await import(resolve(__dirname, '../../mobile/app/(tabs)/settings.tsx')));
});
afterEach(async () => {
  if (screen) await act(async () => screen!.unmount());
  screen = undefined; vi.unstubAllEnvs();
});
it.each(['ios', 'android'])('shows only the current Clerk primary email in a non-editable, wrapping account row on %s', async (os) => {
  h.os = os;
  h.useUser.mockReturnValue({ ...account('current@example.test'), user: {
    primaryEmailAddress: { emailAddress: 'current@example.test' },
    emailAddresses: [{ emailAddress: 'secondary@example.test' }],
  } });
  await render();
  expect(output()).toContain('Email address\ncurrent@example.test');
  expect(output()).not.toContain('secondary@example.test');
  const email = screen!.root.find(node => String(node.type) === 'Text' && node.children.includes('current@example.test'));
  expect(email.props.selectable).toBe(true);
  expect(email.props.numberOfLines).toBeUndefined();
  expect(email.props.style.flexShrink).toBe(1);
  expect(screen!.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
});
it('replaces the email on an account switch and hides stale identity during loading and sign-out', async () => {
  await render(); expect(output()).toContain('current@example.test');
  h.useUser.mockReturnValue({ ...account('current@example.test'), isLoaded: false });
  await rerender(); expect(output()).toContain('Loading account…'); expect(output()).not.toContain('current@example.test');
  h.useUser.mockReturnValue(account('next@example.test'));
  await rerender(); expect(output()).toContain('next@example.test'); expect(output()).not.toContain('current@example.test');
  h.useUser.mockReturnValue({ ...account('next@example.test'), isSignedIn: false });
  await rerender(); expect(output()).toContain('Not signed in'); expect(output()).not.toContain('next@example.test');
});
it('shows an honest missing-email state without substituting a secondary or provider address', async () => {
  h.useUser.mockReturnValue(account(null)); await render();
  expect(output()).toContain('Email unavailable');
});
it('renders local development settings without requiring a Clerk provider or a fabricated email', async () => {
  vi.stubEnv('EXPO_PUBLIC_AUTH_MODE', 'development'); await render();
  expect(h.useUser).not.toHaveBeenCalled(); expect(h.useClerk).not.toHaveBeenCalled();
  expect(output()).not.toContain('Email address'); expect(output()).toContain('Health Connections');
});
it('preserves device detach before sign-out and prevents duplicate sign-out taps', async () => {
  let finish!: () => void;
  h.detach.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  await render();
  const button = screen!.root.find(node => String(node.type) === 'Pressable' && node.props.accessibilityLabel === 'Sign Out');
  await act(async () => { button.props.onPress(); button.props.onPress(); });
  expect(h.detach).toHaveBeenCalledTimes(1); expect(h.signOut).not.toHaveBeenCalled();
  await act(async () => { finish(); });
  expect(h.signOut).toHaveBeenCalledTimes(1); expect(h.replace).toHaveBeenCalledExactlyOnceWith('/sign-in');
});
it('retains sign-out error recovery and the existing delete-account route', async () => {
  h.detach.mockRejectedValueOnce(new Error('synthetic detach failure'));
  await render();
  const button = screen!.root.find(node => String(node.type) === 'Pressable' && node.props.accessibilityLabel === 'Sign Out');
  await act(async () => button.props.onPress());
  expect(output()).toContain('We couldn’t finish signing you out. Please try again.');
  expect(h.signOut).not.toHaveBeenCalled(); expect(h.replace).not.toHaveBeenCalled();
  await act(async () => screen!.root.find(node => String(node.type) === 'Pressable' && node.props.accessibilityLabel === 'Delete Account').props.onPress());
  expect(h.push).toHaveBeenCalledExactlyOnceWith('/delete-account');
});
