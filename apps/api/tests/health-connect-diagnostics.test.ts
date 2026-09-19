import React, { type ComponentType } from 'react';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QualificationReport } from '../../mobile/lib/native-health/evidence';

const n = vi.hoisted(() => ({ access: vi.fn(), inspect: vi.fn(), settings: vi.fn(), cancel: vi.fn() }));
const h = vi.hoisted(() => ({ access: vi.fn(), inspect: vi.fn(), settings: vi.fn(), cancel: vi.fn() }));
vi.mock('react-native', () => ({
  Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: <T,>(s: T) => s },
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => ({ Redirect: 'Redirect', useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, []) }));
vi.mock('../../mobile/lib/native-health/index.android', () => ({ nativeHealthQualification: { access: h.access, inspect: h.inspect, openSettings: h.settings, cancel: h.cancel }, nativeNutritionQualification: { access: n.access, inspect: n.inspect, openSettings: n.settings, cancel: n.cancel } }));
let screen: ReactTestRenderer | undefined;
const report: QualificationReport = {
  state: 'complete', access: { state: 'partial_permissions', granted: ['nutrition'], missing: ['steps'] },
  queryStartedAt: '2026-09-11T12:00:00Z', observedAt: '2026-09-11T12:00:01Z', generation: 1, providerUpdatedAt: null,
  windows: Array.from({ length: 8 }, (_, i) => ({ localDate: `2026-09-${String(11 - i).padStart(2, '0')}`, timezone: 'UTC', start: '2026-09-04T00:00:00Z', end: '2026-09-11T12:00:00Z', isCurrentDay: i === 0 })),
  origins: [{ namespace: 'android_package', id: 'com.example.very.long.food.tracker.package' }], originState: 'not_selected', counts: { nutrition: 12, steps: 0 }, days: [], readConsistency: 'stable_read', forecastEligible: false, authoritative: false,
};
beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_HEALTH_CONNECT_QUALIFICATION', '1');
  Object.assign(globalThis, { __DEV__: true, IS_REACT_ACT_ENVIRONMENT: true });
  h.access.mockReset().mockResolvedValue(report.access); h.inspect.mockReset().mockResolvedValue(report); h.cancel.mockClear();
  n.access.mockReset().mockResolvedValue(report.access); n.inspect.mockReset().mockResolvedValue(report); n.cancel.mockClear();
});
afterEach(async () => { if (screen) await act(async () => screen!.unmount()); screen = undefined; });
async function mount() {
  const modulePath = resolve(__dirname, '../../mobile/screens/health-diagnostics.android.tsx');
  const { default: Screen } = await import(modulePath) as { default: ComponentType };
  await act(async () => { screen = create(React.createElement(Screen)); });
}
async function press(label: string) {
  const button = screen!.root.findAll((n) => String(n.type) === 'Pressable' && n.findAll((child) => String(child.type) === 'Text' && child.children.includes(label)).length > 0)[0]!;
  await act(async () => { await button.props.onPress(); });
}
describe('Android developer qualification UI', () => {
  it('renders safe counts, exact origins and withheld burn, with accessible controls', async () => {
    await mount(); await press('Inspect recent evidence');
    const tree = JSON.stringify(screen!.toJSON());
    expect(tree).toContain('NOT QUALIFIED'); expect(tree).toContain('com.example.very.long.food.tracker.package');
    expect(tree).not.toMatch(/Apple Health|HealthKit|accessToken|caloriesConsumed/);
    for (const button of screen!.root.findAll((n) => String(n.type) === 'Pressable')) expect(['button', 'switch']).toContain(button.props.accessibilityRole);
    if (process.env.CALORIEBANK_VISUAL_FIXTURE_DIR) writeFileSync(resolve(process.env.CALORIEBANK_VISUAL_FIXTURE_DIR, 'health-connect-diagnostics.json'), JSON.stringify(screen!.toJSON()));
    await press('com.example.very.long.food.tracker.package'); await press('Inspect recent evidence');
    expect(h.inspect).toHaveBeenLastCalledWith('com.example.very.long.food.tracker.package');
  });
  it('offers nutrition-only permission and evidence checks without enabling authority', async () => {
    await mount();
    const toggle = screen!.root.find((node) => String(node.type) === 'Pressable' && node.props.accessibilityRole === 'switch');
    await act(async () => toggle.props.onPress());
    await press('Request read permissions'); await press('Inspect recent evidence');
    expect(n.access).toHaveBeenCalledWith(true); expect(n.inspect).toHaveBeenCalledWith(undefined);
    expect(h.inspect).not.toHaveBeenCalled();
    expect(JSON.stringify(screen!.toJSON())).toContain('does not upload data or change your bank');
  });
  it('does not request permissions automatically', async () => { await mount(); expect(h.access).toHaveBeenCalledWith(); expect(h.access).not.toHaveBeenCalledWith(true); await press('Request read permissions'); expect(h.access).toHaveBeenCalledWith(true); });
  it('blocks a direct diagnostic route in beta Play builds without accessing Health Connect', async () => {
    vi.stubEnv('EXPO_PUBLIC_HEALTH_CONNECT_QUALIFICATION', '0');
    const previous = process.env.EXPO_PUBLIC_APP_ENV; process.env.EXPO_PUBLIC_APP_ENV = 'beta'; Object.assign(globalThis, { __DEV__: false });
    try { await mount(); expect(screen!.root.find((n) => String(n.type) === 'Redirect').props.href).toBe('/integrations'); expect(h.access).not.toHaveBeenCalled(); }
    finally { if (previous === undefined) delete process.env.EXPO_PUBLIC_APP_ENV; else process.env.EXPO_PUBLIC_APP_ENV = previous; }
  });
});

afterEach(() => vi.unstubAllEnvs());
