import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { users, systemConfig, auditLogs, errorLogs, healthMetrics } from '../shared/production-schema';
import { eq, desc, sql, count } from 'drizzle-orm';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logActivity } from '../middleware/activityLogger';
import { logSecurityEvent } from '../middleware/requestLogger';

const router = Router();

// Apply authentication to all admin routes
router.use(authenticateToken);
router.use(requireRole(['admin', 'super_admin']));

// Validation schemas
const userUpdateSchema = z.object({
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
  isActive: z.boolean().optional(),
  isEmailVerified: z.boolean().optional()
});

const configUpdateSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  description: z.string().optional()
});

const bulkActionSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  action: z.enum(['activate', 'deactivate', 'delete'])
});

// Get system dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    
    // Get user statistics
    const userStats = await db
      .select({
        total: count(users.id),
        active: count(sql`CASE WHEN is_active = true THEN 1 END`),
        verified: count(sql`CASE WHEN is_email_verified = true THEN 1 END`),
        admins: count(sql`CASE WHEN role IN ('admin', 'super_admin') THEN 1 END`)
      })
      .from(users);

    // Get recent users
    const recentUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        isEmailVerified: users.isEmailVerified,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(10);

    // Get system health metrics (last 24 hours)
    const healthData = await db
      .select()
      .from(healthMetrics)
      .where(sql`created_at > NOW() - INTERVAL '24 hours'`)
      .orderBy(desc(healthMetrics.createdAt))
      .limit(100);

    // Get recent error logs
    const recentErrors = await db
      .select()
      .from(errorLogs)
      .where(sql`created_at > NOW() - INTERVAL '24 hours'`)
      .orderBy(desc(errorLogs.createdAt))
      .limit(10);

    // Get recent audit logs
    const recentActivity = await db
      .select()
      .from(auditLogs)
      .where(sql`created_at > NOW() - INTERVAL '24 hours'`)
      .orderBy(desc(auditLogs.createdAt))
      .limit(20);

    // Calculate system status
    const systemStatus = {
      overall: 'healthy',
      database: recentErrors.length < 5 ? 'healthy' : recentErrors.length < 10 ? 'warning' : 'critical',
      performance: healthData.length > 0 ? 'healthy' : 'unknown'
    };

    // Log admin dashboard access
    await logActivity({
      userId,
      action: 'admin_dashboard_viewed',
      resource: 'admin',
      resourceId: 'dashboard',
      details: { userRole: (req as any).user.role }
    });

    res.json({
      stats: {
        users: userStats[0],
        system: {
          status: systemStatus,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        }
      },
      recentUsers,
      healthData,
      recentErrors,
      recentActivity,
      systemStatus
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'admin-routes', 
      route: 'dashboard',
      severity: 'error',
      metadata: { userId: (req as any).user?.userId }
    });
    res.status(500).json({
      error: 'Failed to load dashboard data',
      code: 'DASHBOARD_ERROR'
    });
  }
});

// Get all users with pagination
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;

    const offset = (page - 1) * limit;

    let whereConditions = [];
    
    if (search) {
      whereConditions.push(sql`(
        ${users.email} ILIKE ${`%${search}%`} OR
        ${users.firstName} ILIKE ${`%${search}%`} OR
        ${users.lastName} ILIKE ${`%${search}%`}
      )`);
    }
    
    if (role) {
      whereConditions.push(eq(users.role, role));
    }
    
    if (status) {
      switch (status) {
        case 'active':
          whereConditions.push(eq(users.isActive, true));
          break;
        case 'inactive':
          whereConditions.push(eq(users.isActive, false));
          break;
        case 'verified':
          whereConditions.push(eq(users.isEmailVerified, true));
          break;
        case 'unverified':
          whereConditions.push(eq(users.isEmailVerified, false));
          break;
      }
    }

    const whereClause = whereConditions.length > 0 
      ? sql.join(whereConditions, sql` AND `)
      : sql`1=1`;

    // Get total count
    const [totalCount] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    // Get users
    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        isEmailVerified: users.isEmailVerified,
        company: users.company,
        phone: users.phone,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
        emailVerifiedAt: users.emailVerifiedAt
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      users: userList,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit)
      }
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'admin-routes', 
      route: 'users',
      severity: 'error',
      metadata: { userId: (req as any).user?.userId }
    });
    res.status(500).json({
      error: 'Failed to load users',
      code: 'USERS_LIST_ERROR'
    });
  }
});

