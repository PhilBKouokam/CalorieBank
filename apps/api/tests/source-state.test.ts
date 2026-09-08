import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { concreteSourceSelected, deriveSourceState, sourceStateAllowsContinue, appleHealthIntakeWriterSchema } from '@caloriebank/schemas';
import { createRequestGeneration } from '../../mobile/lib/onboarding/onboarding-recovery';
import { createSourceOperationGate } from '../../mobile/lib/healthkit/source-operation';

describe('source state invariants', () => {
  for (const provider of ['apple_health', 'google_health_fitbit']) for (const selected of [false, true]) for (const connection of ['connected', 'not_connected', 'needs_attention', 'unavailable']) for (const ready of [false, true]) {
    it(`burn/${provider}/selected=${selected}/${connection}/ready=${ready}`, () => {
      const state = deriveSourceState('burned', { selected, authoritativeProvider: provider, displayName: provider, status: ready ? 'ready' : 'unavailable' }, connection);
      expect(sourceStateAllowsContinue(state)).toBe(selected && connection === 'connected');
      if (!selected) expect(state).toBe('unselected');
      else if (connection === 'connected') expect(state).toBe(ready ? 'connected_data_ready' : 'connected_no_data');
    });
  }
  const sources = ['FatSecret', 'Cronometer', 'MyFitnessPal', 'Lose It!', 'MacroFactor', 'Detected food app'];
  for (const name of sources) for (const selected of [false, true]) for (const connection of ['connected', 'not_connected', 'needs_attention', 'unavailable']) for (const ready of [false, true]) {
    it(`${name}/selected=${selected}/${connection}/ready=${ready}`, () => {
      const source = { selected, authoritativeProvider: name === 'FatSecret' ? 'fatsecret' : 'apple_health', displayName: name, status: ready ? 'ready' : 'unavailable', writerBundleIdentifier: `test.${name}`, writerDisplayName: name };
      const state = deriveSourceState('eaten', source, connection);
      if (!selected) expect(state).toBe('unselected');
      else if (connection === 'needs_attention') expect(state).toBe('reconnect_required');
      else if (connection === 'connected') {
        expect(state).toBe(ready ? 'connected_data_ready' : 'connected_no_data');
        expect(sourceStateAllowsContinue(state)).toBe(true);
        expect(deriveSourceState('eaten', source, connection, 'failed')).toBe('transient_refresh_failure');
        expect(deriveSourceState('eaten', source, connection, 'refreshing')).toBe('refreshing');
      } else expect(sourceStateAllowsContinue(state)).toBe(false);
    });
  }
  it('never accepts generic Apple Health access or placeholders as a selected tracker', () => {
    for (const displayName of ['Choose a food tracker', 'Apple Health food tracker']) {
      expect(appleHealthIntakeWriterSchema.safeParse({ displayName, bundleIdentifier: 'test' }).success).toBe(false);
      expect(concreteSourceSelected('eaten', { selected: true, authoritativeProvider: 'apple_health', status: 'ready', displayName, writerDisplayName: displayName, writerBundleIdentifier: 'test' })).toBe(false);
    }
    expect(concreteSourceSelected('eaten', { selected: true, authoritativeProvider: 'apple_health', displayName: 'Apple Health', status: 'ready' })).toBe(false);
  });
  it('invalidates stale requests across navigation and new canonical reloads', () => {
    const gate = createRequestGeneration(); const old = gate.begin(); const latest = gate.begin();
    expect(old()).toBe(false); expect(latest()).toBe(true);
    gate.invalidate(); expect(latest()).toBe(false);
  });
  it('serializes source operations and rejects stale errors after leaving their owner', () => {
    const gate = createSourceOperationGate();
    expect(gate.begin('discover:eaten:apple_health')).toBe(true);
    expect(gate.begin('select:eaten:fatsecret')).toBe(false);
    gate.invalidate(); expect(gate.current()).toBe(false);
    gate.end(); expect(gate.begin('select:eaten:fatsecret')).toBe(true);
    expect(gate.current()).toBe(true);
  });
  it('forbids selection writes during HealthKit refresh', () => {
    const source = readFileSync(resolve(__dirname, '../../mobile/lib/healthkit/healthkit-connection.ts'), 'utf8');
    expect(source).not.toContain('saveProviderSelection');
    expect(source).not.toContain('discoveredWriters.length === 1');
  });
});
