import type { ErrorRequestHandler, RequestHandler } from 'express';
import { structuredLog } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Unexpected server error';

  if (statusCode >= 500) {
    structuredLog('error', 'request_failed', {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      errorCategory: error instanceof AppError ? error.name : 'UnexpectedError',
    });
  }

  res.status(statusCode).json({
    error: {
      message: statusCode >= 500 ? 'Internal server error' : message,
      ...(error instanceof AppError && error.details ? { details: error.details } : {}),
    },
  });
};
