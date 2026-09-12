import React from 'react';
import { resolve } from 'node:path';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ discover: vi.fn(), select: vi.fn(), refresh: vi.fn(), settings: vi.fn(), back: vi.fn(), cancel: vi.fn(), listener: null as null | ((state: string) => void) }));
vi.mock('react-native', () => ({ Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', AppState: { addEventListener: (_: string, listener: (state: string) => void) => { h.listener = listener; return { remove() {} }; } }, StyleSheet: { create: <T,>(x: T) => x } }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: h.back }), useFocusEffect: (f: () => void) => React.useEffect(f, []) }));
vi.mock('../../mobile/lib/native-health', () => ({ nativeIntake: { supported: true, discover: h.discover, select: h.select, refresh: h.refresh, openSettings: h.settings, cancel: h.cancel } }));
vi.mock('../../mobile/lib/api/client', () => ({ fetchProviderSelection: async () => ({ intake: { authoritativeProvider: 'health_connect', nativeIntakeSource: { namespace: 'android_package', id: 'com.sbs.diet' } } }) }));
const screenPath = resolve(__dirname, '../../mobile/screens/native-food.android.tsx');
let screen: ReactTestRenderer;
const content = (n: ReactTestInstance): string => n.children.map((c) => typeof c === 'string' ? c : content(c)).join(' ');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const mount = async () => { const NativeFood = (await import(screenPath)).default; await act(async () => { screen = create(React.createElement(NativeFood)); await settle(); }); };
async function press(label: string) { const button = screen.root.findAll((n) => String(n.type) === 'Pressable' && content(n).includes(label))[0]!; expect(button).toBeDefined(); await act(async () => { button.props.onPress(); await settle(); }); }
beforeEach(() => { vi.clearAllMocks(); h.discover.mockResolvedValue({ access: { state: 'available', granted: ['nutrition'], missing: [] }, sources: [{ source: { namespace: 'android_package', id: 'com.sbs.diet' }, displayName: 'MacroFactor' }], queryState: 'complete' }); h.select.mockResolvedValue('ready'); h.refresh.mockResolvedValue('empty'); });
afterEach(async () => { if (screen) await act(async () => screen.unmount()); });
describe('Android food source consumer flow', () => {
  it('selects the exact package and exposes only food language', async () => { await mount(); await press('MacroFactor'); expect(h.select).toHaveBeenCalledWith({ namespace: 'android_package', id: 'com.sbs.diet' }); expect(content(screen.root)).toContain('Your food tracker is connected.'); expect(content(screen.root)).not.toMatch(/Apple|Calories Burned|calories burned/); });
  it('shows connected-empty separately from failed discovery', async () => { await mount(); await press('Refresh selected tracker'); expect(content(screen.root)).toContain('No calorie data'); h.discover.mockResolvedValue({ access: { state: 'available', granted: ['nutrition'], missing: [] }, sources: [], queryState: 'failed' }); await press('Find food trackers'); expect(content(screen.root)).toContain('could not load'); expect(content(screen.root)).not.toContain('No food trackers were found'); });
  it('recovers permissions on foreground re-entry without selecting another source', async () => { h.discover.mockResolvedValue({ access: { state: 'permissions_missing', granted: [], missing: ['nutrition'] }, sources: [] }); await mount(); expect(content(screen.root)).toContain('Allow food access'); await press('Allow food access'); expect(h.discover).toHaveBeenCalledWith(true); await act(async () => { h.listener?.('background'); h.listener?.('active'); await settle(); }); expect(h.cancel).toHaveBeenCalled(); expect(h.select).not.toHaveBeenCalled(); });
  it('provides a direct alternative for unsupported phones', async () => { h.discover.mockResolvedValue({ access: { state: 'unsupported_version', granted: [], missing: ['nutrition'] }, sources: [] }); await mount(); expect(content(screen.root)).toContain('connect FatSecret directly'); expect(h.select).not.toHaveBeenCalled(); });
});
