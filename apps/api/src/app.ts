import cors from 'cors';
import express from 'express';

import type { ApiEnv } from './env';
import { env } from './env';
import { errorHandler, notFoundHandler } from './errors';
import { requestLogger } from './logger';

export function createApp(config: ApiEnv = env) {
  const app = express();

  app.use(
    cors({
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
    }),
  );
  app.use(express.json());
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'caloriebank-api',
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
