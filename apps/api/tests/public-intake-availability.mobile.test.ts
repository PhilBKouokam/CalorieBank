import { describe, expect, it } from 'vitest';
import { allowsFatSecret } from '../../mobile/lib/providers/public-intake-availability';
import { preferDirectFoodSources } from '../../mobile/lib/providers/intake-writer-policy';

describe('public intake presentation policy', () => {
  it('does not cache decisions across account switches and accepts loaded legacy responses', () => {
    expect(allowsFatSecret(null)).toBe(false);
    expect(allowsFatSecret({})).toBe(true);
    expect(allowsFatSecret({ intakeAvailability: { fatSecret: false } })).toBe(false);
    expect(allowsFatSecret({ intakeAvailability: { fatSecret: true } })).toBe(true);
    expect(allowsFatSecret({ intakeAvailability: { fatSecret: false } })).toBe(false);
  });
  it('excludes exact FatSecret native writers without inventing another provider', () => {
    const writers = [{ bundleIdentifier: 'com.fatsecret.caloriecounter' }, { bundleIdentifier: 'com.cronometer' }, { bundleIdentifier: 'com.fatsecret.caloriecounter.other' }];
    expect(preferDirectFoodSources(writers, [], false)).toEqual(writers.slice(1));
    expect(preferDirectFoodSources(writers, [], true)).toEqual(writers);
    expect(preferDirectFoodSources(writers, [{ provider: 'fatsecret', status: 'connected' }], true)).toEqual(writers.slice(1));
  });
});
