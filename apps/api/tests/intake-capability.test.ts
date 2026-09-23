import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CLIENT_CAPABILITIES_HEADER, INTAKE_AUTHORITY_CAPABILITY, supportsIntakeAuthority } from '@caloriebank/schemas';
import { errorHandler } from '../src/errors';
import { intakeCapabilityBoundary, requireIntakeCapability } from '../src/security/intake-capability';

// No manual persistence or production feature is enabled by these wire fixtures.
function fixture() {
  const app = express();
  let source = 'manual_estimate';
  let safePreference = 0;
  app.use(intakeCapabilityBoundary);
  app.get('/provider', (_req, res) => res.json({ intake: { authoritativeProvider: 'fatsecret' } }));
  app.get('/current', (_req, res) => res.json({ intake: { authoritativeProvider: source }, eaten: 2500 }));
  app.get('/history', (_req, res) => res.json({ days: [{ snapshot: { intakeProvider: 'manual_estimate', eaten: 2900 } }] }));
  app.put('/source', (_req, res) => {
    requireIntakeCapability(source, 'fatsecret');
    source = 'fatsecret';
    res.json({ intake: { authoritativeProvider: source } });
  });
  app.put('/safe', (_req, res) => { safePreference += 1; res.json({ value: safePreference }); });
  app.use(errorHandler);
  return { app, source: () => source };
}

describe('request-level intake capability firewall', () => {
  it.each([undefined, '', 'intake-authority-v1', 'INTAKE-AUTHORITY-V2', 'intake-authority-v2;true', 'intake-authority-v2,', 'a'.repeat(1025)])('rejects unsupported/malformed capability %s', (header) => {
    expect(supportsIntakeAuthority(header)).toBe(false);
  });
  it('recognizes exact capability among additional well-formed tokens', () => {
    expect(supportsIntakeAuthority('future-feature, intake-authority-v2')).toBe(true);
  });
  it.each([false, true])('preserves known provider responses (capable=%s)', async (capable) => {
    const { app } = fixture();
    const call = request(app).get('/provider');
    if (capable) call.set(CLIENT_CAPABILITIES_HEADER, INTAKE_AUTHORITY_CAPABILITY);
    expect((await call.expect(200)).body).toEqual({ intake: { authoritativeProvider: 'fatsecret' } });
  });
  it.each(['/current', '/history'])('rejects unsupported %s before serialization; capability stripping is request-scoped', async (path) => {
    const { app } = fixture();
    const supported = await request(app).get(path).set(CLIENT_CAPABILITIES_HEADER, INTAKE_AUTHORITY_CAPABILITY).expect(200);
    expect(supported.text).toContain('manual_estimate');
    const unsupported = await request(app).get(path).expect(426);
    expect(unsupported.body.error.details.code).toBe('UPDATE_REQUIRED');
    expect(unsupported.text).not.toContain('manual_estimate');
    expect(unsupported.text).not.toContain('2500');
    expect(unsupported.text).not.toContain('2900');
  });
  it('rejects conflicting write before mutation, then allows explicit capable switch', async () => {
    const state = fixture();
    await request(state.app).put('/source').expect(426);
    expect(state.source()).toBe('manual_estimate');
    await request(state.app).put('/source').set(CLIENT_CAPABILITIES_HEADER, INTAKE_AUTHORITY_CAPABILITY).expect(200);
    expect(state.source()).toBe('fatsecret');
    await request(state.app).get('/history').expect(426);
  });
  it('allows unrelated safe writes without capability', async () => {
    expect((await request(fixture().app).put('/safe').expect(200)).body.value).toBe(1);
  });
  it('does not gate trusted server lifecycle on mobile protocol', () => {
    expect(() => requireIntakeCapability('manual_estimate')).not.toThrow();
  });
});
