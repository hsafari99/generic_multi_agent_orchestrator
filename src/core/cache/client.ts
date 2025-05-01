import { createClient, RedisClientType } from 'redis';
import { RedisConfig, DEFAULT_REDIS_CONFIG } from './config';

/**
 * Redis client manager
 */
export class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType;
  private config: RedisConfig;
  private isConnected: boolean = false;

  private constructor(config: RedisConfig = DEFAULT_REDIS_CONFIG) {
    this.config = config;
    this.client = createClient({
      url: config.url,
      socket: {
        connectTimeout: config.connection.connectTimeout,
        reconnectStrategy: retries => {
          if (retries >= config.connection.maxRetries) {
            return new Error('Max retries reached');
          }
          return config.connection.retryDelay;
        },
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Get the singleton instance of the Redis client
   */
  public static getInstance(config?: RedisConfig): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient(config);
    }
    return RedisClient.instance;
  }

  /**
   * Setup event handlers for the Redis client
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
    });

    this.client.on('error', () => {
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.isConnected = false;
    });

    this.client.on('end', () => {
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
    }
  }

  /**
   * Check if the client is connected
   */
  public isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get the Redis client instance
   */
  public getClient(): RedisClientType {
    return this.client;
  }
}
