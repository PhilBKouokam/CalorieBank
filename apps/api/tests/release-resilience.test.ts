import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createMorningBankUpdateRouter } from '../src/modules/morning-bank-update/morning-bank-update.routes';
import { AppError } from '../src/errors';
import {
  confirmPreferenceChange, createNotificationOperations, createSettingsRequestGate, retryDeviceRelease,
  withNotificationTokenTimeout,
} from '../../mobile/lib/notifications/notification-operations';
import {
  createRequestGeneration, preparationRequestNotice, setupIsReady,
} from '../../mobile/lib/onboarding/onboarding-recovery';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function notificationApp() {
  const user = { id: '10000000-0000-4000-8000-000000000001', email: 'test@local.test' };
  const state = { enabled: false, deviceRegistered: true, deviceActive: true, lastRegisteredAt: null };
  const service = {
    settings: vi.fn(async () => state),
    setPreference: vi.fn(async (_user: string, enabled: boolean) => ({ ...state, enabled })),
    registerDevice: vi.fn(async () => state),
    unregisterDevice: vi.fn(async () => undefined),
  };
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.locals.currentUser = user; next(); });
  app.use(createMorningBankUpdateRouter(service as never, user));
  app.use((error: AppError, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.statusCode ?? 500).json({ error: 'request_failed' });
  });
  return { app, service };
}

describe('notification operational rate limits', () => {
  it('supports twenty preference changes and still permits privacy cleanup', async () => {
    const { app, service } = notificationApp();
    for (let i = 0; i < 20; i += 1) {
      await request(app).patch('/preference').send({ enabled: i % 2 === 0 }).expect(200);
    }
    await request(app).delete('/device').expect(204);
    await request(app).delete('/device').expect(204);
    expect(service.unregisterDevice).toHaveBeenCalledTimes(2);
  });

  it('preference throttling cannot block registration, reload, or release', async () => {
    const { app } = notificationApp();
    for (let i = 0; i < 60; i += 1) await request(app).patch('/preference').send({ enabled: true }).expect(200);
    const response = await request(app).patch('/preference').send({ enabled: false }).expect(429);
    expect(response.headers['retry-after']).toBeDefined();
    await request(app).get('/').expect(200);
    await request(app).put('/device').send({ expoPushToken: 'ExponentPushToken[test-registration]', platform: 'ios' }).expect(200);
    await request(app).delete('/device').expect(204);
  });

  it('registration throttling cannot block release', async () => {
    const { app } = notificationApp();
    for (let i = 0; i < 60; i += 1) await request(app).put('/device').send({ expoPushToken: 'ExponentPushToken[test-registration]', platform: 'ios' }).expect(200);
    await request(app).put('/device').send({ expoPushToken: 'ExponentPushToken[test-registration]', platform: 'ios' }).expect(429);
    await request(app).delete('/device').expect(204);
  });
});

