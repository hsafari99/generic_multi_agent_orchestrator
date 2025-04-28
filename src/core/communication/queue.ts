import { Logger } from '../logging/logger';
import { IMessage } from '../interfaces';
import Redis from 'ioredis';

/**
 * Message queue configuration
 */
export interface MessageQueueConfig {
  redisUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  deadLetterQueue?: string;
  maxQueueSize?: number;
  messageTTL?: number;
}

/**
 * Queued message with metadata
 */
export interface QueuedMessage {
  message: IMessage;
  retries: number;
  lastAttempt: number;
  nextAttempt: number;
  status: 'pending' | 'processing' | 'failed' | 'dead-letter';
}

/**
 * Message queue for handling message persistence and delivery
 */
export class MessageQueue {
  private logger: Logger;
  private config: MessageQueueConfig;
  private redis: Redis;
  private processing: Set<string>; // Set of message IDs currently being processed

  constructor(config: MessageQueueConfig = {}) {
    this.logger = Logger.getInstance();
    this.config = {
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      maxRetries: 3,
      retryDelay: 5000,
      deadLetterQueue: 'dead-letter',
      maxQueueSize: 10000,
      messageTTL: 24 * 60 * 60, // 24 hours
      ...config,
    };
    this.redis = new Redis(this.config.redisUrl || 'redis://localhost:6379');
    this.processing = new Set();
  }

  /**
   * Enqueue a message
   */
  public async enqueue(message: IMessage, priority: number = 0): Promise<void> {
    const queuedMessage: QueuedMessage = {
      message,
      retries: 0,
      lastAttempt: 0,
      nextAttempt: Date.now(),
      status: 'pending',
    };

    // Check queue size
    const queueSize = await this.redis.zcard('queue');
    if (queueSize >= (this.config.maxQueueSize || 10000)) {
      throw new Error('Queue is full');
    }

    // Store message in Redis
    const key = `message:${message.id}`;
    await this.redis.setex(key, this.config.messageTTL || 86400, JSON.stringify(queuedMessage));
    await this.redis.zadd('queue', priority, message.id);
  }

  /**
   * Dequeue the next message
   */
  public async dequeue(): Promise<QueuedMessage | null> {
    // Get next message ID from queue (highest priority first)
    const result = await this.redis.zpopmax('queue');
    if (!result || result.length === 0) {
      this.logger.debug('No messages in queue');
      return null;
    }

    const [messageId, score] = result;
    if (this.processing.has(messageId)) {
      this.logger.debug(`Message ${messageId} is already being processed`);
      // Add back to queue with same priority
      await this.redis.zadd('queue', score, messageId);
      return null;
    }

    // Get message data
    const key = `message:${messageId}`;
    const data = await this.redis.get(key);
    if (!data) {
      this.logger.debug(`Message ${messageId} not found in Redis, removing from processing set`);
      // Remove from processing set if message is expired
      this.processing.delete(messageId);
      return null;
    }

    // Update message status
    const queuedMessage: QueuedMessage = JSON.parse(data);
    queuedMessage.status = 'processing';
    queuedMessage.lastAttempt = Date.now();

    // Update message in Redis
    await this.redis.setex(key, this.config.messageTTL || 86400, JSON.stringify(queuedMessage));

    // Update processing set
    this.processing.add(messageId);
    this.logger.debug(
      `Message ${messageId} added to processing set, current size: ${this.processing.size}`
    );

    return queuedMessage;
  }

  /**
   * Acknowledge message processing
   */
  public async acknowledge(messageId: string): Promise<void> {
    const key = `message:${messageId}`;
    await this.redis.del(key);
    await this.redis.zrem('queue', messageId);
    this.processing.delete(messageId);
  }

  /**
   * Handle failed message processing
   */
  public async handleFailure(messageId: string): Promise<void> {
    const key = `message:${messageId}`;
    const data = await this.redis.get(key);
    if (!data) {
      this.logger.debug(`Message ${messageId} not found in Redis during failure handling`);
      // Clean up processing set if message is expired
      this.processing.delete(messageId);
      return;
    }

    const queuedMessage: QueuedMessage = JSON.parse(data);
    queuedMessage.retries++;
    queuedMessage.status = 'failed';
    this.processing.delete(messageId);
    this.logger.debug(
      `Message ${messageId} removed from processing set, current size: ${this.processing.size}`
    );

    if (queuedMessage.retries > (this.config.maxRetries || 3)) {
      // Move to dead letter queue
      queuedMessage.status = 'dead-letter';
      await this.redis.lpush(
        this.config.deadLetterQueue || 'dead-letter',
        JSON.stringify(queuedMessage)
      );
      await this.redis.del(key);
      await this.redis.zrem('queue', messageId);
      this.logger.debug(`Message ${messageId} moved to dead letter queue`);
    } else {
      // Schedule retry
      queuedMessage.nextAttempt = Date.now() + (this.config.retryDelay || 5000);
      queuedMessage.status = 'pending';

      // Get current priority
      const score = await this.redis.zscore('queue', messageId);
      const priority = score ? parseFloat(score) : 0;

      // Update message in Redis
      await this.redis.setex(key, this.config.messageTTL || 86400, JSON.stringify(queuedMessage));

      // Remove from queue and add back with same priority
      await this.redis.zrem('queue', messageId);
      await this.redis.zadd('queue', priority, messageId);
      this.logger.debug(`Message ${messageId} scheduled for retry with priority ${priority}`);
    }
  }

  /**
   * Get queue statistics
   */
  public async getStats(): Promise<{
    queueSize: number;
    processingCount: number;
    deadLetterCount: number;
  }> {
    const [queueSize, deadLetterCount] = await Promise.all([
      this.redis.zcard('queue'),
      this.redis.llen(this.config.deadLetterQueue || 'dead-letter'),
    ]);

    // Ensure we're not counting messages that are in processing
    const actualQueueSize = Math.max(0, (queueSize || 0) - this.processing.size);

    return {
      queueSize: actualQueueSize,
      processingCount: this.processing.size,
      deadLetterCount: deadLetterCount || 0,
    };
  }

  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Clear all queue data
   */
  public async clear(): Promise<void> {
    // Clear main queue
    await this.redis.del('queue');

    // Clear dead letter queue
    await this.redis.del(this.config.deadLetterQueue || 'dead-letter');

    // Clear all message data
    const keys = await this.redis.keys('message:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    // Clear processing set
    this.processing.clear();
  }
}
