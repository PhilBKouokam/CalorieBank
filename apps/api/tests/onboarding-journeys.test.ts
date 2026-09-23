import React, { type ComponentType } from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BankSummaryResponse, HealthConnectionOption, HealthConnectionsResponse, ProviderSelectionInput, ProviderSelectionResponse } from '@caloriebank/schemas';
import { deriveOnboardingStatus } from '../src/modules/onboarding/onboarding.repository';

const h = vi.hoisted(() => ({
  params: {} as Record<string, string>, os: 'ios', providers: null as ProviderSelectionResponse | null, goal: false, empty: false, fail: false, writers: true,
  pause: null as Promise<void> | null, healthUnavailable: false,
  targetChosen: false, manualEnabled: false, nativeRefresh: vi.fn(async () => 'ready'),
  router: { push: vi.fn(), replace: vi.fn() }, saves: [] as ProviderSelectionInput[],
}));
const data = () => h.providers!;
function snapshot() {
  return deriveOnboardingStatus({ welcomeCompleted: true, completed: false, providerSelection: structuredClone(data()), goalConfigured: h.goal,
    bankSummary: { openingBankStatus: 'waiting_for_opening_data', openingBankCalories: 0 } as BankSummaryResponse,
    preparation: { expenditure: 'complete', intake: 'complete', history: 'preparing' },
  });
}
function connect(provider: string) { data().connectedProviders.find((p) => p.provider === provider)!.status = 'connected'; }
function connections(): HealthConnectionsResponse {
  const option = (id: string, label: string, apple = false): HealthConnectionOption => ({ optionId: id, label, status: 'connected', transportLabel: apple && label !== 'Apple Health' ? 'Apple Health' : null, deviceManaged: apple, primaryAction: null });
  const burn = option(data().expenditure.authoritativeProvider, data().expenditure.displayName, data().expenditure.authoritativeProvider === 'apple_health');
  const apple = data().intake.writerBundleIdentifier ? option('apple_health', data().intake.writerDisplayName!, true) : null;
  const fat = option('fatsecret', 'FatSecret');
  const native = data().intake.nativeIntakeSource ? { ...option('health_connect', data().intake.displayName), transportLabel: 'Health Connect', deviceManaged: true } : null;
  const eaten = data().intake.authoritativeProvider === 'fatsecret' ? fat : data().intake.authoritativeProvider === 'health_connect' ? native : data().intake.authoritativeProvider === 'apple_health' ? apple : { ...option(data().intake.authoritativeProvider === 'manual_estimate' ? 'eaten-manual-estimate-v1' : 'future-source-v1', data().intake.displayName), status: 'available' as const };
  return {
    burned: { selected: data().expenditure.selected ? burn : null, alternatives: data().expenditure.selected ? [] : [option('google_health_fitbit', 'Fitbit')], canChange: !data().expenditure.selected, canAddSource: true },
    eaten: { selected: data().intake.selected ? eaten : null, alternatives: [apple, fat].filter((p): p is HealthConnectionOption => p !== null && p.optionId !== eaten?.optionId), canChange: true, canAddSource: true },
    connectedServices: [option('service-apple', 'Apple Health', true), fat, option('service-fitbit', 'Fitbit')],
  };
}
async function sync() {
  if (h.pause) { const pending = h.pause; h.pause = null; await pending; }
  if (h.fail) { h.fail = false; throw new Error('temporary retrieval failure'); }
  if (data().expenditure.selected) data().expenditure.status = h.empty ? 'unavailable' : 'ready';
  if (data().intake.selected) data().intake.status = h.empty ? 'unavailable' : 'ready';
  return { syncStatus: 'success' };
}
vi.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove() {} }) },
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator', KeyboardAvoidingView: 'KeyboardAvoidingView', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
  Platform: { get OS() { return h.os; } }, StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null,
  Linking: { openSettings: vi.fn() },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => ({ useRouter: () => h.router, useLocalSearchParams: () => ({ returnTo: 'onboarding', ...h.params }), useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, []) }));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: async (url: string) => { connect(url); return { type: 'success', url: 'caloriebank://integrations?fitbit=connected' }; } }));
