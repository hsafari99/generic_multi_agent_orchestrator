import { Pool } from 'pg';
import { Logger } from '../logging/logger';
import * as fs from 'fs';

export interface PostgresConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeoutMillis?: number;
}

export class PostgresClient {
  private pool: Pool;
  private logger: Logger;

  constructor(config: PostgresConfig) {
    this.logger = Logger.getInstance();
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    });

    this.pool.on('error', err => {
      this.logger.error('Unexpected error on idle client', err);
    });
  }

  async query<T = any[]>(text: string, params?: any[]): Promise<T> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows as T;
    } catch (error) {
      this.logger.error('Error executing query', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async executeFile(filePath: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
    } catch (error) {
      this.logger.error('Error executing SQL file', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async shutdown(): Promise<void> {
    await this.pool.end();
  }
}
