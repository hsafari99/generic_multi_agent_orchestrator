import { PoolConfig } from 'pg';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../../.env') });
/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  /** Neon database connection string */
  connectionString: string;
  /** Connection pool configuration */
  pool: {
    /** Maximum number of clients in the pool */
    max: number;
    /** Minimum number of clients in the pool */
    min: number;
    /** How long a client is allowed to remain idle before being closed */
    idleTimeoutMillis: number;
    /** How long to wait for a connection */
    connectionTimeoutMillis: number;
  };
  /** SSL configuration */
  ssl: {
    /** Whether to use SSL */
    enabled: boolean;
    /** Whether to reject unauthorized connections */
    rejectUnauthorized: boolean;
  };
}

/**
 * Default database configuration
 */
export const DEFAULT_DB_CONFIG: DatabaseConfig = {
  connectionString: process.env.DATABASE_URL || '',
  pool: {
    max: 20,
    min: 4,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  ssl: {
    enabled: true,
    rejectUnauthorized: false,
  },
};

/**
 * Get pool configuration from database config
 */
export function getPoolConfig(config: DatabaseConfig): PoolConfig {
  // Parse the connection string to ensure it's valid
  const connectionString = config.connectionString.trim();
  if (!connectionString) {
    throw new Error('Database connection string is empty');
  }

  return {
    connectionString,
    max: config.pool.max,
    idleTimeoutMillis: config.pool.idleTimeoutMillis,
    connectionTimeoutMillis: config.pool.connectionTimeoutMillis,
    ssl: {
      rejectUnauthorized: false,
    },
  };
}
