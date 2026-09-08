import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appleHealthEmptyMessage, appleHealthIntakeRefreshMessage, foodConnectionMessage, foodConnectionState } from '../../mobile/lib/healthkit/connection-feedback';
import { createHealthKitDiagnosticsSnapshot } from '../../mobile/lib/healthkit/healthkit-diagnostics';

describe('food connection and role-specific feedback', () => {
  it.each([
    ['connected', true, false, 'ready'],
    ['connected', false, false, 'no_data'],
    ['not_connected', false, false, 'not_connected'],
    ['needs_attention', true, true, 'reauthentication_required'],
    ['connected', true, true, 'refresh_failed'],
    ['connected', false, true, 'refresh_failed'],
  ] as const)('classifies %s/data=%s/failed=%s as %s', (connection, data, failed, expected) => {
    expect(foodConnectionState(connection, data, failed)).toBe(expected);
  });

  it('allows healthy empty history without claiming a connection failure', () => {
    const copy = foodConnectionMessage('FatSecret', 'no_data', true);
    expect(copy).toContain('is connected');
    expect(copy).toContain('continue setup');
    expect(copy).not.toContain("couldn't connect");
    expect(foodConnectionMessage('FatSecret', 'refresh_failed')).toContain("couldn't refresh");
  });

  it('keeps burn language out of both food empty states', () => {
    expect(appleHealthEmptyMessage('burned')).toContain('calorie-burn');
    expect(appleHealthEmptyMessage('eaten', true)).toContain('selected tracker');
    expect(appleHealthEmptyMessage('eaten', false)).toContain('Choose a food tracker');
    for (const selected of [true, false]) expect(appleHealthEmptyMessage('eaten', selected)).not.toMatch(/burn/i);
  });

  it('does not call an unattempted intake query empty', () => {
    expect(appleHealthIntakeRefreshMessage(createHealthKitDiagnosticsSnapshot(), true)).toContain('not been checked');
  });

  it('separates empty, failed and successful food queries regardless of burn state', () => {
    const snapshot = createHealthKitDiagnosticsSnapshot({ overallSyncResult: 'partial', intakeWriterChecks: [{ localDate: '2026-09-08', status: 'succeeded', sampleCount: 0 }] });
    expect(appleHealthIntakeRefreshMessage(snapshot, true)).toContain("couldn't find");
    snapshot.intakeWriterChecks[0]!.sampleCount = 3;
    expect(appleHealthIntakeRefreshMessage(snapshot, true)).toContain('has been refreshed');
    snapshot.intakeWriterChecks[0]!.status = 'failed';
    expect(appleHealthIntakeRefreshMessage(snapshot, true)).toContain("couldn't refresh");
  });
});

describe('permanent source manager and compact goal selector wiring', () => {
  const screen = readFileSync(resolve(__dirname, '../../mobile/app/(settings)/integrations.tsx'), 'utf8');
  it('offers food tracker configuration independently of existing Apple Health transport', () => {
    expect(screen).toContain('label="Apple Health food tracker"');
    expect(screen).not.toContain('!appleAvailable ? <SourceAction detail=');
    expect(screen).toContain('onChooseTracker');
    expect(screen).toContain("setServiceRole('eaten')");
    expect(screen).toContain('discoverAppleHealthIntakeWriters()');
    expect(screen).toContain('appleHealthIntakeWriter: { bundleIdentifier: writer.bundleIdentifier, displayName: writer.displayName }');
  });
  it('uses equal flexible centered mode choices for both goal directions', () => {
    const goal = readFileSync(resolve(__dirname, '../../mobile/components/caloriebank/GoalConfigurationForm.tsx'), 'utf8');
    expect(goal).toContain('flexBasis: 0');
    expect(goal).toContain('minHeight: 52');
    expect(goal).toContain("modeText: { textAlign: 'center', flexShrink: 1 }");
    expect(goal).toContain('styles.modeText');
    expect(goal).toContain('accessibilityState={{ selected }}');
  });
});
