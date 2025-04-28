import { PostgresClient } from './postgres';
import { IMessage } from '../interfaces';
import { Logger } from '../logging/logger';

export interface MessageHistoryConfig {
  postgres: PostgresClient;
  maxHistorySize?: number;
  retentionPeriod?: number; // in days
}

export class MessageHistoryTracker {
  private postgres: PostgresClient;
  private logger: Logger;
  private maxHistorySize: number;
  private retentionPeriod: number;

  constructor(config: MessageHistoryConfig) {
    this.postgres = config.postgres;
    this.logger = Logger.getInstance();
    this.maxHistorySize = config.maxHistorySize || 1000;
    this.retentionPeriod = config.retentionPeriod || 30; // 30 days default
  }

  async trackMessage(message: IMessage): Promise<void> {
    const { id, type, sender, receiver, payload, timestamp, metadata } = message;

    await this.postgres.query(
      `INSERT INTO message_history (
        message_id, type, sender, receiver, payload, timestamp, metadata,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'tracked', CURRENT_TIMESTAMP)`,
      [id, type, sender, receiver, payload, new Date(timestamp), metadata]
    );
  }

  async getMessageHistory(options: {
    sender?: string;
    receiver?: string;
    type?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
  }): Promise<IMessage[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.sender) {
      conditions.push(`sender = $${paramIndex}`);
      params.push(options.sender);
      paramIndex++;
    }

    if (options.receiver) {
      conditions.push(`receiver = $${paramIndex}`);
      params.push(options.receiver);
      paramIndex++;
    }

    if (options.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(options.type);
      paramIndex++;
    }

    if (options.startTime) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(new Date(options.startTime));
      paramIndex++;
    }

    if (options.endTime) {
      conditions.push(`timestamp <= $${paramIndex}`);
      params.push(new Date(options.endTime));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = options.limit ? `LIMIT $${paramIndex}` : '';
    const offsetClause = options.offset ? `OFFSET $${paramIndex + 1}` : '';

    const query = `
      SELECT * FROM message_history
      ${whereClause}
      ORDER BY timestamp DESC
      ${limitClause}
      ${offsetClause}
    `;

    if (options.limit) {
      params.push(options.limit);
    }
    if (options.offset) {
      params.push(options.offset);
    }

    const result = await this.postgres.query<IMessage[]>(query, params);
    return result;
  }

  async cleanupOldHistory(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionPeriod);

    await this.postgres.query(`DELETE FROM message_history WHERE created_at < $1`, [cutoffDate]);
  }

  async getHistoryStats(): Promise<{
    totalMessages: number;
    messagesByType: Record<string, number>;
    messagesBySender: Record<string, number>;
    messagesByReceiver: Record<string, number>;
  }> {
    const stats = await this.postgres.query<
      {
        total: number;
        type: string;
        sender: string;
        receiver: string;
        count: number;
      }[]
    >(`
      SELECT 
        COUNT(*) as total,
        type,
        sender,
        receiver,
        COUNT(*) as count
      FROM message_history
      GROUP BY type, sender, receiver
    `);

    const result: {
      totalMessages: number;
      messagesByType: Record<string, number>;
      messagesBySender: Record<string, number>;
      messagesByReceiver: Record<string, number>;
    } = {
      totalMessages: stats[0]?.total || 0,
      messagesByType: {} as Record<string, number>,
      messagesBySender: {} as Record<string, number>,
      messagesByReceiver: {} as Record<string, number>,
    };

    stats.forEach(stat => {
      result.messagesByType[stat.type] = (result.messagesByType[stat.type] || 0) + stat.count;
      result.messagesBySender[stat.sender] =
        (result.messagesBySender[stat.sender] || 0) + stat.count;
      result.messagesByReceiver[stat.receiver] =
        (result.messagesByReceiver[stat.receiver] || 0) + stat.count;
    });

    return result;
  }
}
