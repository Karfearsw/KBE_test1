import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { auditLogs } from '../shared/production-schema';
import { v4 as uuidv4 } from 'uuid';
import { logError } from './requestLogger';

interface ActivityLogData {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export async function logActivity(data: ActivityLogData): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: uuidv4(),
      userId: data.userId || null,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      metadata: data.metadata || {},
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'activity-logging', 
      middleware: 'logActivity',
      severity: 'error',
      metadata: { userId: data.userId, action: data.action }
    });
    // Don't throw - activity logging should not break the main flow
  }
}

export function activityLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Store original send function
  const originalSend = res.send;
  
  // Override send function to capture response
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    
    // Log activity after response is sent
    setImmediate(async () => {
      try {
        const userId = (req as any).user?.userId;
        const action = `${req.method} ${req.route?.path || req.path}`;
        const resourceType = req.route?.path?.split('/')[1] || 'unknown';
        
        await logActivity({
          userId,
          action,
          resourceType,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          metadata: {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.get('User-Agent'),
          },
        });
      } catch (error) {
        logError(error as Error, { 
          context: 'activity-logging', 
          middleware: 'activityLogger',
          severity: 'warning',
          metadata: { userId: (req as any).user?.userId, action: `${req.method} ${req.route?.path || req.path}`, url: req.url }
        });
      }
    });
    
    // Call original send function
    return originalSend.call(this, body);
  };
  
  next();
}

export default activityLogger;