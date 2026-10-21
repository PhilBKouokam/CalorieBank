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
  // Never copy arbitrary caller text into hosted diagnostics or response headers.
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route: unknown = req.route;
    const path = route && typeof route === 'object' && 'path' in route && typeof route.path === 'string'
      ? route.path : 'unmatched';

    structuredLog('info', 'request_completed', {
        requestId,
        method: req.method,
        // Server-registered template only: raw paths can contain health dates or IDs.
        path,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
      });
  });

  next();
};
