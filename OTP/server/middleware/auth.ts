import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, apiKeys } from '../shared/production-schema';
import { eq, and, gt } from 'drizzle-orm';
import { logError } from '../utils/logger';
import jwt from 'jsonwebtoken';
import config from '../config/environment';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
  apiKey?: {
    id: string;
    name: string;
    permissions: string[];
  };
}

// JWT token validation (simplified - in production use proper JWT library)
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'NO_TOKEN'
      });
    }

    try {
      // Verify JWT token
      const payload = jwt.verify(token, config.jwt.secret) as any;
      
      // Check token expiration (jwt.verify already validates exp, but double-check)
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return res.status(401).json({ 
          error: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }

      // Verify user still exists and is active
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          isActive: users.isActive
        })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (!user || !user.isActive) {
        return res.status(401).json({ 
          error: 'Invalid or inactive user',
          code: 'INVALID_USER'
        });
      }

      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      next();
    } catch (error) {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    logError(error as Error, { 
      context: 'authentication', 
      middleware: 'authenticateToken',
      severity: 'error'
    });
    res.status(500).json({ 
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// API key authentication
export const authenticateApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required',
        code: 'NO_API_KEY'
      });
    }

    try {
      // Find valid API key
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(and(
          eq(apiKeys.key, apiKey),
          eq(apiKeys.isActive, true),
          gt(apiKeys.expiresAt, new Date())
        ))
        .limit(1);

      if (!keyRecord) {
        return res.status(401).json({ 
          error: 'Invalid or expired API key',
          code: 'INVALID_API_KEY'
        });
      }

      // Update last used timestamp
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, keyRecord.id));

      req.apiKey = {
        id: keyRecord.id,
        name: keyRecord.name,
        permissions: keyRecord.permissions
      };

      next();
    } catch (error) {
      return res.status(401).json({ 
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }
  } catch (error) {
    logError(error as Error, { 
      context: 'authentication', 
      middleware: 'authenticateApiKey',
      severity: 'error'
    });
    res.status(500).json({ 
      error: 'API key authentication failed',
      code: 'API_AUTH_FAILED'
    });
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Permission-based authorization for API keys
export const requireApiPermission = (requiredPermission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ 
        error: 'API key authentication required',
        code: 'API_AUTH_REQUIRED'
      });
    }

    const hasPermission = req.apiKey.permissions.includes(requiredPermission) || 
                         req.apiKey.permissions.includes('*'); // Wildcard permission

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'API key lacks required permission',
        code: 'INSUFFICIENT_API_PERMISSIONS',
        required: requiredPermission,
        available: req.apiKey.permissions
      });
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token provided
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const payload = jwt.verify(token, config.jwt.secret) as any;
        
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          return next(); // Token expired, continue without auth
        }

        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            role: users.role,
            isActive: users.isActive
          })
          .from(users)
          .where(eq(users.id, payload.userId))
          .limit(1);

        if (user && user.isActive) {
          req.user = {
            userId: user.id,
            email: user.email,
            role: user.role
          };
        }
      } catch (error) {
        // Invalid token, continue without auth
      }
    }

    next();
  } catch (error) {
    next(); // Continue without auth on error
  }
};

export default {
  authenticateToken,
  authenticateApiKey,
  requireRole,
  requireApiPermission,
  optionalAuth
};