import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const SENSITIVE_KEY = /authorization|cookie|token|secret|password|health.*sample|raw.*payload/i;

export function redactLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLogValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactLogValue(item),
  ]));
}

export function structuredLog(level: 'info' | 'warn' | 'error', event: string, metadata: Record<string, unknown> = {}) {
  const line = JSON.stringify(redactLogValue({ level, event, ...metadata }));
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const requestId = req.header('x-request-id')?.slice(0, 128) || randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    structuredLog('info', 'request_completed', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
      });
  });

  next();
};
