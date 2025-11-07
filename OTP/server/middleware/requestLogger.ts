import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'otp-leads-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory might already exist
}

export interface RequestLog {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  ipAddress: string;
  userId?: string;
  responseTime: number;
  statusCode: number;
  contentLength?: number;
  error?: string;
}

// Request logger middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = uuidv4();
  
  // Add request ID to request object for tracking
  (req as any).requestId = requestId;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Capture response data
  let responseBody: any = undefined;
  const originalJson = res.json;
  
  res.json = function(body) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const contentLength = res.get('content-length');
    
    const logData: RequestLog = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userId: (req as any).user?.userId,
      responseTime,
      statusCode: res.statusCode,
      contentLength: contentLength ? parseInt(contentLength) : undefined,
      error: responseBody?.error || (res.statusCode >= 400 ? 'Request failed' : undefined)
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('Server Error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Client Error', logData);
    } else if (responseTime > 5000) {
      logger.warn('Slow Request', logData);
    } else {
      logger.info('Request Completed', logData);
    }
  });

  // Log request start
  logger.info('Request Started', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userId: (req as any).user?.userId
  });

  next();
};

// Error logging helper
export const logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    error: error.message,
    stack: error.stack,
    context
  });
};

// Security event logging
export const logSecurityEvent = (event: string, details: any) => {
  logger.warn('Security Event', {
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info('Performance Metric', {
    operation,
    duration,
    metadata
  });
};

// Database query logging
export const logDatabaseQuery = (query: string, duration: number, error?: Error) => {
  if (error) {
    logger.error('Database Query Failed', {
      query: query.substring(0, 200), // Truncate long queries
      duration,
      error: error.message
    });
  } else if (duration > 1000) {
    logger.warn('Slow Database Query', {
      query: query.substring(0, 200),
      duration
    });
  } else {
    logger.debug('Database Query', {
      query: query.substring(0, 100),
      duration
    });
  }
};

export default logger;