import { Request, Response, NextFunction } from 'express';

// CORS configuration for production deployment
export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
}

// Production CORS configuration
const productionCorsConfig: CorsConfig = {
  allowedOrigins: [
    // Vercel production domains
    'https://otpleads.vercel.app',
    'https://www.otpleads.com',
    'https://otpleads.com',
    // Add your custom domains here
    ...(process.env.ALLOWED_ORIGINS?.split(',') || [])
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Accept-Version',
    'Content-Length',
    'Content-MD5',
    'Date',
    'X-Api-Version',
    'X-CSRF-Token',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID',
    'X-Total-Count',
    'X-Page-Count'
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Development CORS configuration
const developmentCorsConfig: CorsConfig = {
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:5173', // Vite default port
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['*'], // Allow all headers in development
  exposedHeaders: ['*'],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Get appropriate CORS configuration based on environment
export const getCorsConfig = (): CorsConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  return isDevelopment ? developmentCorsConfig : productionCorsConfig;
};

// CORS middleware factory
export const createCorsMiddleware = (config: CorsConfig) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const isAllowedOrigin = config.allowedOrigins.includes(origin || '') || 
                           config.allowedOrigins.includes('*');

    // Set CORS headers
    if (isAllowedOrigin && origin) {
      res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    res.header('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
    res.header('Access-Control-Allow-Credentials', String(config.credentials));
    res.header('Access-Control-Max-Age', String(config.maxAge));

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
      res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
      res.header('Access-Control-Max-Age', String(config.maxAge));
      res.status(config.optionsSuccessStatus).send();
      return;
    }

    next();
  };
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('X-DNS-Prefetch-Control', 'off');
  res.header('X-Download-Options', 'noopen');
  res.header('X-Permitted-Cross-Domain-Policies', 'none');

  // Content Security Policy (CSP)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.supabase.io https://*.supabase.co wss://*.supabase.co",
    "media-src 'self'",
    "object-src 'none'",
    "child-src 'none'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  res.header('Content-Security-Policy', cspDirectives);

  // Feature Policy
  res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  next();
};

// Request ID middleware for tracking
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || 
                   req.headers['x-amzn-trace-id'] || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-request-id'] = requestId as string;
  res.header('X-Request-ID', requestId as string);
  
  next();
};

// Rate limiting headers middleware
export const rateLimitHeaders = (limit: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.header('X-RateLimit-Limit', String(limit));
    res.header('X-RateLimit-Window', String(windowMs));
    next();
  };
};

// CORS configuration validator
export const validateCorsConfig = (config: CorsConfig): boolean => {
  if (!config.allowedOrigins || config.allowedOrigins.length === 0) {
    throw new Error('CORS: allowedOrigins cannot be empty');
  }
  
  if (!config.allowedMethods || config.allowedMethods.length === 0) {
    throw new Error('CORS: allowedMethods cannot be empty');
  }
  
  if (!config.allowedHeaders || config.allowedHeaders.length === 0) {
    throw new Error('CORS: allowedHeaders cannot be empty');
  }
  
  if (config.maxAge < 0) {
    throw new Error('CORS: maxAge must be non-negative');
  }
  
  return true;
};

// Export corsMiddleware for backward compatibility
export const corsMiddleware = createCorsMiddleware(getCorsConfig());