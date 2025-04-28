import { PostgresClient, PostgresConfig } from './postgres';
import { IMessage } from '../interfaces';
import { Logger } from '../logging/logger';

export interface MessageStorageConfig {
  postgres: PostgresClient | PostgresConfig;
}

export class MessageStorage {
  private postgres: PostgresClient;
  private logger: Logger;

  constructor(config: MessageStorageConfig) {
    this.postgres = config.postgres instanceof PostgresClient 
      ? config.postgres 
      : new PostgresClient(config.postgres);
    this.logger = Logger.getInstance();
  }

  async storeMessage(message: IMessage): Promise<void> {
    const { id, type, sender, receiver, payload, timestamp, metadata } = message;

    await this.postgres.query(
      `INSERT INTO messages (id, type, sender, receiver, payload, timestamp, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [id, type, sender, receiver, payload, timestamp, metadata]
    );

    if (metadata && Object.keys(metadata).length > 0) {
      await this.postgres.query(
        `INSERT INTO message_metadata (message_id, priority, requires_ack, ttl, custom_metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, metadata.priority || 0, metadata.requiresAck || false, metadata.ttl, metadata]
      );
    }
  }

  async getMessage(messageId: string): Promise<IMessage | null> {
    const result = await this.postgres.query<IMessage[]>(
      `SELECT m.*, mm.priority, mm.requires_ack, mm.ttl
       FROM messages m
       LEFT JOIN message_metadata mm ON m.id = mm.message_id
       WHERE m.id = $1`,
      [messageId]
    );

    return result[0] || null;
  }

  async updateMessageStatus(messageId: string, status: string): Promise<void> {
    await this.postgres.query(
      `UPDATE messages SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, messageId]
    );
  }

  async incrementRetries(messageId: string): Promise<void> {
    await this.postgres.query(
      `UPDATE messages 
       SET retries = retries + 1,
           last_attempt = CURRENT_TIMESTAMP,
           next_attempt = CURRENT_TIMESTAMP + INTERVAL '5 seconds',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [messageId]
    );
  }

  async moveToDeadLetter(messageId: string, error: Error): Promise<void> {
    await this.postgres.query(
      `INSERT INTO dead_letter_queue (message_id, error_message, failure_reason)
       VALUES ($1, $2, $3)`,
      [messageId, error.message, error.name]
    );

    await this.updateMessageStatus(messageId, 'dead-letter');
  }

  async getQueueStats(): Promise<{
    queueSize: number;
    processingCount: number;
    deadLetterCount: number;
  }> {
    const query = `SELECT 
      COUNT(*) FILTER (WHERE status = 'pending') as "queueSize",
      COUNT(*) FILTER (WHERE status = 'processing') as "processingCount",
      COUNT(*) FILTER (WHERE status = 'dead-letter') as "deadLetterCount"
    FROM messages`;
    
    const result = await this.postgres.query<{
      queueSize: number;
      processingCount: number;
      deadLetterCount: number;
    }[]>(query);
    
    return result[0];
  }

  async shutdown(): Promise<void> {
    await this.postgres.shutdown();
  }
}