vi.mock('../../mobile/lib/api/client', () => ({
  fetchManualIntake: async () => ({ selectionEnabled: h.manualEnabled, selected: data().intake.authoritativeProvider === 'manual_estimate', localDate: '2026-09-23', revision: 0, selectionRevision: null, estimate: null }),
  fetchDailyBankTarget: async () => ({ calories: 0, chosen: h.targetChosen }),
  saveDailyBankTarget: async (calories: number) => { h.targetChosen = true; return { calories, chosen: true }; },
  fetchOnboardingStatus: async () => snapshot(), fetchProviderSelection: async () => structuredClone(data()),
  fetchHealthConnections: async () => connections(),
  selectHealthConnectionRole: async (role: 'burned' | 'eaten', optionId: string) => {
    if (role === 'eaten') {
      data().intake.authoritativeProvider = optionId as 'fatsecret' | 'apple_health';
      data().intake.displayName = optionId === 'fatsecret' ? 'FatSecret' : data().intake.writerDisplayName!;
    }
    return connections();
  },
  ApiHttpError: class extends Error {}, disconnectFatSecret: vi.fn(), disconnectFitbit: vi.fn(),
  saveProviderSelection: async (input: ProviderSelectionInput) => {
    h.saves.push(input);
    if (input.selectionRole === 'burned') {
      data().expenditure = { ...data().expenditure, selected: true, authoritativeProvider: input.authoritativeExpenditureProvider, displayName: input.authoritativeExpenditureProvider === 'apple_health' ? 'Apple Health' : 'Fitbit' };
    } else {
      data().intake = { ...data().intake, selected: true, authoritativeProvider: input.authoritativeIntakeProvider, displayName: input.authoritativeIntakeProvider === 'fatsecret' ? 'FatSecret' : input.appleHealthIntakeWriter!.displayName,
        writerBundleIdentifier: input.appleHealthIntakeWriter?.bundleIdentifier ?? null, writerDisplayName: input.appleHealthIntakeWriter?.displayName ?? null };
    }
    return data();
  },
  startFatSecretAuthorization: async () => ({ authorizationUrl: 'fatsecret' }), startFitbitAuthorization: async () => ({ authorizationUrl: 'google_health_fitbit' }),
  syncFatSecret: sync, syncFitbit: sync, getApiRequestFailureKind: () => 'unknown', MOBILE_INTEGRATION_REDIRECT_URI: 'caloriebank://integrations',
  ProviderAuthorizationError: class extends Error {}, completeOnboarding: async () => {}, completeOnboardingWelcome: async () => {},
}));
vi.mock('@/lib/native-health', async (importOriginal) => {
  const ios = await importOriginal<typeof import('../../mobile/lib/native-health/index.ios')>();
  const android = await import('../../mobile/lib/native-health/index.android');
  return {
    get nativeIntake() { return h.os === 'android' ? { ...android.nativeIntake, refresh: h.nativeRefresh,
      discover: async () => ({ access: { state: 'available', granted: ['nutrition'], missing: [] }, sources: [
        { source: { namespace: 'android_package', id: 'com.cronometer.android.gold' }, displayName: 'Cronometer' },
        { source: { namespace: 'android_package', id: 'com.sbs.diet' }, displayName: 'MacroFactor' },
      ] }),
      select: async (source: { namespace: 'android_package'; id: string }) => {
        if (!data().connectedProviders.some((p) => p.provider === 'health_connect')) data().connectedProviders.push({ ...data().connectedProviders[0]!, provider: 'health_connect', displayName: 'Health Connect', status: 'connected' });
        data().intake = { ...data().intake, selected: true, authoritativeProvider: 'health_connect', displayName: source.id === 'com.sbs.diet' ? 'MacroFactor' : 'Cronometer', status: 'ready', nativeIntakeSource: source, selectionRevision: '2026-09-17T12:00:00.000Z' };
        return 'ready';
      }, access: async () => ({ state: 'permissions_missing', granted: [], missing: ['nutrition'] }) } : ios.nativeIntake; },
    get nativeHealthCapability() { return h.os === 'android' ? android.nativeHealthCapability : ios.nativeHealthCapability; },
    connectNativeHealth: (...args: Parameters<typeof ios.connectNativeHealth>) => (h.os === 'android' ? android : ios).connectNativeHealth(...args),
    getNativeHealthConnectionStatus: (...args: Parameters<typeof ios.getNativeHealthConnectionStatus>) => (h.os === 'android' ? android : ios).getNativeHealthConnectionStatus(...args),
    refreshNativeHealthForCurrentAccount: (...args: Parameters<typeof ios.refreshNativeHealthForCurrentAccount>) => (h.os === 'android' ? android : ios).refreshNativeHealthForCurrentAccount(...args),
    syncNativeHealthToday: (...args: Parameters<typeof ios.syncNativeHealthToday>) => (h.os === 'android' ? android : ios).syncNativeHealthToday(...args),
    getNativeHealthDiagnostics: (...args: Parameters<typeof ios.getNativeHealthDiagnostics>) => (h.os === 'android' ? android : ios).getNativeHealthDiagnostics(...args),
    discoverNativeIntakeWriters: (...args: Parameters<typeof ios.discoverNativeIntakeWriters>) => (h.os === 'android' ? android : ios).discoverNativeIntakeWriters(...args),
    resolveKnownFoodTracker: ios.resolveKnownFoodTracker,
  };
});
vi.mock('../../mobile/lib/healthkit/healthkit-connection', () => ({
  connectAppleHealth: async () => { connect('apple_health'); return 'connected'; },
  getAppleHealthConnectionStatus: async () => { if (h.healthUnavailable) throw new Error('Native access unavailable'); return data().connectedProviders.find((p) => p.provider === 'apple_health')?.status; },
  refreshAppleHealthForCurrentAccount: sync,
  syncAppleHealthToday: sync, getAppleHealthDiagnostics: async () => null,
}));
vi.mock('../../mobile/lib/healthkit/apple-health-intake-writers', async (original) => {
  const actual = await original<typeof import('../../mobile/lib/healthkit/apple-health-intake-writers')>();
  return { ...actual, discoverAppleHealthIntakeWriters: async () => h.writers ? ['Cronometer', 'MyFitnessPal', 'Lose It!', 'MacroFactor', 'Detected food app', 'FatSecret'].map((name) => ({ bundleIdentifier: name === 'Cronometer' ? 'CRONOMETER-GOLD' : name === 'FatSecret' ? 'com.fatsecret.caloriecounter' : `test.${name}`, displayName: name, sourceName: name, totalCalories: 1 })) : [] };
});
vi.mock('../../mobile/lib/onboarding/first-run-bootstrap', () => ({ runFirstRunBootstrap: async () => {} }));
vi.mock('../../mobile/lib/notifications/morning-bank-update', () => ({ enableMorningBankUpdate: async () => ({ permission: 'denied' }) }));
vi.mock('../../mobile/components/caloriebank/GoalConfigurationForm', () => ({ GoalConfigurationForm: ({ onSaved }: { onSaved: () => void }) => React.createElement('Pressable', { accessibilityLabel: 'Save goal', onPress: () => { h.goal = true; onSaved(); } }, 'Save goal') }));

