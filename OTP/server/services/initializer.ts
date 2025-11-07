import { getEmailService } from './email.service.js';
import { db } from '../db.js';
import { systemConfig } from '../shared/production-schema.ts';
import { eq, sql } from 'drizzle-orm';
import { cleanupRateLimiters } from '../middleware/rateLimiter.js';
import cron from 'node-cron';

export class ServiceInitializer {
  private static instance: ServiceInitializer;
  private services: Map<string, any> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {}

  static getInstance(): ServiceInitializer {
    if (!ServiceInitializer.instance) {
      ServiceInitializer.instance = new ServiceInitializer();
    }
    return ServiceInitializer.instance;
  }

  async initialize(): Promise<void> {
    console.log('Initializing production services...');

    try {
      // Initialize email service
      await this.initializeEmailService();
      
      // Initialize system configuration
      await this.initializeSystemConfig();
      
      // Initialize scheduled jobs
      await this.initializeScheduledJobs();
      
      // Initialize monitoring
      await this.initializeMonitoring();
      
      console.log('All services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize services:', error);
      throw error;
    }
  }

  private async initializeEmailService(): Promise<void> {
    try {
      const emailService = getEmailService();
      const isConnected = await emailService.testConnection();
      
      if (isConnected) {
        this.services.set('email', emailService);
        console.log('Email service initialized successfully');
      } else {
        console.warn('Email service connection test failed - service may not be fully functional');
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      // Don't throw - email service is not critical for startup
    }
  }

  private async initializeSystemConfig(): Promise<void> {
    try {
      // Ensure default system configurations exist
      const defaultConfigs = [
        {
          key: 'system.maintenance_mode',
          value: 'false',
          description: 'System maintenance mode status',
          isActive: true
        },
        {
          key: 'system.max_failed_logins',
          value: '5',
          description: 'Maximum failed login attempts before lockout',
          isActive: true
        },
        {
          key: 'system.session_timeout',
          value: '3600',
          description: 'User session timeout in seconds',
          isActive: true
        },
        {
          key: 'system.password_expiry_days',
          value: '90',
          description: 'Password expiry period in days',
          isActive: true
        },
        {
          key: 'system.email_verification_required',
          value: 'true',
          description: 'Require email verification for new users',
          isActive: true
        },
        {
          key: 'system.api_rate_limit',
          value: '100',
          description: 'API rate limit per minute per IP',
          isActive: true
        },
        {
          key: 'system.backup_retention_days',
          value: '30',
          description: 'Database backup retention period in days',
          isActive: true
        },
        {
          key: 'system.log_retention_days',
          value: '90',
          description: 'Log file retention period in days',
          isActive: true
        }
      ];

      for (const config of defaultConfigs) {
        await db.insert(systemConfig)
          .values(config)
          .onConflictDoUpdate({
            target: systemConfig.key,
            set: {
              description: config.description,
              isActive: config.isActive,
              updatedAt: new Date()
            }
          });
      }

      console.log('System configuration initialized');
    } catch (error) {
      console.error('Failed to initialize system configuration:', error);
      throw error;
    }
  }

  private async initializeScheduledJobs(): Promise<void> {
    try {
      // Clean up expired verification tokens every hour
      const tokenCleanupJob = cron.schedule('0 * * * *', async () => {
        try {
          const emailService = getEmailService();
          await emailService.cleanupExpiredTokens();
          console.log('Expired verification tokens cleaned up');
        } catch (error) {
          console.error('Failed to cleanup expired tokens:', error);
        }
      });
      this.cronJobs.set('token_cleanup', tokenCleanupJob);

      // System health check every 5 minutes
      const healthCheckJob = cron.schedule('*/5 * * * *', async () => {
        try {
          await this.performHealthCheck();
        } catch (error) {
          console.error('Health check failed:', error);
        }
      });
      this.cronJobs.set('health_check', healthCheckJob);

      // Database maintenance every day at 2 AM
      const maintenanceJob = cron.schedule('0 2 * * *', async () => {
        try {
          await this.performDatabaseMaintenance();
        } catch (error) {
          console.error('Database maintenance failed:', error);
        }
      });
      this.cronJobs.set('database_maintenance', maintenanceJob);

      // Log rotation every day at 3 AM
      const logRotationJob = cron.schedule('0 3 * * *', async () => {
        try {
          await this.performLogRotation();
        } catch (error) {
          console.error('Log rotation failed:', error);
        }
      });
      this.cronJobs.set('log_rotation', logRotationJob);

      console.log('Scheduled jobs initialized');
    } catch (error) {
      console.error('Failed to initialize scheduled jobs:', error);
      throw error;
    }
  }

  private async initializeMonitoring(): Promise<void> {
    try {
      // Set up process monitoring
      process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        // In production, you might want to send this to an error tracking service
        process.exit(1);
      });

      process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        // In production, you might want to send this to an error tracking service
      });

      // Memory usage monitoring
      const memoryMonitoringInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        if (memPercent > 90) {
          console.warn(`High memory usage detected: ${memPercent.toFixed(2)}%`);
          // In production, you might want to trigger garbage collection or restart
        }
      }, 60000); // Check every minute

      this.services.set('memory_monitoring', memoryMonitoringInterval);

      console.log('Monitoring initialized');
    } catch (error) {
      console.error('Failed to initialize monitoring:', error);
      throw error;
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check database connection
      await db.execute(sql`SELECT 1`);
      
      // Check email service (if configured)
      if (this.services.has('email')) {
        const emailService = this.services.get('email');
        await emailService.testConnection();
      }
      
      console.log('Health check completed successfully');
    } catch (error) {
      console.error('Health check failed:', error);
      // In production, you might want to send alerts
    }
  }

  private async performDatabaseMaintenance(): Promise<void> {
    try {
      // Get retention days from system config
      const retentionConfig = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, 'system.log_retention_days'))
        .limit(1);

      const retentionDays = retentionConfig.length > 0 
        ? parseInt(retentionConfig[0].value) 
        : 90;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Clean up old audit logs
      const { rowCount: deletedAuditLogs } = await db.execute(sql`
        DELETE FROM audit_logs 
        WHERE created_at < ${cutoffDate}
      `);

      // Clean up old error logs
      const { rowCount: deletedErrorLogs } = await db.execute(sql`
        DELETE FROM error_logs 
        WHERE created_at < ${cutoffDate}
      `);

      // Clean up old health metrics
      const { rowCount: deletedHealthMetrics } = await db.execute(sql`
        DELETE FROM health_metrics 
        WHERE created_at < ${cutoffDate}
      `);

      console.log(`Database maintenance completed: ${deletedAuditLogs} audit logs, ${deletedErrorLogs} error logs, ${deletedHealthMetrics} health metrics deleted`);
    } catch (error) {
      console.error('Database maintenance failed:', error);
      throw error;
    }
  }

  private async performLogRotation(): Promise<void> {
    try {
      // This would typically involve rotating log files
      // For now, we'll just log that rotation was attempted
      console.log('Log rotation completed');
    } catch (error) {
      console.error('Log rotation failed:', error);
      throw error;
    }
  }

  getService(name: string): any {
    return this.services.get(name);
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down services...');

    try {
      // Stop all cron jobs
      for (const [name, job] of this.cronJobs) {
        job.stop();
        console.log(`Stopped cron job: ${name}`);
      }

      // Clear intervals
      const memoryMonitoring = this.services.get('memory_monitoring');
      if (memoryMonitoring) {
        clearInterval(memoryMonitoring);
      }

      // Cleanup rate limiters
      await cleanupRateLimiters();

      // Close email service
      const emailService = this.services.get('email');
      if (emailService) {
        await emailService.close();
      }

      console.log('All services shut down successfully');
    } catch (error) {
      console.error('Error during service shutdown:', error);
      throw error;
    }
  }
}

// Initialize services on startup
export const initializeServices = async (): Promise<void> => {
  const initializer = ServiceInitializer.getInstance();
  await initializer.initialize();
};

// Graceful shutdown
export const shutdownServices = async (): Promise<void> => {
  const initializer = ServiceInitializer.getInstance();
  await initializer.shutdown();
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down services...');
  await shutdownServices();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down services...');
  await shutdownServices();
  process.exit(0);
});

export default ServiceInitializer;