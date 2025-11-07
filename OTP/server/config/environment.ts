import { z } from 'zod';

// Environment variable validation schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Server configuration
  PORT: z.string().default('3001'),
  HOST: z.string().default('localhost'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // Email configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587'),
  SMTP_SECURE: z.string().transform(val => val === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().default('OTP System'),
  
  // Redis (for rate limiting)
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z.string().transform(val => val === 'true').default('true'),
  
  // Security
  BCRYPT_ROUNDS: z.string().default('12'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: z.string().transform(val => val === 'true').default('false'),
  
  // File uploads
  MAX_FILE_SIZE: z.string().default('10485760'), // 10MB
  UPLOAD_DIR: z.string().default('./uploads'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_DIR: z.string().default('./logs'),
  
  // Health monitoring
  HEALTH_CHECK_INTERVAL: z.string().default('300000'), // 5 minutes
  METRICS_RETENTION_DAYS: z.string().default('30'),
  
  // Error tracking (optional)
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  
  // Analytics (optional)
  ANALYTICS_ENABLED: z.string().transform(val => val === 'true').default('false'),
  
  // Backup
  BACKUP_ENABLED: z.string().transform(val => val === 'true').default('false'),
  BACKUP_SCHEDULE: z.string().default('0 2 * * *'), // Daily at 2 AM
  BACKUP_RETENTION_DAYS: z.string().default('30'),
  
  // SSL/TLS
  SSL_ENABLED: z.string().transform(val => val === 'true').default('false'),
  SSL_CERT_PATH: z.string().optional(),
  SSL_KEY_PATH: z.string().optional(),
  
  // Vercel specific
  VERCEL_URL: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  
  // Supabase (if using Supabase for more than just database)
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_PROJECT_URL: z.string().optional(),
  
  // Admin
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  
  // Feature flags
  FEATURE_EMAIL_VERIFICATION: z.string().transform(val => val === 'true').default('true'),
  FEATURE_RATE_LIMITING: z.string().transform(val => val === 'true').default('true'),
  FEATURE_AUDIT_LOGGING: z.string().transform(val => val === 'true').default('true'),
  FEATURE_HEALTH_MONITORING: z.string().transform(val => val === 'true').default('true'),
  FEATURE_BACKUP: z.string().transform(val => val === 'true').default('false'),
});

// Parse and validate environment variables
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Environment validation failed:');
    error.errors.forEach(err => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// Configuration object with typed values
export const config = {
  // Environment
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  // Server
  port: parseInt(env.PORT, 10),
  host: env.HOST,
  
  // Database
  database: {
    url: env.DATABASE_URL,
  },
  
  // JWT
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  
  // Email
  email: {
    smtp: {
      host: env.SMTP_HOST,
      port: parseInt(env.SMTP_PORT, 10),
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    from: env.EMAIL_FROM,
    fromName: env.EMAIL_FROM_NAME,
  },
  
  // Redis
  redis: {
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT, 10),
    password: env.REDIS_PASSWORD,
  },
  
  // CORS
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: env.CORS_CREDENTIALS,
  },
  
  // Security
  security: {
    bcryptRounds: parseInt(env.BCRYPT_ROUNDS, 10),
    sessionSecret: env.SESSION_SECRET,
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
    skipSuccessfulRequests: env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
  },
  
  // File uploads
  uploads: {
    maxFileSize: parseInt(env.MAX_FILE_SIZE, 10),
    uploadDir: env.UPLOAD_DIR,
  },
  
  // Logging
  logging: {
    level: env.LOG_LEVEL,
    dir: env.LOG_DIR,
  },
  
  // Health monitoring
  health: {
    checkInterval: parseInt(env.HEALTH_CHECK_INTERVAL, 10),
    metricsRetentionDays: parseInt(env.METRICS_RETENTION_DAYS, 10),
  },
  
  // Error tracking
  sentry: {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
  },
  
  // Analytics
  analytics: {
    enabled: env.ANALYTICS_ENABLED,
  },
  
  // Backup
  backup: {
    enabled: env.BACKUP_ENABLED,
    schedule: env.BACKUP_SCHEDULE,
    retentionDays: parseInt(env.BACKUP_RETENTION_DAYS, 10),
  },
  
  // SSL/TLS
  ssl: {
    enabled: env.SSL_ENABLED,
    certPath: env.SSL_CERT_PATH,
    keyPath: env.SSL_KEY_PATH,
  },
  
  // Vercel
  vercel: {
    url: env.VERCEL_URL,
    env: env.VERCEL_ENV,
  },
  
  // Supabase
  supabase: {
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    projectUrl: env.SUPABASE_PROJECT_URL,
  },
  
  // Admin
  admin: {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  },
  
  // Feature flags
  features: {
    emailVerification: env.FEATURE_EMAIL_VERIFICATION,
    rateLimiting: env.FEATURE_RATE_LIMITING,
    auditLogging: env.FEATURE_AUDIT_LOGGING,
    healthMonitoring: env.FEATURE_HEALTH_MONITORING,
    backup: env.FEATURE_BACKUP,
  },
};

// Validate required environment variables based on configuration
export function validateEnvironment(): void {
  const errors: string[] = [];
  
  // Check required variables based on feature flags
  if (config.features.emailVerification && !config.email.smtp.host) {
    errors.push('SMTP_HOST is required when email verification is enabled');
  }
  
  if (config.features.emailVerification && !config.email.from) {
    errors.push('EMAIL_FROM is required when email verification is enabled');
  }
  
  if (config.features.rateLimiting && !config.redis.url && !config.redis.host) {
    errors.push('REDIS_URL or REDIS_HOST is required when rate limiting is enabled');
  }
  
  if (config.backup.enabled && !config.database.url) {
    errors.push('DATABASE_URL is required when backup is enabled');
  }
  
  if (config.ssl.enabled && (!config.ssl.certPath || !config.ssl.keyPath)) {
    errors.push('SSL_CERT_PATH and SSL_KEY_PATH are required when SSL is enabled');
  }
  
  if (errors.length > 0) {
    console.error('Environment validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
}

// Environment-specific configurations
export const getEnvironmentConfig = () => {
  switch (config.env) {
    case 'production':
      return {
        cors: {
          origin: [
            'https://your-domain.com',
            'https://www.your-domain.com',
            'https://*.vercel.app',
            ...(config.vercel.url ? [`https://${config.vercel.url}`] : []),
          ],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-API-Key',
            'X-Request-ID',
          ],
        },
        security: {
          helmet: {
            contentSecurityPolicy: {
              directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "https://api.your-domain.com"],
              },
            },
            hsts: {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            },
          },
        },
        rateLimit: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100, // limit each IP to 100 requests per windowMs
          message: 'Too many requests from this IP, please try again later.',
          standardHeaders: true,
          legacyHeaders: false,
        },
      };
      
    case 'development':
      return {
        cors: {
          origin: [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
          ],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-API-Key',
            'X-Request-ID',
          ],
        },
        security: {
          helmet: {
            contentSecurityPolicy: false,
            hsts: false,
          },
        },
        rateLimit: {
          windowMs: 15 * 60 * 1000,
          max: 1000, // More lenient in development
          message: 'Too many requests from this IP, please try again later.',
          standardHeaders: true,
          legacyHeaders: false,
        },
      };
      
    case 'test':
      return {
        cors: {
          origin: ['http://localhost:3000'],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization'],
        },
        security: {
          helmet: false,
        },
        rateLimit: {
          windowMs: 60 * 1000,
          max: 10000, // Very high limit for tests
        },
      };
      
    default:
      return {
        cors: {
          origin: ['http://localhost:3000'],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization'],
        },
        security: {
          helmet: false,
        },
        rateLimit: {
          windowMs: 15 * 60 * 1000,
          max: 1000,
        },
      };
  }
};

export default config;