let screen: ReactTestRenderer | undefined;
const text = (node: ReactTestInstance): string => node.children.map((child) => typeof child === 'string' ? child : text(child)).join(' ');
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
async function press(label: string) {
  if (label === 'Connect Apple Health') label = 'Connect Apple Watch';
  const button = screen!.root.findAll((node) => String(node.type) === 'Pressable' && (node.props.accessibilityLabel === label || text(node).trim() === label))[0];
  expect(button, `Missing button ${label}: ${text(screen!.root)}`).toBeDefined();
  expect(button!.props.disabled).not.toBe(true);
  await act(async () => { button!.props.onPress(); await settle(); });
}
async function mount() {
  // Load TSX through Vite; mobile TypeScript independently checks its implementation.
  const modulePath = resolve(__dirname, '../../mobile/app/(onboarding)/onboarding.tsx');
  const { default: Onboarding } = await import(modulePath) as { default: ComponentType };
  await act(async () => { screen = create(React.createElement(Onboarding)); await settle(); });
}
async function mountSettings() {
  const modulePath = resolve(__dirname, '../../mobile/app/(settings)/integrations.tsx');
  const { default: Settings } = await import(modulePath) as { default: ComponentType };
  await act(async () => { screen = create(React.createElement(Settings)); await settle(); });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, __DEV__: false });
  h.nativeRefresh.mockClear(); h.router.push.mockClear(); h.router.replace.mockClear();
  h.params = {}; h.os = 'ios'; h.goal = false; h.targetChosen = false; h.empty = false; h.fail = false; h.writers = true; h.saves = []; h.pause = null; h.healthUnavailable = false;
  h.manualEnabled = false;
  h.providers = {
    expenditure: { selected: false, authoritativeProvider: 'apple_health', displayName: 'Apple Health', status: 'unavailable', fallbackActive: false },
    activityContext: { authoritativeProvider: 'apple_health', displayName: 'Apple Health', status: 'unavailable', fallbackActive: false },
    intake: { selected: false, authoritativeProvider: 'apple_health', displayName: 'Apple Health', status: 'unavailable', writerBundleIdentifier: null, writerDisplayName: null },
    connectedProviders: ['apple_health', 'google_health_fitbit', 'fatsecret'].map((provider) => ({ provider, status: 'not_connected' })),
  } as ProviderSelectionResponse;
});
afterEach(async () => { if (screen) await act(async () => screen!.unmount()); screen = undefined; });