// Get single user details
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        isEmailVerified: users.isEmailVerified,
        company: users.company,
        phone: users.phone,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
        emailVerifiedAt: users.emailVerifiedAt,
        lastPasswordChange: users.passwordResetAt
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Get user activity
    const userActivity = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(20);

    res.json({
      user,
      activity: userActivity
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'admin-routes', 
      route: 'user-details',
      severity: 'error',
      metadata: { userId: (req as any).user?.userId, targetUserId: req.params.id }
    });
    res.status(500).json({
      error: 'Failed to load user details',
      code: 'USER_DETAILS_ERROR'
    });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = userUpdateSchema.parse(req.body);
    const adminUserId = (req as any).user.userId;

    const [updatedUser] = await db
      .update(users)
      .set(validatedData)
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Log admin action
    await logActivity({
      userId: adminUserId,
      action: 'user_updated',
      resource: 'users',
      resourceId: id,
      details: validatedData
    });

    logSecurityEvent('user_updated', {
      adminId: adminUserId,
      targetUserId: id,
      changes: validatedData
    });

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    logError(error as Error, { 
      context: 'admin-routes', 
      route: 'update-user',
      severity: 'error',
      metadata: { userId: (req as any).user?.userId, targetUserId: req.params.id }
    });
    res.status(500).json({
      error: 'Failed to update user',
      code: 'USER_UPDATE_ERROR'
    });
  }
});

// Bulk user actions
router.post('/users/bulk-action', async (req, res) => {
  try {
    const { userIds, action } = bulkActionSchema.parse(req.body);
    const adminUserId = (req as any).user.userId;

    let updateData: any = {};
    
    switch (action) {
      case 'activate':
        updateData.isActive = true;
        break;
      case 'deactivate':
        updateData.isActive = false;
        break;
      case 'delete':
        updateData.isActive = false;
        updateData.deletedAt = new Date();
        break;
    }

    const updatedUsers = await db
      .update(users)
      .set(updateData)
      .where(sql`id IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`)
      .returning();

    // Log bulk action
    await logActivity({
      userId: adminUserId,
      action: 'bulk_user_action',
      resource: 'users',
      resourceId: 'bulk',
      details: { action, userIds, count: updatedUsers.length }
    });

    logSecurityEvent('bulk_user_action', {
      adminId: adminUserId,
      action,
      userCount: updatedUsers.length
    });

    res.json({
      message: `Bulk action completed successfully`,
      action,
      affectedUsers: updatedUsers.length
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    logError(error as Error, { 
      context: 'admin-routes', 
      route: 'bulk-action',
      severity: 'error',
      metadata: { userId: (req as any).user?.userId }
    });
    res.status(500).json({
      error: 'Failed to perform bulk action',
      code: 'BULK_ACTION_ERROR'
    });
  }
});

// Get system configuration
router.get('/config', async (req, res) => {
  try {
    const config = await db
      .select()
      .from(systemConfig)
      .orderBy(desc(systemConfig.createdAt));

    const configMap = config.reduce((acc, item) => {
      acc[item.key] = {
        value: item.value,
        description: item.description,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
      return acc;
    }, {} as Record<string, any>);

    res.json({ config: configMap });
  } catch (error) {
    logError(error as Error, { 
      context: 'admin-routes', 
      route: 'config-fetch',
      severity: 'error',
      metadata: { userId: (req as any).user?.userId }
    });
    res.status(500).json({
      error: 'Failed to load system configuration',
      code: 'CONFIG_FETCH_ERROR'
    });
  }
});

// Update system configuration
router.put('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description, isActive } = req.body;
    const adminUserId = (req as any).user.userId;

    const [updatedConfig] = await db
      .insert(systemConfig)
      .values({
        key,
        value,
        description: description || '',
        isActive: isActive !== undefined ? isActive : true
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value,
          description: description || '',
          isActive: isActive !== undefined ? isActive : true,
          updatedAt: new Date()
        }
      })
      .returning();

    // Log configuration change
    await logActivity({
      userId: adminUserId,
      action: 'config_updated',
      resource: 'system_config',
      resourceId: key,
      details: { key, value, description, isActive }
    });

    logSecurityEvent('config_updated', {
      adminId: adminUserId,
      configKey: key,
      newValue: value
    });

    res.json({
      message: 'Configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'admin-routes', 
      route: 'config-update',
      severity: 'error',
      metadata: { userId: (req as any).user?.userId, configKey: req.params.key }
    });
    res.status(500).json({
      error: 'Failed to update configuration',
      code: 'CONFIG_UPDATE_ERROR'
    });
  }
});

