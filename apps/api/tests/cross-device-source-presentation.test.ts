import { describe, expect, it } from 'vitest';
import type { HealthConnectionOption, HealthConnectionsResponse } from '@caloriebank/schemas';
import { connectionsForNativeCapability, crossDeviceSourceHint } from '../../mobile/lib/native-health/presentation';
import { composeAppleHealthConnections } from '../../mobile/lib/healthkit/health-connections-presentation';

const option = (transportLabel: string | null, status: HealthConnectionOption['status'] = 'connected'): HealthConnectionOption => ({
  optionId: 'eaten-source', label: 'Cronometer', transportLabel, status, deviceManaged: transportLabel !== null, primaryAction: null,
});
function connections(selected: HealthConnectionOption): HealthConnectionsResponse {
  return { burned: { selected: null, alternatives: [], canChange: false, canAddSource: true },
    eaten: { selected, alternatives: [], canChange: false, canAddSource: true }, connectedServices: [] };
}
describe('cross-device source presentation without authority writes', () => {
  it.each(['connected', 'no_data', 'needs_attention'] as const)('preserves server identity and actual %s state on Android', status => {
    const before = connections(option('Apple Health', status)); const original = structuredClone(before);
    const result = connectionsForNativeCapability(before, false, true, false);
    expect(result.eaten.selected).toEqual(before.eaten.selected);
    expect(crossDeviceSourceHint(result.eaten.selected, false)).toBe('Updates from Apple Health on iPhone');
    expect(before).toEqual(original);
  });
  it('does not treat iPhone HealthKit permission as Android Health Connect permission', () => {
    const input = connections(option('Health Connect'));
    const composed = composeAppleHealthConnections(input, 'not_connected', 'needs_attention');
    const result = connectionsForNativeCapability(composed, true);
    expect(result.eaten.selected).toEqual(input.eaten.selected);
    expect(crossDeviceSourceHint(result.eaten.selected, true)).toBe('Updates from Health Connect on Android');
  });
  it('keeps local revoked Nutrition permission actionable', () => {
    expect(connectionsForNativeCapability(connections(option('Health Connect')), false, true, false).eaten.selected)
      .toMatchObject({ status: 'needs_attention', primaryAction: 'check_native_health' });
  });
  it.each(['CalorieBank estimate', 'Another calorie source'])('never assigns remote-device state to %s', label => {
    const input = connections({ ...option(null), label });
    for (const apple of [false, true]) {
      const result = connectionsForNativeCapability(input, apple, !apple);
      expect(result.eaten.selected).toEqual(input.eaten.selected);
      expect(crossDeviceSourceHint(result.eaten.selected, apple)).toBeNull();
    }
  });
});
