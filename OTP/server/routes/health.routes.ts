import { Router } from 'express';
import { db } from '../db';
import { healthMetrics, systemConfig, errorLogs } from '../shared/production-schema';
import { eq, desc, sql } from 'drizzle-orm';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logError } from '../middleware/requestLogger';

const router = Router();
const execAsync = promisify(exec);

// System metrics collection
const collectSystemMetrics = async () => {
  const now = new Date();
  
  // CPU usage
  const cpus = os.cpus();
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const usage = 1 - (cpu.times.idle / total);
    return acc + usage;
  }, 0) / cpus.length;

  // Memory usage
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;

  // Disk usage
  let diskUsage = null;
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
      // Parse Windows disk info
      diskUsage = stdout;
    } else {
      const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}'");
      diskUsage = stdout.trim();
    }
  } catch (error) {
    logError(error as Error, { 
      context: 'health-routes', 
      route: 'disk-usage',
      severity: 'warning',
      metadata: { platform: process.platform }
    });
  }

  // Load average
  const loadAvg = os.loadavg();

  // Network interfaces
  const networkInterfaces = os.networkInterfaces();
  
  return {
    timestamp: now,
    cpuUsage: Math.round(cpuUsage * 100 * 100) / 100,
    memoryUsage: Math.round(memoryUsage * 100) / 100,
    memoryUsed: usedMemory,
    memoryTotal: totalMemory,
    diskUsage,
    loadAverage: loadAvg[0], // 1 minute load average
    uptime: os.uptime(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    pid: process.pid,
    ppid: process.ppid
  };
};

// Database health check
const checkDatabaseHealth = async () => {
  try {
    const startTime = Date.now();
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;
    
    // Check table counts
    const tableCounts = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM users) as user_count,
        (SELECT COUNT(*) FROM leads) as lead_count,
        (SELECT COUNT(*) FROM calls) as call_count,
        (SELECT COUNT(*) FROM activities WHERE created_at > NOW() - INTERVAL '1 hour') as recent_activities
    `);

    return {
      status: 'healthy',
      responseTime,
      tableCounts: tableCounts.rows[0] || {}
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Database connection failed'
    };
  }
};

// Basic health check
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };

    res.json(health);
  } catch (error) {
    logError(error as Error, { 
      context: 'health-routes', 
      route: 'basic-health',
      severity: 'error'
    });
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

// Detailed health check with system metrics
router.get('/detailed', async (req, res) => {
  try {
    const [systemMetrics, dbHealth] = await Promise.all([
      collectSystemMetrics(),
      checkDatabaseHealth()
    ]);

    const health = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      system: systemMetrics,
      database: dbHealth,
      checks: {
        system: 'healthy',
        database: dbHealth.status
      }
    };

    res.json(health);
  } catch (error) {
    logError(error as Error, { 
      context: 'health-routes', 
      route: 'detailed-health',
      severity: 'error'
    });
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Detailed health check failed'
    });
  }
});

// Collect and store system metrics
router.post('/metrics', async (req, res) => {
  try {
    const metrics = await collectSystemMetrics();
    
    // Store metrics in database
    await db.insert(healthMetrics).values({
      metricType: 'system',
      metricName: 'system_health',
      metricValue: JSON.stringify(metrics),
      tags: {
        environment: process.env.NODE_ENV || 'development',
        host: os.hostname()
      }
    });

    res.json({
      message: 'Metrics collected and stored successfully',
      metrics
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'health-routes', 
      route: 'collect-metrics',
      severity: 'error'
    });
    res.status(500).json({
      error: 'Failed to collect and store metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get historical metrics
router.get('/metrics', async (req, res) => {
  try {
    const { timeframe = '1h', metricType } = req.query;
    
    let timeCondition: any;
    const now = new Date();
    
    switch (timeframe) {
      case '1h':
        timeCondition = sql`created_at > ${new Date(now.getTime() - 60 * 60 * 1000)}`;
        break;
      case '24h':
        timeCondition = sql`created_at > ${new Date(now.getTime() - 24 * 60 * 60 * 1000)}`;
        break;
      case '7d':
        timeCondition = sql`created_at > ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}`;
        break;
      case '30d':
        timeCondition = sql`created_at > ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}`;
        break;
      default:
        timeCondition = sql`created_at > ${new Date(now.getTime() - 60 * 60 * 1000)}`;
    }

    let whereCondition = timeCondition;
    if (metricType) {
      whereCondition = sql`${timeCondition} AND metric_type = ${metricType as string}`;
    }

    const metrics = await db
      .select()
      .from(healthMetrics)
      .where(whereCondition)
      .orderBy(desc(healthMetrics.createdAt))
      .limit(1000);

    res.json({
      metrics,
      count: metrics.length,
      timeframe
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'health-routes', 
      route: 'get-metrics',
      severity: 'error'
    });
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get system configuration
router.get('/config', async (req, res) => {
  try {
    const config = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.isActive, true));

    const configMap = config.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, any>);

    res.json({
      config: configMap,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'health-routes', 
      route: 'get-config',
      severity: 'error'
    });
    res.status(500).json({
      error: 'Failed to retrieve system configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update system configuration
router.post('/config', async (req, res) => {
  try {
    const { key, value, description } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({
        error: 'Key and value are required'
      });
    }

    const [updatedConfig] = await db
      .insert(systemConfig)
      .values({
        key,
        value,
        description: description || '',
        isActive: true
      })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value,
          description: description || '',
          updatedAt: new Date()
        }
      })
      .returning();

    res.json({
      message: 'Configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'health-routes', 
      route: 'update-config',
      severity: 'error'
    });
    res.status(500).json({
      error: 'Failed to update system configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database maintenance endpoints
router.post('/maintenance/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Clean up old health metrics
    const deletedMetrics = await db
      .delete(healthMetrics)
      .where(sql`created_at < ${cutoffDate}`);

    // Clean up old error logs
    const deletedErrors = await db
      .delete(errorLogs)
      .where(sql`created_at < ${cutoffDate}`);

    res.json({
      message: 'Maintenance cleanup completed',
      deletedMetrics: deletedMetrics.rowCount,
      deletedErrors: deletedErrors.rowCount,
      cutoffDate: cutoffDate.toISOString()
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'health-routes', 
      route: 'maintenance-cleanup',
      severity: 'error'
    });
    res.status(500).json({
      error: 'Failed to perform maintenance cleanup',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Performance test endpoint
router.get('/performance', async (req, res) => {
  try {
    const iterations = parseInt(req.query.iterations as string) || 1000;
    const startTime = Date.now();
    
    // Simulate some work
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    res.json({
      message: 'Performance test completed',
      iterations,
      duration,
      operationsPerSecond: Math.round(iterations / (duration / 1000)),
      result: Math.round(result * 100) / 100
    });
  } catch (error) {
    logError(error as Error, { 
      context: 'health-routes', 
      route: 'performance-test',
      severity: 'error'
    });
    res.status(500).json({
      error: 'Performance test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;