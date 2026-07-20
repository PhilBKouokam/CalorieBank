import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';

describe('GET /health', () => {
  it('returns the API health response', async () => {
    const response = await request(createApp()).get('/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'caloriebank-api',
    });
  });
});
