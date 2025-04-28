import { CacheInvalidator } from '../core/storage/cache-invalidator';
import { RedisClient } from '../core/cache/client';

// Mock RedisClient
jest.mock('../core/cache/client', () => {
  const mockRedisClient = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    info: jest.fn(),
  };

  return {
    RedisClient: {
      getInstance: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockRedisClient),
      }),
    },
  };
});

describe('CacheInvalidator', () => {
  let invalidator: CacheInvalidator;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockRedisClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = RedisClient.getInstance() as jest.Mocked<RedisClient>;
    mockRedisClient = mockRedis.getClient();
    invalidator = new CacheInvalidator({ redis: mockRedis });
  });

  afterEach(() => {
    invalidator.stop();
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      const key = 'test-key';
      const value = { test: 'value' };
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await invalidator.set(key, value);

      expect(mockRedisClient.set).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, JSON.stringify(value));
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${key}:expires`,
        (now + 3600 * 1000).toString()
      );
    });

    it('should set value with custom TTL', async () => {
      const key = 'test-key';
      const value = { test: 'value' };
      const ttl = 100;
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await invalidator.set(key, value, ttl);

      expect(mockRedisClient.set).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.set).toHaveBeenCalledWith(key, JSON.stringify(value));
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${key}:expires`,
        (now + ttl * 1000).toString()
      );
    });
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await invalidator.get('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      const key = 'test-key';
      const value = { test: 'value' };
      const expiredTime = Date.now() - 1000;

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(value));
      mockRedisClient.get.mockResolvedValueOnce(expiredTime.toString());

      const result = await invalidator.get(key);

      expect(result).toBeNull();
      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`${key}:expires`);
    });

    it('should return value for valid key', async () => {
      const key = 'test-key';
      const value = { test: 'value' };
      const futureTime = Date.now() + 1000;

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(value));
      mockRedisClient.get.mockResolvedValueOnce(futureTime.toString());

      const result = await invalidator.get(key);

      expect(result).toEqual(value);
    });
  });

  describe('invalidate', () => {
    it('should delete key and expiration', async () => {
      const key = 'test-key';

      await invalidator.invalidate(key);

      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`${key}:expires`);
    });
  });

  describe('invalidatePattern', () => {
    it('should delete all matching keys', async () => {
      const pattern = 'test-*';
      const keys = ['test-1', 'test-2'];

      mockRedisClient.keys.mockResolvedValueOnce(keys);

      await invalidator.invalidatePattern(pattern);

      expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
      expect(mockRedisClient.del).toHaveBeenCalledWith(keys.map(key => `${key}:expires`));
    });
  });

  describe('checkExpiredKeys', () => {
    it('should delete expired keys', async () => {
      const keys = ['key1:expires', 'key2:expires'];
      const now = Date.now();
      const expiredTime = now - 1000;

      mockRedisClient.keys.mockResolvedValueOnce(keys);
      mockRedisClient.get.mockResolvedValueOnce(expiredTime.toString());

      await invalidator['checkExpiredKeys']();

      expect(mockRedisClient.del).toHaveBeenCalledWith('key1');
      expect(mockRedisClient.del).toHaveBeenCalledWith('key1:expires');
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const keys = ['key1', 'key2'];
      const expiredKeys = ['key1:expires', 'key2:expires'];
      const memoryInfo = 'used_memory:1000';

      mockRedisClient.keys.mockResolvedValueOnce(keys);
      mockRedisClient.keys.mockResolvedValueOnce(expiredKeys);
      mockRedisClient.info.mockResolvedValueOnce(memoryInfo);

      const stats = await invalidator.getStats();

      expect(stats).toEqual({
        totalKeys: keys.length,
        expiredKeys: expiredKeys.length,
        memoryUsage: 1000,
      });
    });
  });

  describe('events', () => {
    it('should emit set event', async () => {
      const key = 'test-key';
      const value = { test: 'value' };
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const setListener = jest.fn();
      invalidator.on('set', setListener);

      await invalidator.set(key, value);

      expect(setListener).toHaveBeenCalledWith({
        key,
        value,
        expirationTime: now + 3600 * 1000,
      });
    });

    it('should emit invalidate event', async () => {
      const key = 'test-key';
      const invalidateListener = jest.fn();
      invalidator.on('invalidate', invalidateListener);

      await invalidator.invalidate(key);

      expect(invalidateListener).toHaveBeenCalledWith({ key });
    });

    it('should emit invalidatePattern event', async () => {
      const pattern = 'test-*';
      const keys = ['test-1', 'test-2'];
      const invalidatePatternListener = jest.fn();
      invalidator.on('invalidatePattern', invalidatePatternListener);

      mockRedisClient.keys.mockResolvedValueOnce(keys);
      await invalidator.invalidatePattern(pattern);

      expect(invalidatePatternListener).toHaveBeenCalledWith({ pattern, keys });
    });
  });
});
