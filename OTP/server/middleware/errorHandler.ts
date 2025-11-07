import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { errorLogs } from '../shared/production-schema';
import { v4 as uuidv4 } from 'uuid';
import { logError } from './requestLogger';

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  isOperational?: boolean;
  code?: string;
}

// Error handler middleware
export const errorHandler = async (
  err: AppError, 
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    logError(err, { 
      context: 'error-handler', 
      middleware: 'errorHandler',
      severity: 'error',
      metadata: { 
        errorType: err.name,
        errorMessage: err.message,
        stack: err.stack 
      }
    });
  }

  // Generate error ID for tracking
  const errorId = uuidv4();

  try {
    // Log error to database
    await db.insert(errorLogs).values({
      id: errorId,
      errorType: err.name || 'UnknownError',
      errorMessage: err.message || 'Unknown error occurred',
      errorStack: err.stack || '',
      requestUrl: req.originalUrl,
      requestMethod: req.method,
      requestHeaders: JSON.stringify(req.headers),
      requestBody: JSON.stringify(req.body),
      userAgent: req.get('User-Agent') || '',
      ipAddress: req.ip || req.connection.remoteAddress || '',
      userId: (req as any).user?.userId || null,
      severity: error.statusCode?.toString().startsWith('4') ? 'warning' : 'error'
    });
  } catch (logError) {
    const logger = require('./requestLogger');
    logger.logError(logError as Error, { 
      context: 'error-handler', 
      middleware: 'errorHandler',
      severity: 'error',
      metadata: { 
        originalError: err.message,
        errorId: errorId
      }
    });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 } as AppError;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 } as AppError;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {}).map((val: any) => val.message).join(', ');
    error = { message, statusCode: 400 } as AppError;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 } as AppError;
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 } as AppError;
  }

  // Rate limit errors
  if (err.status === 429) {
    const message = 'Too many requests, please try again later';
    error = { message, statusCode: 429 } as AppError;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    errorId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Async error handler wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Not found error handler
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not found - ${req.originalUrl}`) as AppError;
  error.statusCode = 404;
  next(error);
};