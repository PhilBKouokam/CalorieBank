import express, { Router } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestLogger } from '../src/logger';

afterEach(() => vi.restoreAllMocks());

describe('hosted request diagnostic privacy', () => {
  it('keeps registered route templates and operational results, excluding dates, queries and caller request IDs', async () => {
    const logs = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const app = express();
    const router = Router();
    app.use(requestLogger);
    router.get('/bank-history/:logDate', (_req, res) => { res.json({ ok: true }); });
    app.use('/v1/me', router);
    const response = await request(app).get('/v1/me/bank-history/2026-10-01?intake=8765')
      .set('x-request-id', 'private health value 4321').expect(200);
    const event = JSON.parse(String(logs.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(event).toMatchObject({ event: 'request_completed', method: 'GET', path: '/bank-history/:logDate', statusCode: 200 });
    expect(event.durationMs).toEqual(expect.any(Number));
    expect(event.requestId).toBe(response.headers['x-request-id']);
    expect(event.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(event)).not.toMatch(/2026-10-01|8765|4321|private health/);
  });

  it('does not fall back to a sensitive raw path when authentication stops routing', async () => {
    const logs = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const app = express();
    app.use(requestLogger);
    app.use((_req, res) => { res.sendStatus(401); });
    await request(app).get('/v1/me/bank-history/2026-10-01?sensitive=8765').expect(401);
    const event = JSON.parse(String(logs.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(event).toMatchObject({ path: 'unmatched', statusCode: 401 });
    expect(JSON.stringify(event)).not.toMatch(/2026-10-01|8765|sensitive/);
  });

  it('does not log unmatched attacker-supplied paths', async () => {
    const logs = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const app = express();
    app.use(requestLogger);
    await request(app).get('/private-source-8765/2026-10-01').expect(404);
    expect(JSON.parse(String(logs.mock.calls[0]?.[0]))).toMatchObject({ path: 'unmatched', statusCode: 404 });
    expect(JSON.stringify(logs.mock.calls)).not.toMatch(/private-source|2026-10-01|8765/);
  });

  it('keeps the callback category without authorization codes or state', async () => {
    const logs = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const app = express();
    app.use(requestLogger);
    app.get('/v1/me/integrations/fitbit/callback', (_req, res) => { res.sendStatus(400); });
    await request(app).get('/v1/me/integrations/fitbit/callback?code=private-code&state=private-state').expect(400);
    expect(JSON.parse(String(logs.mock.calls[0]?.[0]))).toMatchObject({ path: '/v1/me/integrations/fitbit/callback', statusCode: 400 });
    expect(JSON.stringify(logs.mock.calls)).not.toMatch(/private-code|private-state/);
  });
});
