import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { Request, Response } from 'express';
import { logError } from './requestLogger';

// Redis client for distributed rate limiting
let redisClient: Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    redisClient.on('error', (err) => {
      logError(err, { 
        context: 'rate-limiting', 
        middleware: 'rateLimiter',
        severity: 'error',
        metadata: { redis: 'connection-error' }
      });
    });

    redisClient.on('connect', () => {
      console.log('Redis connected for rate limiting');
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'rate-limiting', 
      middleware: 'rateLimiter',
      severity: 'error',
      metadata: { redis: 'connection-failed' }
    });
    redisClient = null;
  }
}

// General API rate limiter
export const rateLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args as any),
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

// Strict rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args as any),
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

// Email sending rate limiter
export const emailRateLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args as any),
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 email requests per hour
  message: {
    error: 'Too many email requests, please try again later.',
    code: 'EMAIL_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many email requests, please try again later.',
      code: 'EMAIL_RATE_LIMIT_EXCEEDED',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

// Admin panel rate limiter
export const adminRateLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args as any),
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 admin requests per windowMs
  message: {
    error: 'Too many admin requests, please try again later.',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many admin requests, please try again later.',
      code: 'ADMIN_RATE_LIMIT_EXCEEDED',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

// API key rate limiter (per API key)
export const apiKeyRateLimiter = rateLimit({
  store: redisClient ? new RedisStore({
    sendCommand: (...args: string[]) => redisClient!.sendCommand(args as any),
  }) : undefined,
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // limit each API key to 1000 requests per minute
  message: {
    error: 'API key rate limit exceeded, please try again later.',
    code: 'API_KEY_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.headers['x-api-key'] as string || req.ip;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'API key rate limit exceeded, please try again later.',
      code: 'API_KEY_RATE_LIMIT_EXCEEDED',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

// WebSocket rate limiter helper
export const checkWebSocketRateLimit = async (ip: string): Promise<boolean> => {
  if (!redisClient) return true; // Skip rate limiting if Redis is not available
  
  const key = `ws_rate_limit:${ip}`;
  const current = await redisClient.incr(key);
  
  if (current === 1) {
    await redisClient.expire(key, 60); // 1 minute window
  }
  
  return current <= 100; // 100 WebSocket connections per minute
};

// Cleanup function for graceful shutdown
export const cleanupRateLimiters = async () => {
  if (redisClient) {
    await redisClient.quit();
  }
};

// Export apiRateLimiter for backward compatibility
export const apiRateLimiter = rateLimiter;

export default {
  rateLimiter,
  apiRateLimiter,
  authRateLimiter,
  emailRateLimiter,
  adminRateLimiter,
  apiKeyRateLimiter,
  checkWebSocketRateLimit,
  cleanupRateLimiters
};