import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as android from '../../mobile/lib/native-health/index.android';
import { connectionsForNativeCapability } from '../../mobile/lib/native-health/presentation';
import * as androidCopy from '../../mobile/lib/native-health/copy.android';
import * as iosCopy from '../../mobile/lib/native-health/copy';
import { hostedAuthRedirectForPlatform } from '../../mobile/lib/auth/platform-redirect';
import { preferDirectFoodSources } from '../../mobile/lib/providers/intake-writer-policy';
import type { HealthConnectionsResponse } from '@caloriebank/schemas';

const apple = vi.hoisted(() => ({
  setAppleHealthAccountScope: vi.fn(), getAppleHealthConnectionStatus: vi.fn(),
  connectAppleHealth: vi.fn(), refreshAppleHealthForCurrentAccount: vi.fn(),
  syncAppleHealthToday: vi.fn(), getAppleHealthDiagnostics: vi.fn(),
}));
vi.mock('../../mobile/lib/healthkit/healthkit-connection', () => apple);
import * as ios from '../../mobile/lib/native-health/index.ios';

const config = JSON.parse(readFileSync(resolve(__dirname, '../../mobile/app.json'), 'utf8')).expo;

describe('Android B1 platform boundary', () => {
  it('exposes no health capability or data and cannot report a successful import', async () => {
    expect(android.nativeHealthCapability).toEqual({ supported: false, provider: null, reason: 'not_implemented' });
    android.setNativeHealthAccountScope('A');
    expect(await android.getNativeHealthConnectionStatus()).toBe('unavailable');
    expect(await android.connectNativeHealth()).toBe('unavailable');
    expect(await android.refreshNativeHealthForCurrentAccount()).toBeNull();
    expect(await android.getNativeHealthDiagnostics()).toBeNull();
    expect(await android.discoverNativeIntakeWriters()).toEqual([]);
    await expect(android.syncNativeHealthToday()).rejects.toThrow('not implemented');
    android.setNativeHealthAccountScope('B');
    expect(await android.getNativeHealthConnectionStatus()).toBe('unavailable');
    for (const fn of Object.values(apple)) expect(fn).not.toHaveBeenCalled();
  });
  it('preserves iOS adapter function identity, not a rewritten implementation', () => {
    expect(ios.setNativeHealthAccountScope).toBe(apple.setAppleHealthAccountScope);
    expect(ios.getNativeHealthConnectionStatus).toBe(apple.getAppleHealthConnectionStatus);
    expect(ios.connectNativeHealth).toBe(apple.connectAppleHealth);
    expect(ios.refreshNativeHealthForCurrentAccount).toBe(apple.refreshAppleHealthForCurrentAccount);
    expect(ios.syncNativeHealthToday).toBe(apple.syncAppleHealthToday);
    expect(ios.getNativeHealthDiagnostics).toBe(apple.getAppleHealthDiagnostics);
  });
  it('keeps native permission copy scoped to its platform', () => {
    expect(JSON.stringify(androidCopy)).not.toMatch(/Apple Health|iOS/);
    expect(JSON.stringify(iosCopy)).not.toMatch(/Android|Health Connect/);
    expect(androidCopy.sourceLabel('Apple Health')).toBe('Source on another device');
    expect(iosCopy.sourceLabel('Apple Health')).toBe('Apple Health');
    expect(androidCopy.sourceLabel('Fitbit')).toBe('Fitbit');
  });
  it('registers the shared direct-provider deep link independently of Clerk auth', () => {
    expect(config.android.package).toBe('com.caloriebank.mobile');
    expect(config.ios.bundleIdentifier).toBe('com.caloriebank.mobile');
    expect(config.scheme).toBe('caloriebank');
    expect(config.android.intentFilters).toContainEqual({ action: 'VIEW', category: ['BROWSABLE', 'DEFAULT'], data: [{ scheme: 'caloriebank', host: 'integrations' }] });
    expect(hostedAuthRedirectForPlatform('android', config).nativeRedirectUrl).toBe('clerk://com.caloriebank.mobile.hosted-callback');
    expect(hostedAuthRedirectForPlatform('ios', config).nativeRedirectUrl).toBe('com.caloriebank.mobile://callback');
    expect(config.android.permissions ?? []).toEqual([]);
    expect(JSON.stringify(config.android)).not.toContain('android.permission.health.');
  });
  it('retains selected authority but removes unusable native alternatives', () => {
    const native = { optionId: 'apple', label: 'Apple Health', deviceManaged: true, status: 'connected' as const, transportLabel: null, primaryAction: null };
    const fitbit = { ...native, optionId: 'fitbit', label: 'Fitbit', deviceManaged: false };
    const fatsecret = { ...fitbit, optionId: 'fatsecret', label: 'FatSecret' };
    const input: HealthConnectionsResponse = {
      burned: { selected: native, alternatives: [fitbit], canChange: true, canAddSource: false },
      eaten: { selected: fatsecret, alternatives: [native], canChange: true, canAddSource: true },
      connectedServices: [native, fitbit, fatsecret],
    };
    expect(connectionsForNativeCapability(input, true)).toBe(input);
    const result = connectionsForNativeCapability(input, false);
    expect(result.burned.selected).toMatchObject({ optionId: 'apple', status: 'needs_attention', primaryAction: null });
    expect(result.burned.alternatives).toEqual([fitbit]);
    expect(result.eaten.selected).toBe(fatsecret);
    expect(result.eaten.alternatives).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('Apple Health');
    expect(input.burned.selected).toBe(native);
  });
  it('preserves the exact direct-FatSecret writer preference rather than matching names', () => {
    const writers = [{ bundleIdentifier: 'com.fatsecret.caloriecounter' }, { bundleIdentifier: 'another.writer' }];
    expect(preferDirectFoodSources(writers, [{ provider: 'fatsecret', status: 'connected' }])).toEqual([writers[1]]);
    expect(preferDirectFoodSources(writers, [{ provider: 'fatsecret', status: 'disconnected' }])).toEqual(writers);
  });
});