describe('actual onboarding component journeys', () => {
  for (const burn of ['Apple Health', 'Fitbit']) for (const food of ['FatSecret', 'Cronometer', 'MyFitnessPal', 'Lose It!', 'MacroFactor', 'Detected food app']) {
    it(`${burn} -> ${food} -> Back/Forward -> Goal -> Preparation -> remount`, async () => {
      await mount(); await press(`Connect ${burn}`);
      expect(text(screen!.root)).toContain('Where do you track your food?');
      expect(data().intake.selected).toBe(false);
      if (food === 'Detected food app') await press('Connect Another app using Apple Health');
      await press(`Connect ${food}`);
      expect(text(screen!.root)).toContain('Choose your goal');
      await press('Back'); expect(text(screen!.root)).toContain(food);
      await press('Continue'); await press('Save goal');
      expect(screen!.root.findByProps({ accessibilityLabel: 'Setup step 4 of 5' })).toBeDefined();
      expect(text(screen!.root)).toContain('How much would you like to bank each day?');
      expect(text(screen!.root)).not.toContain('Choose your goal');
      await press('Continue');
      expect(screen!.root.findByProps({ accessibilityLabel: 'Setup step 5 of 5' })).toBeDefined();
      expect(text(screen!.root)).toContain('Preparing your bank');
      expect(text(screen!.root)).toContain(food);
      expect(data().expenditure.displayName).toBe(burn);
      expect(h.saves.map((save) => save.selectionRole)).toEqual(['burned', 'eaten']);
      await act(async () => screen!.unmount()); await mount();
      expect(text(screen!.root)).toContain(food);
      expect(text(screen!.root)).not.toMatch(/calories from Choose a food tracker|Something went wrong/);
    });
  }
  it('no discovered food writer -> direct FatSecret alternative', async () => {
    h.writers = false; await mount(); await press('Connect Apple Health'); await press('Connect Cronometer');
    expect(text(screen!.root)).toContain('We haven’t found calories from Cronometer');
    await press('Connect FatSecret'); expect(text(screen!.root)).toContain('Choose your goal');
    expect(text(screen!.root)).not.toContain('We haven’t found calories from Cronometer');
  });
  it('connected/empty and failed refresh errors clear on Continue to Goal', async () => {
    h.empty = true; await mount(); await press('Connect Apple Health'); await press('Continue');
    h.fail = true; await press('Connect FatSecret'); expect(text(screen!.root)).toContain("couldn't refresh your food data");
    await press('Continue'); expect(text(screen!.root)).toContain('Choose your goal');
    expect(text(screen!.root)).not.toContain("couldn't refresh");
  });
  it('FatSecret -> Settings -> detected Apple Health tracker -> direct FatSecret, with burn unchanged', async () => {
    await mount(); await press('Connect Apple Health'); await press('Connect FatSecret');
    const burn = structuredClone(data().expenditure);
    await act(async () => screen!.unmount()); await mountSettings();
    await press('Add food source'); await press('Apple Health food tracker');
    const appleChoices = screen!.root.findAll(node => typeof node.type === 'function' && node.props.detail === 'via Apple Health').map(node => node.props.label);
    expect(appleChoices).toContain('Cronometer');
    expect(appleChoices).not.toContain('FatSecret');
    await press('Cronometer');
    expect(data().intake.authoritativeProvider).toBe('apple_health');
    expect(data().intake.writerDisplayName).toBe('Cronometer');
    await press('Manage sources for calories eaten'); await press('FatSecret');
    expect(data().intake.authoritativeProvider).toBe('fatsecret');
    expect(data().expenditure).toEqual(burn);
    await act(async () => screen!.unmount()); await mount();
    await press('Save goal'); await press('Continue'); expect(text(screen!.root)).toContain('FatSecret');
    expect(text(screen!.root)).not.toContain('Choose a food tracker');
  });
  it('repeated Edit Setup/Back/Continue and connections navigation do not mutate selections', async () => {
    await mount(); await press('Connect Fitbit'); await press('Connect Cronometer'); await press('Save goal'); await press('Continue');
    const selected = structuredClone(data());
    for (let i = 0; i < 3; i++) {
      await press('Edit setup'); await press('Back'); await press('Back'); await press('Continue'); await press('Continue'); await press('Save goal'); await press('Continue');
      expect(data()).toEqual(selected);
    }
    await press('Check connections'); expect(h.router.push).toHaveBeenCalledWith({ pathname: '/integrations', params: { returnTo: 'onboarding' } });
    await act(async () => screen!.unmount()); await mount();
    expect(text(screen!.root)).toContain('Cronometer'); expect(data()).toEqual(selected);
  });
  it('late preparation failure cannot overwrite Goal after Edit Setup', async () => {
    await mount(); await press('Connect Apple Health'); await press('Connect FatSecret');
    let reject!: (error: Error) => void;
    h.pause = new Promise<void>((_resolve, fail) => { reject = fail; });
    await press('Save goal'); await press('Continue'); await press('Edit setup');
    await act(async () => { reject(new Error('Apple Health failed')); await settle(); });
    expect(text(screen!.root)).toContain('Choose your goal');
    expect(text(screen!.root)).not.toMatch(/couldn.t refresh|Something went wrong|too long/);
  });
  it('Settings selects direct FatSecret even when native Apple Health lookup fails', async () => {
    await mount(); await press('Connect Fitbit'); await press('Connect Cronometer');
    const burn = structuredClone(data().expenditure);
    await act(async () => screen!.unmount()); h.healthUnavailable = true; await mountSettings();
    await press('Manage sources for calories eaten'); await press('FatSecret');
    expect(data().intake.authoritativeProvider).toBe('fatsecret');
    expect(data().expenditure).toEqual(burn);
    expect(text(screen!.root)).not.toMatch(/Refresh Apple Health and try again|couldn.t select FatSecret/i);
  });
});


