import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Production database configuration with connection pooling
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings for production
  max: process.env.NODE_ENV === 'production' ? 20 : 10, // Maximum number of clients in the pool
  idleTimeoutMillis: process.env.NODE_ENV === 'production' ? 30000 : 10000, // Close idle clients after 30s (prod) or 10s (dev)
  connectionTimeoutMillis: process.env.NODE_ENV === 'production' ? 5000 : 2000, // Return an error after 5s (prod) or 2s (dev) if connection could not be established
  maxUses: process.env.NODE_ENV === 'production' ? 7500 : 5000, // Close connections after 7500 uses (prod) or 5000 uses (dev)
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    // Additional SSL options can be configured here
  } : undefined,
  // Health check query
  healthCheckTimeout: 3000,
  healthCheckQuery: 'SELECT 1',
};

export const pool = new Pool(poolConfig);

// Create drizzle instance with enhanced configuration
export const db = drizzle({ 
  client: pool, 
  schema,
  logger: process.env.NODE_ENV === 'development' // Enable query logging in development only
});

// Database health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Connection pool monitoring
export function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    max: poolConfig.max,
    available: pool.availableCount
  };
}

// Graceful shutdown handler
export async function closeDatabasePool(): Promise<void> {
  try {
    await pool.end();
    console.log('Database pool closed successfully');
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
}