// Get audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const userId = req.query.userId as string;
    const action = req.query.action as string;
    const resource = req.query.resource as string;

    const offset = (page - 1) * limit;

    let whereConditions = [];
    
    if (userId) {
      whereConditions.push(eq(auditLogs.userId, userId));
    }
    
    if (action) {
      whereConditions.push(eq(auditLogs.action, action));
    }
    
    if (resource) {
      whereConditions.push(eq(auditLogs.resource, resource));
    }

    const whereClause = whereConditions.length > 0 
      ? sql.join(whereConditions, sql` AND `)
      : sql`1=1`;

    // Get total count
    const [totalCount] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);

    // Get audit logs
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt
      })
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit)
      }
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'admin-routes', 
      route: 'audit-logs',
      severity: 'error',
      metadata: { userId: (req as any).user?.userId }
    });
    res.status(500).json({
      error: 'Failed to load audit logs',
      code: 'AUDIT_LOGS_ERROR'
    });
  }
});

// System statistics
router.get('/stats', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '7d';
    
    let dateFilter: any;
    const now = new Date();
    
    switch (timeframe) {
      case '1h':
        dateFilter = sql`created_at > ${new Date(now.getTime() - 60 * 60 * 1000)}`;
        break;
      case '24h':
        dateFilter = sql`created_at > ${new Date(now.getTime() - 24 * 60 * 60 * 1000)}`;
        break;
      case '7d':
        dateFilter = sql`created_at > ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}`;
        break;
      case '30d':
        dateFilter = sql`created_at > ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}`;
        break;
      default:
        dateFilter = sql`created_at > ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}`;
    }

    // Get various statistics
    const [
      userStats,
      activityStats,
      errorStats,
      healthStats
    ] = await Promise.all([
      // User statistics
      db.select({
        total: count(),
        active: count(sql`CASE WHEN is_active = true THEN 1 END`),
        verified: count(sql`CASE WHEN is_email_verified = true THEN 1 END`),
        recent: count(sql`CASE WHEN created_at > NOW() - INTERVAL '${timeframe}' THEN 1 END`)
      }).from(users),

      // Activity statistics
      db.select({
        total: count(),
        byAction: sql`json_object_agg(action, count) FROM (SELECT action, COUNT(*) as count FROM audit_logs WHERE ${dateFilter} GROUP BY action) t`
      }).from(auditLogs).where(dateFilter),

      // Error statistics
      db.select({
        total: count(),
        byType: sql`json_object_agg(error_type, count) FROM (SELECT error_type, COUNT(*) as count FROM error_logs WHERE ${dateFilter} GROUP BY error_type) t`
      }).from(errorLogs).where(dateFilter),

      // Health statistics
      db.select({
        total: count(),
        avgResponseTime: sql`AVG(CASE WHEN metric_name = 'response_time' THEN (metric_value::json->>'duration')::numeric END)`
      }).from(healthMetrics).where(dateFilter)
    ]);

    res.json({
      timeframe,
      users: userStats[0],
      activity: activityStats[0],
      errors: errorStats[0],
      health: healthStats[0]
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'admin-routes', 
      route: 'stats',
      severity: 'error',
      metadata: { userId: (req as any).user?.userId }
    });
    res.status(500).json({
      error: 'Failed to load system statistics',
      code: 'STATS_ERROR'
    });
  }
});

export default router;