import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Global error handler middleware
 */
export function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', {
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation-error',
      message: 'Invalid request data',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        res.status(409).json({
          error: 'conflict',
          message: 'A record with this value already exists',
          field: (err.meta?.target as string[])?.[0],
        });
        return;
      case 'P2025': // Record not found
        res.status(404).json({
          error: 'not-found',
          message: 'Record not found',
        });
        return;
      case 'P2003': // Foreign key constraint violation
        res.status(400).json({
          error: 'bad-request',
          message: 'Referenced record does not exist',
        });
        return;
      default:
        res.status(500).json({
          error: 'database-error',
          message: 'Database operation failed',
        });
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: 'validation-error',
      message: 'Invalid data provided',
    });
    return;
  }

  // Custom app errors
  if (err.statusCode) {
    res.status(err.statusCode).json({
      error: err.code || 'error',
      message: err.message,
    });
    return;
  }

  // Default error
  res.status(500).json({
    error: 'internal-error',
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'An unexpected error occurred',
  });
}

/**
 * Create a custom app error
 */
export function createError(
  statusCode: number,
  code: string,
  message: string
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

/**
 * 404 handler for unknown routes
 */
export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({
    error: 'not-found',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

export default { errorMiddleware, createError, notFoundMiddleware };