describe('Android qualified direct-provider journeys', () => {
  it('returns a cold provider callback to canonical incomplete setup without selecting a role', async () => {
    h.os = 'android'; h.params = { fitbit: 'connected' }; connect('google_health_fitbit');
    const before = structuredClone(data()); await mountSettings();
    expect(h.router.replace).toHaveBeenCalledWith('/onboarding'); expect(data()).toEqual(before);
  });
  it('navigates backward through both source steps without changing authority', async () => {
    h.os = 'android'; await mount(); await press('Connect Fitbit'); await press('Continue');
    await press('Back'); expect(text(screen!.root)).toContain('Step  1');
    await press('Continue'); await press('Choose Cronometer'); await press('Continue');
    const before = structuredClone(data()); await press('Back'); expect(text(screen!.root)).toContain('Step  2');
    expect(data()).toEqual(before); expect(h.router.push).not.toHaveBeenCalled();
  });
  it('distinguishes a connected inventory from an unselected canonical burn role', async () => {
    h.os = 'android'; connect('google_health_fitbit'); await mountSettings();
    expect(text(screen!.root)).toContain('No source selected');
    expect(text(screen!.root)).toContain('Choose a connected source to use here.');
    expect(data().expenditure.selected).toBe(false);
  });
  it('renders canonical Fitbit and exact Cronometer authority independently of nutrition permission', async () => {
    h.os = 'android'; await mount(); await press('Connect Fitbit'); await press('Continue'); await press('Choose Cronometer');
    const before = structuredClone(data());
    await act(async () => screen!.unmount()); await mountSettings();
    expect(text(screen!.root)).toContain('Fitbit');
    expect(text(screen!.root)).toContain('Cronometer');
    expect(text(screen!.root)).toContain('via  Health Connect');
    expect(text(screen!.root)).toContain('Needs attention');
    expect(text(screen!.root)).not.toContain('No source selected');
    expect(data()).toEqual(before);
  });

  it.each(['Cronometer', 'MacroFactor'])('runs Fitbit → %s through explicit source Continue buttons', async (name) => {
    h.os = 'android'; await mount(); await press('Connect Fitbit');
    expect(text(screen!.root)).toContain('Step  1');
    expect(data().intake.selected).toBe(false);
    await press('Continue'); expect(text(screen!.root)).toContain('Step  2');
    await press(`Choose ${name}`);
    expect(text(screen!.root)).toContain('Step  2');
    expect(text(screen!.root)).toContain(name);
    await press('Continue'); expect(text(screen!.root)).toContain('Choose your goal');
    await press('Save goal'); await press('Continue');
    expect(text(screen!.root)).toContain('Preparing your bank');
    expect(h.router.push).not.toHaveBeenCalled();
  });

  it('connects Fitbit and direct FatSecret while native health remains food-only', async () => {
    h.os = 'android';
    await mount();
    expect(text(screen!.root)).not.toMatch(/Apple Health|Apple Watch|Health Connect/);
    await press('Connect Fitbit'); await press('Continue');
    expect(text(screen!.root)).not.toMatch(/Apple Health|Apple Watch/);
    expect(text(screen!.root)).toContain('Another app using Health Connect');
    await press('Connect FatSecret'); await press('Continue');
    expect(data().expenditure.authoritativeProvider).toBe('google_health_fitbit');
    expect(data().intake.authoritativeProvider).toBe('fatsecret');
    await press('Save goal'); await press('Continue');
    expect(text(screen!.root)).not.toMatch(/Apple Health|Apple Watch/);
  });
  it('resumes Fitbit plus exact Health Connect intake through goal and preparation', async () => {
    h.os = 'android'; await mount(); await press('Connect Fitbit'); await press('Continue');
    expect(text(screen!.root)).toContain('Cronometer'); expect(h.router.push).not.toHaveBeenCalledWith('/native-food');
    const burn = structuredClone(data().expenditure);
    data().connectedProviders.push({ ...data().connectedProviders[0]!, provider: 'health_connect', displayName: 'Health Connect', status: 'connected' });
    data().intake = { ...data().intake, selected: true, authoritativeProvider: 'health_connect', displayName: 'MacroFactor', status: 'ready', nativeIntakeSource: { namespace: 'android_package', id: 'com.sbs.diet' }, selectionRevision: '2026-09-11T12:00:00.000Z' };
    await act(async () => screen!.unmount()); await mount();
    expect(text(screen!.root)).toContain('Choose your goal');
    await press('Save goal'); await press('Continue');
    expect(text(screen!.root)).toContain('Preparing your bank');
    expect(text(screen!.root)).toContain('MacroFactor');
    expect(text(screen!.root)).not.toMatch(/Apple Health|Apple Watch/);
    expect(data().expenditure).toEqual(burn); expect(h.nativeRefresh).toHaveBeenCalled();
  });
  it('keeps empty direct diary recovery independent of native health', async () => {
    h.os = 'android'; h.empty = true;
    await mount(); await press('Connect Fitbit'); await press('Continue'); await press('Connect FatSecret');
    expect(text(screen!.root)).toContain('FatSecret');
    expect(text(screen!.root)).not.toMatch(/Apple Health|Apple Watch/);
  });
  it('requires an explicit direct-source choice when resuming setup from another device', async () => {
    await mount(); await press('Connect Apple Health'); await press('Connect Cronometer');
    const before = structuredClone(data());
    await act(async () => screen!.unmount()); h.os = 'android'; await mount();
    expect(text(screen!.root)).toContain('Your saved source cannot refresh on this phone');
    expect(text(screen!.root)).not.toMatch(/Apple Health|Apple Watch/);
    expect(data()).toEqual(before);
    await press('Connect Fitbit'); await press('Connect FatSecret');
    expect(data().intake.authoritativeProvider).toBe('fatsecret');
  });
  it('hides native alternatives in Connections without silently replacing authority', async () => {
    await mount(); await press('Connect Apple Health'); await press('Connect Cronometer');
    const before = structuredClone(data());
    await act(async () => screen!.unmount()); h.os = 'android'; await mountSettings();
    expect(text(screen!.root)).toContain('Source on another device');
    expect(text(screen!.root)).not.toMatch(/Apple Health|Apple Watch|Managed by iOS/);
    await press('Add food source');
    expect(text(screen!.root)).not.toMatch(/Apple Health|Apple Watch/);
    expect(data()).toEqual(before);
  });
});


