import { RedisClient } from '../cache/client';
import { Logger } from '../logging/logger';
import { EventEmitter } from 'events';

export interface CacheInvalidationConfig {
  redis: RedisClient;
  defaultTTL?: number;
  checkInterval?: number;
}

export class CacheInvalidator extends EventEmitter {
  private redis: RedisClient;
  private logger: Logger;
  private defaultTTL: number;
  private checkInterval: number;
  private intervalId?: NodeJS.Timeout;

  constructor(config: CacheInvalidationConfig) {
    super();
    this.redis = config.redis;
    this.logger = Logger.getInstance();
    this.defaultTTL = config.defaultTTL || 3600; // 1 hour default
    this.checkInterval = config.checkInterval || 60000; // 1 minute default
  }

  async start(): Promise<void> {
    this.logger.info('Starting cache invalidator');
    this.intervalId = setInterval(() => this.checkExpiredKeys(), this.checkInterval);
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping cache invalidator');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expirationTime = Date.now() + (ttl || this.defaultTTL) * 1000;
    await this.redis.getClient().set(key, JSON.stringify(value));
    await this.redis.getClient().set(`${key}:expires`, expirationTime.toString());
    this.emit('set', { key, value, expirationTime });
  }

  async get(key: string): Promise<any> {
    const value = await this.redis.getClient().get(key);
    if (!value) return null;

    const expirationTime = await this.redis.getClient().get(`${key}:expires`);
    if (!expirationTime) return null;

    if (Date.now() > parseInt(expirationTime)) {
      await this.invalidate(key);
      return null;
    }

    return JSON.parse(value);
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.getClient().del(key);
    await this.redis.getClient().del(`${key}:expires`);
    this.emit('invalidate', { key });
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.getClient().keys(pattern);
    if (keys.length > 0) {
      await this.redis.getClient().del(keys);
      await this.redis.getClient().del(keys.map(key => `${key}:expires`));
      this.emit('invalidatePattern', { pattern, keys });
    }
  }

  private async checkExpiredKeys(): Promise<void> {
    try {
      const keys = await this.redis.getClient().keys('*:expires');
      for (const key of keys) {
        const expirationTime = await this.redis.getClient().get(key);
        if (expirationTime && Date.now() > parseInt(expirationTime)) {
          const baseKey = key.replace(':expires', '');
          await this.invalidate(baseKey);
        }
      }
    } catch (error) {
      this.logger.error('Error checking expired keys', error);
    }
  }

  async getStats(): Promise<{
    totalKeys: number;
    expiredKeys: number;
    memoryUsage: number;
  }> {
    const keys = await this.redis.getClient().keys('*');
    const expiredKeys = await this.redis.getClient().keys('*:expires');
    const memoryUsage = await this.redis.getClient().info('memory');

    return {
      totalKeys: keys.length,
      expiredKeys: expiredKeys.length,
      memoryUsage: parseInt(memoryUsage.match(/used_memory:(\d+)/)?.[1] || '0'),
    };
  }
}
