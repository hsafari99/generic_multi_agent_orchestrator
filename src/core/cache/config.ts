import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../../.env') });
/**
 * Redis configuration interface
 */
export interface RedisConfig {
  /** Redis connection URL */
  url: string;
  /** Connection options */
  connection: {
    /** Maximum number of retries */
    maxRetries: number;
    /** Retry delay in milliseconds */
    retryDelay: number;
    /** Connection timeout in milliseconds */
    connectTimeout: number;
  };
  /** Cache options */
  cache: {
    /** Default TTL in seconds */
    defaultTTL: number;
    /** Maximum number of keys */
    maxKeys: number;
    /** Key prefix */
    keyPrefix: string;
  };
}

/**
 * Default Redis configuration
 */
export const DEFAULT_REDIS_CONFIG: RedisConfig = {
  url: process.env.REDIS_URL || '',
  connection: {
    maxRetries: 3,
    retryDelay: 1000,
    connectTimeout: 5000,
  },
  cache: {
    defaultTTL: 3600, // 1 hour
    maxKeys: 10000,
    keyPrefix: 'orchestrator:',
  },
};
