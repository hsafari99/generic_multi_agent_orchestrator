import { RedisClient } from './client';
import { RedisConfig, DEFAULT_REDIS_CONFIG } from './config';

/**
 * Cache manager for handling Redis operations
 */
export class CacheManager {
  private static instance: CacheManager;
  private redisClient: RedisClient;
  private config: RedisConfig;

  private constructor(config: RedisConfig = DEFAULT_REDIS_CONFIG) {
    this.config = config;
    this.redisClient = RedisClient.getInstance(config);
  }

  /**
   * Get the singleton instance of the cache manager
   */
  public static getInstance(config?: RedisConfig): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  /**
   * Get a value from cache
   */
  public async get<T>(key: string): Promise<T | null> {
    const client = this.redisClient.getClient();
    const value = await client.get(this.getKey(key));
    return value ? JSON.parse(value) : null;
  }

  /**
   * Set a value in cache
   */
  public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const client = this.redisClient.getClient();
    const serializedValue = JSON.stringify(value);
    const finalTTL = ttl || this.config.cache.defaultTTL;
    await client.set(this.getKey(key), serializedValue, { EX: finalTTL });
  }

  /**
   * Delete a value from cache
   */
  public async delete(key: string): Promise<void> {
    const client = this.redisClient.getClient();
    await client.del(this.getKey(key));
  }

  /**
   * Check if a key exists in cache
   */
  public async exists(key: string): Promise<boolean> {
    const client = this.redisClient.getClient();
    const result = await client.exists(this.getKey(key));
    return result === 1;
  }

  /**
   * Get all keys matching a pattern
   */
  public async keys(pattern: string): Promise<string[]> {
    const client = this.redisClient.getClient();
    const keys = await client.keys(this.getKey(pattern));
    return keys.map(key => key.replace(this.config.cache.keyPrefix, ''));
  }

  /**
   * Clear all keys matching a pattern
   */
  public async clear(pattern: string): Promise<void> {
    const client = this.redisClient.getClient();
    const keys = await this.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys.map(key => this.getKey(key)));
    }
  }

  /**
   * Get the full key with prefix
   */
  private getKey(key: string): string {
    return `${this.config.cache.keyPrefix}${key}`;
  }
}
