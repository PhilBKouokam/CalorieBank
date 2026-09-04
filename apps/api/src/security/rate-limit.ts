import type { RequestHandler } from 'express';

import { AppError } from '../errors';

type Bucket = { count: number; resetsAt: number };

export function createRateLimit(options: { limit: number; windowMs: number; operation: string }): RequestHandler {
  const buckets = new Map<string, Bucket>();
  return (req, res, next) => {
    const userId = res.locals.currentUser?.id;
    const key = userId ? `user:${userId}` : `ip:${req.ip}`;
    const now = Date.now();
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetsAt <= now
      ? { count: 0, resetsAt: now + options.windowMs }
      : existing;
    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader('RateLimit-Limit', String(options.limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, options.limit - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetsAt / 1000)));
    if (bucket.count > options.limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetsAt - now) / 1000))));
      return next(new AppError('Too many requests. Try again later.', 429, {
        code: 'RATE_LIMITED', operation: options.operation,
      }));
    }
    next();
  };
}