describe('notification client resilience', () => {
  it('a stalled token lookup cannot hold the release queue indefinitely or register later', async () => {
    vi.useFakeTimers();
    try {
      const pending = deferred();
      const register = vi.fn();
      const result = withNotificationTokenTimeout(pending.promise).then(register);
      const rejected = expect(result).rejects.toThrow('timed out');
      await vi.advanceTimersByTimeAsync(15_000);
      await rejected;
      pending.resolve(); await Promise.resolve();
      expect(register).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('synchronously gates repeated native switch events until the accepted write finishes', () => {
    const gate = createSettingsRequestGate();
    const first = gate.begin()!;
    for (let i = 0; i < 20; i += 1) expect(gate.begin()).toBeNull();
    expect(first.isCurrent()).toBe(true);
    first.finish();
    expect(gate.begin()).not.toBeNull();
  });

  it('invalidates old screen requests on blur/remount', () => {
    const gate = createSettingsRequestGate();
    const old = gate.begin()!;
    gate.invalidate();
    const fresh = gate.begin()!;
    expect(old.isCurrent()).toBe(false);
    old.finish();
    expect(gate.begin()).toBeNull();
    expect(fresh.isCurrent()).toBe(true);
  });

  it('keeps writes serial and ends with the latest accepted preference', async () => {
    const operations = createNotificationOperations();
    operations.setScope('A');
    let active = 0;
    let maximum = 0;
    let enabled = false;
    await Promise.all([true, false, true, false].map((next) => operations.run(async () => {
      active += 1; maximum = Math.max(maximum, active);
      await Promise.resolve(); enabled = next; active -= 1;
    })));
    expect(maximum).toBe(1);
    expect(enabled).toBe(false);
  });

  it('does not claim On when a throttled write was rejected and recovers on the next success', async () => {
    const reload = vi.fn(async () => false);
    expect(await confirmPreferenceChange(true, async () => { throw new Error('429'); }, reload, (state) => state))
      .toEqual({ state: false, message: "Your change wasn't saved. Please try again." });
    expect(await confirmPreferenceChange(true, async () => true, reload, (state) => state))
      .toEqual({ state: true, message: null });
  });

  it('uses acknowledged reload after a write timeout instead of retaining the old error', async () => {
    expect(await confirmPreferenceChange(true, async () => { throw new Error('timeout'); }, async () => true, (state) => state))
      .toEqual({ state: true, message: null });
  });

  it('remains recoverable when neither the write nor verification can reach the API', async () => {
    await expect(confirmPreferenceChange(true, async () => { throw new Error('network'); }, async () => { throw new Error('offline'); }, Boolean))
      .rejects.toThrow('offline');
  });

  it('waits for an in-flight registration before release and rejects later foreground registrations', async () => {
    const operations = createNotificationOperations();
    operations.setScope('A');
    const pending = deferred();
    const events: string[] = [];
    const registration = operations.run(async () => { await pending.promise; events.push('registered'); });
    await Promise.resolve(); await Promise.resolve();
    const released = operations.release(async () => { events.push('released'); });
    const stale = operations.run(async () => { events.push('leaked'); });
    const rejectedRegistration = expect(registration).rejects.toThrow();
    const rejectedStale = expect(stale).rejects.toThrow();
    pending.resolve();
    await rejectedRegistration; await released; await rejectedStale;
    expect(events).toEqual(['registered', 'released']);
  });

  it('invalidates account A work before it can make a second request as B', async () => {
    const operations = createNotificationOperations();
    operations.setScope('A');
    const pending = deferred();
    const secondRequest = vi.fn();
    const old = operations.run(async (check) => { await pending.promise; check(); secondRequest(); });
    await Promise.resolve(); await Promise.resolve();
    operations.setScope('B');
    const rejected = expect(old).rejects.toThrow();
    pending.resolve(); await rejected;
    expect(secondRequest).not.toHaveBeenCalled();
    await expect(operations.run(async () => 'B')).resolves.toBe('B');
  });

  it('retries transient release failures with a bounded backoff', async () => {
    const release = vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValue(undefined);
    const wait = vi.fn(async () => undefined);
    await retryDeviceRelease(release, () => true, wait);
    expect(release).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1000);
  });

  it('does not proceed to sign-out when release cannot be guaranteed', async () => {
    const signOut = vi.fn();
    const release = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(retryDeviceRelease(release, () => true, async () => undefined).then(signOut)).rejects.toThrow('offline');
    expect(release).toHaveBeenCalledTimes(3);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('allows a failed cleanup to be retried but never re-registers in between', async () => {
    const operations = createNotificationOperations(); operations.setScope('A');
    await expect(operations.release(async () => { throw new Error('offline'); })).rejects.toThrow();
    await expect(operations.run(async () => undefined)).rejects.toThrow();
    await expect(operations.release(async () => undefined)).resolves.toBeUndefined();
  });
});

describe('onboarding authoritative-success precedence', () => {
  it('removes a preparation timeout once server setup is ready', () => {
    expect(preparationRequestNotice({ stage: 'preparing_bank', completed: false }, 'timeout')?.tone).toBe('attention');
    expect(preparationRequestNotice({ stage: 'ready', completed: false }, 'timeout')).toBeNull();
    expect(preparationRequestNotice({ stage: 'complete', completed: true }, 'network')).toBeNull();
  });

  it('does not invent success for waiting data or an unavailable API', () => {
    expect(setupIsReady({ stage: 'preparing_bank', completed: false })).toBe(false);
    expect(preparationRequestNotice(null, 'timeout')).toMatchObject({ tone: 'error' });
    expect(preparationRequestNotice({ stage: 'preparing_bank', completed: false }, 'unknown')).toMatchObject({ tone: 'error' });
  });

  it('older reload completion cannot replace a newer success', () => {
    const requests = createRequestGeneration();
    const old = requests.begin();
    const fresh = requests.begin();
    expect(old()).toBe(false); expect(fresh()).toBe(true);
    requests.invalidate(); expect(fresh()).toBe(false);
    expect(requests.begin()()).toBe(true);
  });
});
