import { describe, expect, it } from 'vitest';
import { beginOnboardingProviderReturn, normalizeAuthSystemPath } from '../../mobile/lib/auth/native-intent';
describe('Android setup provider browser return', () => {
  it.each(['fitbit', 'fatsecret'] as const)('keeps setup mounted only during its own %s callback', (provider) => {
    const path = `caloriebank://integrations?${provider}=connected`;
    const end = beginOnboardingProviderReturn(provider);
    try {
      expect(normalizeAuthSystemPath({ path, initial: false }, 'android')).toBe('');
      expect(normalizeAuthSystemPath({ path, initial: false }, 'ios')).toBe(path);
      expect(normalizeAuthSystemPath({ path, initial: true }, 'android')).toBe(path);
      for (const other of ['caloriebank://today', 'caloriebank://integrations', 'caloriebank://integrations/other?fitbit=connected', 'caloriebank://evil?fitbit=connected']) {
        expect(normalizeAuthSystemPath({ path: other, initial: false }, 'android')).toBe(other);
      }
    } finally { end(); }
    expect(normalizeAuthSystemPath({ path, initial: false }, 'android')).toBe(path);
  });
  it('suppresses a failed callback without treating it as authorization or selection', () => {
    const end = beginOnboardingProviderReturn('fitbit');
    try { expect(normalizeAuthSystemPath({ path: 'caloriebank://integrations?fitbit=error', initial: false }, 'android')).toBe(''); }
    finally { end(); }
  });
});
