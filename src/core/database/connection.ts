import { Pool, PoolClient } from 'pg';
import { DatabaseConfig, DEFAULT_DB_CONFIG, getPoolConfig } from './config';

/**
 * Database connection manager
 */
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private config: DatabaseConfig;

  private constructor(config: DatabaseConfig = DEFAULT_DB_CONFIG) {
    this.config = config;
    this.pool = new Pool(getPoolConfig(config));
  }

  /**
   * Get the singleton instance of the database connection
   */
  public static getInstance(config?: DatabaseConfig): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(config);
    }
    return DatabaseConnection.instance;
  }

  /**
   * Get a client from the pool
   */
  public async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute a query
   */
  public async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the connection pool
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Check if the database is connected
   */
  public async isConnected(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.length > 0;
    } catch (error) {
      throw error;
    }
  }
}
