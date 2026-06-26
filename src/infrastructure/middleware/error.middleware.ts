import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/infrastructure/utils/errors.util';
import { ResponseUtil } from '@/infrastructure/utils/response.util';
import { createLogger } from '@/infrastructure/utils/logger.util';

const logger = createLogger('ErrorHandler');

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('Unhandled error', { message, stack, type: typeof err });

  if (err instanceof ZodError) {
    return ResponseUtil.error(res, 'Validation failed', 422, 'VALIDATION_ERROR', err.errors);
  }

  if (err instanceof AppError) {
    return ResponseUtil.error(res, err.message, err.statusCode, err.code || 'APP_ERROR', err.details);
  }

  return ResponseUtil.error(res, message || 'Internal Server Error', 500);
}

export function notFoundHandler(_req: Request, res: Response) {
  ResponseUtil.error(res, 'Route not found', 404);
}
