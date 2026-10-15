import express from 'express';
import request from 'supertest';
import { expect, it } from 'vitest';
import { dailyBankTargetResponseSchema } from '@caloriebank/schemas';
import { settingsOptions } from '../src/modules/settings-concurrency/settings-concurrency';
import { errorHandler } from '../src/errors';
const app = express();
app.get('/', (req, res) => { const options = settingsOptions(req, res); options?.onRevision?.('4'); res.json({ calories: 100, chosen: true }); });
app.put('/', (req, res) => { const options = settingsOptions(req, res, true); res.json({ expected: options?.expectedRevision ?? null }); });
app.use(errorHandler);
it('legacy strict response remains unchanged while capable reads receive revision headers', async () => {
  const legacy = await request(app).get('/').expect(200);
  expect(dailyBankTargetResponseSchema.safeParse(legacy.body).success).toBe(true);
  expect(legacy.body).toEqual({ calories: 100, chosen: true });
  expect(legacy.headers['x-cb-settings-revision']).toBeUndefined();
  const capable = await request(app).get('/').set('X-CB-Settings-Concurrency', '1').expect(200);
  expect(capable.body).toEqual(legacy.body); expect(capable.headers['x-cb-settings-revision']).toBe('4');
});
it('legacy writes remain allowed; capable writes require a single valid expected revision', async () => {
  expect((await request(app).put('/').expect(200)).body.expected).toBeNull();
  await request(app).put('/').set('X-CB-Settings-Concurrency', '1').expect(428);
  for (const value of ['*', 'W/"1"', '"1", "2"', '-1', '"01"']) {
    await request(app).put('/').set('X-CB-Settings-Concurrency', '1').set('If-Match', value).expect(428);
  }
  const valid = await request(app).put('/').set('X-CB-Settings-Concurrency', '1').set('If-Match', '"4"').expect(200);
  expect(valid.body.expected).toBe('4');
  await request(app).put('/').set('If-Match', '"4"').expect(400);
});
