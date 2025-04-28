import { PostgresClient } from './postgres';
import { RedisClient } from '../cache/client';
import { Logger } from '../logging/logger';
import { EventEmitter } from 'events';

export interface StorageMonitorConfig {
  postgres: PostgresClient;
  redis: RedisClient;
  checkInterval?: number;
}

export interface StorageMetrics {
  timestamp: number;
  postgres: {
    activeConnections: number;
    idleConnections: number;
    waitingConnections: number;
    totalConnections: number;
    queryCount: number;
    errorCount: number;
    averageQueryTime: number;
  };
  redis: {
    connectedClients: number;
    usedMemory: number;
    totalKeys: number;
    keyspaceHits: number;
    keyspaceMisses: number;
    commandsProcessed: number;
  };
  messageQueue: {
    queueSize: number;
    processingCount: number;
    deadLetterCount: number;
    averageProcessingTime: number;
  };
  messageHistory: {
    totalMessages: number;
    messagesByType: Record<string, number>;
    messagesBySender: Record<string, number>;
    messagesByReceiver: Record<string, number>;
  };
}

export class StorageMonitor extends EventEmitter {
  private postgres: PostgresClient;
  private redis: RedisClient;
  private logger: Logger;
  private checkInterval: number;
  private intervalId?: NodeJS.Timeout;
  private metrics: StorageMetrics | null = null;

  constructor(config: StorageMonitorConfig) {
    super();
    this.postgres = config.postgres;
    this.redis = config.redis;
    this.logger = Logger.getInstance();
    this.checkInterval = config.checkInterval || 60000; // 1 minute default
  }

  async start(): Promise<void> {
    this.logger.info('Starting storage monitor');
    this.intervalId = setInterval(() => this.collectMetrics(), this.checkInterval);
    await this.collectMetrics(); // Initial collection
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping storage monitor');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.metrics = null;
  }

  private async collectMetrics(): Promise<void> {
    try {
      const [postgresMetrics, redisMetrics, messageQueueMetrics, messageHistoryMetrics] =
        await Promise.all([
          this.getPostgresMetrics(),
          this.getRedisMetrics(),
          this.getMessageQueueMetrics(),
          this.getMessageHistoryMetrics(),
        ]);

      this.metrics = {
        timestamp: Date.now(),
        postgres: postgresMetrics,
        redis: redisMetrics,
        messageQueue: messageQueueMetrics,
        messageHistory: messageHistoryMetrics,
      };

      this.emit('metrics', this.metrics);
    } catch (error) {
      this.logger.error('Error collecting storage metrics', error);
      this.emit('error', error);
    }
  }

  private async getPostgresMetrics(): Promise<StorageMetrics['postgres']> {
    const result = await this.postgres.query<
      {
        active_connections: number;
        idle_connections: number;
        waiting_connections: number;
        total_connections: number;
        query_count: number;
        error_count: number;
        avg_query_time: number;
      }[]
    >(`
      SELECT 
        COUNT(*) FILTER (WHERE state = 'active') as active_connections,
        COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
        COUNT(*) FILTER (WHERE state = 'waiting') as waiting_connections,
        COUNT(*) as total_connections,
        SUM(query_count) as query_count,
        SUM(error_count) as error_count,
        AVG(query_time) as avg_query_time
      FROM pg_stat_activity
    `);

    return {
      activeConnections: result[0]?.active_connections || 0,
      idleConnections: result[0]?.idle_connections || 0,
      waitingConnections: result[0]?.waiting_connections || 0,
      totalConnections: result[0]?.total_connections || 0,
      queryCount: result[0]?.query_count || 0,
      errorCount: result[0]?.error_count || 0,
      averageQueryTime: result[0]?.avg_query_time || 0,
    };
  }

  private async getRedisMetrics(): Promise<StorageMetrics['redis']> {
    const info = await this.redis.getClient().info();
    const keys = await this.redis.getClient().keys('*');

    return {
      connectedClients: parseInt(info.match(/connected_clients:(\d+)/)?.[1] || '0'),
      usedMemory: parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0'),
      totalKeys: keys.length,
      keyspaceHits: parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0'),
      keyspaceMisses: parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0'),
      commandsProcessed: parseInt(info.match(/total_commands_processed:(\d+)/)?.[1] || '0'),
    };
  }

  private async getMessageQueueMetrics(): Promise<StorageMetrics['messageQueue']> {
    const result = await this.postgres.query<
      {
        queue_size: number;
        processing_count: number;
        dead_letter_count: number;
        avg_processing_time: number;
      }[]
    >(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as queue_size,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
        COUNT(*) FILTER (WHERE status = 'dead-letter') as dead_letter_count,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time
      FROM messages
    `);

    return {
      queueSize: result[0]?.queue_size || 0,
      processingCount: result[0]?.processing_count || 0,
      deadLetterCount: result[0]?.dead_letter_count || 0,
      averageProcessingTime: result[0]?.avg_processing_time || 0,
    };
  }

  private async getMessageHistoryMetrics(): Promise<StorageMetrics['messageHistory']> {
    const result = await this.postgres.query<
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

    const metrics: StorageMetrics['messageHistory'] = {
      totalMessages: result[0]?.total || 0,
      messagesByType: {},
      messagesBySender: {},
      messagesByReceiver: {},
    };

    result.forEach(stat => {
      metrics.messagesByType[stat.type] = (metrics.messagesByType[stat.type] || 0) + stat.count;
      metrics.messagesBySender[stat.sender] =
        (metrics.messagesBySender[stat.sender] || 0) + stat.count;
      metrics.messagesByReceiver[stat.receiver] =
        (metrics.messagesByReceiver[stat.receiver] || 0) + stat.count;
    });

    return metrics;
  }

  getMetrics(): StorageMetrics | null {
    return this.metrics;
  }
}