describe('future intake authority presentation', () => {
  it.each(['ios', 'android'])('keeps %s Settings neutral without automatic source writes', async (platform) => {
    h.os = platform;
    data().intake = { ...data().intake, selected: true, authoritativeProvider: 'future_intake_v3', displayName: 'Calorie source', status: 'ready', writerBundleIdentifier: null, writerDisplayName: null };
    const before = structuredClone(data());
    await mountSettings();
    expect(text(screen!.root)).toContain('Calorie source');
    expect(text(screen!.root)).toContain('Selected');
    expect(text(screen!.root)).not.toContain('manual_estimate');
    expect(data()).toEqual(before);
    expect(h.saves).toEqual([]);
  });
});

describe('manual source mobile parity', () => {
  it.each(['ios', 'android'])('offers %s estimate setup without committing on navigation, and resumes configured manual users at Goal', async (platform) => {
    h.os = platform; h.manualEnabled = true;
    data().expenditure = { ...data().expenditure, selected: true, authoritativeProvider: 'google_health_fitbit', displayName: 'Fitbit', status: 'ready' };
    connect('google_health_fitbit');
    await mount();
    const before = structuredClone(data());
    await press('I don’t track calories');
    expect(h.router.push).toHaveBeenCalledWith({ pathname: '/manual-estimate', params: { mode: 'select' } });
    expect(data()).toEqual(before); expect(h.saves).toEqual([]);
    await act(async () => screen!.unmount());
    data().intake = { ...data().intake, selected: true, authoritativeProvider: 'manual_estimate', displayName: 'CalorieBank estimate', status: 'ready' };
    await mount();
    expect(text(screen!.root)).toContain('Choose your goal');
    expect(text(screen!.root)).not.toContain('Connect a food tracker');
    await act(async () => screen!.unmount());
    await mountSettings();
    expect(text(screen!.root)).toContain('CalorieBank estimate');
    await press('Manage sources for calories eaten');
    const manualRow = screen!.root.findAll(node => String(node.type) === 'View' && node.children.some(child => typeof child !== 'string' && text(child).includes('CalorieBank estimate')));
    expect(manualRow.length).toBeGreaterThan(0);
    expect(text(screen!.root)).not.toContain('Needs refresh');
    expect(h.saves).toEqual([]);
  });
});
