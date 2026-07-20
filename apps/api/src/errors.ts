import type { ErrorRequestHandler, RequestHandler } from 'express';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Unexpected server error';

  if (statusCode >= 500) {
    console.error(
      JSON.stringify({
        level: 'error',
        message,
      }),
    );
  }

  res.status(statusCode).json({
    error: {
      message: statusCode >= 500 ? 'Internal server error' : message,
    },
  });
};
