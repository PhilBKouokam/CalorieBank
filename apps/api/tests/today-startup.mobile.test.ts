import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  fetch: vi.fn(), status: 'ready', running: false,
  activity: null as null | ((running: boolean) => void),
  completion: null as null | ((result: { detail: string | null }) => void),
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }), useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]), Link: 'Link' }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('react-native', () => ({ Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl', ActivityIndicator: 'ActivityIndicator',
  Modal: () => null, useWindowDimensions: () => ({ fontScale: 1 }), StyleSheet: { create: <T,>(value: T) => value } }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('../../mobile/lib/lifecycle/account-lifecycle', () => ({
  isAccountLifecycleRunning: () => h.running,
  subscribeToAccountLifecycleActivity: (listener: typeof h.activity) => { h.activity = listener; listener!(h.running); return () => {}; },
  subscribeToAccountLifecycle: (listener: typeof h.completion) => { h.completion = listener; return () => {}; },
  runAccountLifecycle: vi.fn(),
}));
vi.mock('../../mobile/lib/api/client', () => ({
  getApiBaseUrl: () => 'https://fixture.invalid', fetchToday: h.fetch,
  fetchProviderSelection: async () => ({ expenditure: { selected: true, status: 'ready', displayName: 'Fitbit' }, intake: { selected: true, status: h.status, displayName: 'Cronometer' } }),
  fetchGoalConfiguration: async () => ({ goalMode: 'maintain' }), fetchPlannedTreat: async () => ({ status: 'no_plan' }),
  fetchBankSummary: async () => ({ openingBankStatus: 'initialized', availableBankCalories: 0, recoveryCalories: 0 }),
  fetchOnboardingStatus: async () => ({ completed: true, preparation: { history: 'complete' } }),
  fetchDashboardPreferences: async () => ({ showTodaySoFar: true }),
}));
let screen: ReactTestRenderer;
const output = () => screen.root.findAll(node => String(node.type) === 'Text').map(node =>
  node.children.filter(child => typeof child === 'string').join('')).join('\n');
const model = (calories: number | null = null) => ({ date: new Date().toISOString().slice(0, 10), timezone: 'UTC',
  burned: { adjusted: null, raw: null, status: 'unavailable' }, eaten: { calories, status: calories === null ? 'unavailable' : 'ready', source: calories === null ? null : 'Cronometer' },
  steps: {}, workouts: { items: [] } });
afterEach(async () => { if (screen) await act(async () => screen.unmount()); vi.useRealTimers(); });
async function mount() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { default: Today } = await import(resolve(__dirname, '../../mobile/app/(tabs)/today.tsx'));
  await act(async () => { screen = create(React.createElement(Today)); });
}
describe('rendered Today startup', () => {
  it('shows loading through slow initial reads, then awaiting data without connection recovery', async () => {
    h.status = 'ready'; h.running = true;
    let finish!: (value: ReturnType<typeof model>) => void;
    h.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await mount(); expect(output()).toContain('Loading today');
    expect(output()).not.toMatch(/Not connected|Review Health Connections|couldn’t update/);
    await act(async () => finish(model()));
    expect(output()).toContain('Loading…'); expect(output()).not.toContain('Review Health Connections');
    h.fetch.mockResolvedValue(model()); h.running = false;
    await act(async () => { h.activity!(false); h.completion!({ detail: null }); });
    expect(output()).toContain('No intake today'); expect(output()).not.toContain('Review Health Connections');
  });
  it('retains confirmed same-day calories during loading and temporary failure', async () => {
    h.status = 'ready'; h.running = false; h.fetch.mockResolvedValue(model(2498)); await mount();
    await act(async () => h.activity!(true)); expect(output()).toContain('2,498');
    h.fetch.mockRejectedValue(new Error('offline'));
    await act(async () => { h.activity!(false); h.completion!({ detail: 'CalorieBank couldn’t update. Try again.' }); });
    expect(output()).toContain('2,498'); expect(output()).not.toContain('Review Health Connections');
    await act(async () => h.activity!(true)); expect(output()).not.toContain('couldn’t update');
  });
  it('shows connection recovery for a confirmed revoked source after loading completes', async () => {
    h.status = 'needs_attention'; h.running = false; h.fetch.mockResolvedValue(model()); await mount();
    expect(output()).toContain('Review Health Connections');
  });
  it('does not carry yesterday into a new date and reports a completed failed fetch without claiming disconnection', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-23T23:59:00Z'));
    h.status = 'ready'; h.running = false; h.fetch.mockResolvedValue(model(2498)); await mount();
    expect(output()).toContain('2,498');
    vi.setSystemTime(new Date('2026-09-24T00:01:00Z'));
    await act(async () => h.activity!(true));
    expect(output()).not.toContain('2,498'); expect(output()).toContain('Loading today');
    h.fetch.mockRejectedValue(new Error('offline'));
    await act(async () => { h.activity!(false); h.completion!({ detail: 'CalorieBank couldn’t update. Try again.' }); });
    expect(output()).not.toMatch(/2,498|Not connected|Review Health Connections|Loading today/);
    expect(output()).toContain('Try again');
    h.fetch.mockResolvedValue(model(125));
    await act(async () => h.completion!({ detail: null }));
    expect(output()).toContain('125');
  });
});
