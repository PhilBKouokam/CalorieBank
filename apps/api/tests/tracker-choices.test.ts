import { expect, it } from 'vitest';
import { trackerChoices } from '../../mobile/lib/native-health/tracker-choices';

it.each(['apple_health', 'health_connect'])('retains exact selected %s identity while showing one Cronometer', (provider) => {
  const selected = { label: 'Cronometer', id: provider };
  const other = { label: 'Cronometer', id: provider === 'apple_health' ? 'health_connect' : 'apple_health' };
  const direct = { label: 'FatSecret', id: 'fatsecret' };
  expect(trackerChoices([other, direct], selected)).toEqual([selected, direct]);
  expect(selected.id).toBe(provider);
});
it('does not collapse unknown writers sharing a generic name', () => {
  const options = [{ label: 'Food tracker', id: 'a' }, { label: 'Food tracker', id: 'b' }];
  expect(trackerChoices(options, null)).toEqual(options);
});
it('preserves a historical selected opaque identity rather than selecting another transport', () => {
  const selected = { label: 'Cronometer', id: 'historical-exact-writer' };
  expect(trackerChoices([{ label: 'Cronometer', id: 'current-other-writer' }], selected)).toEqual([selected]);
});
