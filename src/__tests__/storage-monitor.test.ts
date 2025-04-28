import { StorageMonitor } from '../core/storage/monitor';
import { PostgresClient } from '../core/storage/postgres';
import { RedisClient } from '../core/cache/client';

// Mock PostgresClient
jest.mock('../core/storage/postgres', () => ({
  PostgresClient: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
  })),
}));

// Mock RedisClient
jest.mock('../core/cache/client', () => {
  const mockRedisClient = {
    info: jest.fn(),
    keys: jest.fn(),
  };

  return {
    RedisClient: {
      getInstance: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockRedisClient),
      }),
    },
  };
});

describe('StorageMonitor', () => {
  let monitor: StorageMonitor;
  let mockPostgres: jest.Mocked<PostgresClient>;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockRedisClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres = new PostgresClient({ connectionString: 'test' }) as jest.Mocked<PostgresClient>;
    mockRedis = RedisClient.getInstance() as jest.Mocked<RedisClient>;
    mockRedisClient = mockRedis.getClient();
    monitor = new StorageMonitor({ postgres: mockPostgres, redis: mockRedis });
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('start', () => {
    it('should start collecting metrics', async () => {
      const mockPostgresMetrics = {
        active_connections: 5,
        idle_connections: 3,
        waiting_connections: 1,
        total_connections: 9,
        query_count: 100,
        error_count: 2,
        avg_query_time: 0.5,
      };
      const mockRedisInfo =
        'connected_clients:10\nused_memory:1000\nkeyspace_hits:500\nkeyspace_misses:50\ntotal_commands_processed:1000';
      const mockRedisKeys = ['key1', 'key2'];
      const mockQueueMetrics = {
        queue_size: 10,
        processing_count: 5,
        dead_letter_count: 2,
        avg_processing_time: 1.5,
      };
      const mockHistoryMetrics = [
        {
          total: 100,
          type: 'task',
          sender: 'agent1',
          receiver: 'agent2',
          count: 50,
        },
      ];

      mockPostgres.query
        .mockResolvedValueOnce([mockPostgresMetrics])
        .mockResolvedValueOnce([mockQueueMetrics])
        .mockResolvedValueOnce(mockHistoryMetrics);
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
      mockRedisClient.keys.mockResolvedValue(mockRedisKeys);

      await monitor.start();

      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics?.postgres.activeConnections).toBe(5);
      expect(metrics?.redis.connectedClients).toBe(10);
      expect(metrics?.messageQueue.queueSize).toBe(10);
      expect(metrics?.messageHistory.totalMessages).toBe(100);
    });
  });

  describe('stop', () => {
    it('should stop collecting metrics', async () => {
      const mockPostgresMetrics = {
        active_connections: 5,
        idle_connections: 3,
        waiting_connections: 1,
        total_connections: 9,
        query_count: 100,
        error_count: 2,
        avg_query_time: 0.5,
      };
      const mockRedisInfo =
        'connected_clients:10\nused_memory:1000\nkeyspace_hits:500\nkeyspace_misses:50\ntotal_commands_processed:1000';
      const mockRedisKeys = ['key1', 'key2'];
      const mockQueueMetrics = {
        queue_size: 10,
        processing_count: 5,
        dead_letter_count: 2,
        avg_processing_time: 1.5,
      };
      const mockHistoryMetrics = [
        {
          total: 100,
          type: 'task',
          sender: 'agent1',
          receiver: 'agent2',
          count: 50,
        },
      ];

      mockPostgres.query
        .mockResolvedValueOnce([mockPostgresMetrics])
        .mockResolvedValueOnce([mockQueueMetrics])
        .mockResolvedValueOnce(mockHistoryMetrics);
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
      mockRedisClient.keys.mockResolvedValue(mockRedisKeys);

      await monitor.start();
      await monitor.stop();
      const metrics = monitor.getMetrics();
      expect(metrics).toBeNull();
    });
  });

  describe('getMetrics', () => {
    it('should return null when no metrics collected', () => {
      const metrics = monitor.getMetrics();
      expect(metrics).toBeNull();
    });

    it('should return latest metrics after collection', async () => {
      const mockPostgresMetrics = {
        active_connections: 5,
        idle_connections: 3,
        waiting_connections: 1,
        total_connections: 9,
        query_count: 100,
        error_count: 2,
        avg_query_time: 0.5,
      };
      const mockRedisInfo =
        'connected_clients:10\nused_memory:1000\nkeyspace_hits:500\nkeyspace_misses:50\ntotal_commands_processed:1000';
      const mockRedisKeys = ['key1', 'key2'];
      const mockQueueMetrics = {
        queue_size: 10,
        processing_count: 5,
        dead_letter_count: 2,
        avg_processing_time: 1.5,
      };
      const mockHistoryMetrics = [
        {
          total: 100,
          type: 'task',
          sender: 'agent1',
          receiver: 'agent2',
          count: 50,
        },
      ];

      mockPostgres.query
        .mockResolvedValueOnce([mockPostgresMetrics])
        .mockResolvedValueOnce([mockQueueMetrics])
        .mockResolvedValueOnce(mockHistoryMetrics);
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
      mockRedisClient.keys.mockResolvedValue(mockRedisKeys);

      await monitor.start();
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics?.timestamp).toBeDefined();
      expect(metrics?.postgres).toBeDefined();
      expect(metrics?.redis).toBeDefined();
      expect(metrics?.messageQueue).toBeDefined();
      expect(metrics?.messageHistory).toBeDefined();
    });
  });

  describe('events', () => {
    it('should emit metrics event when new metrics are collected', async () => {
      const mockPostgresMetrics = {
        active_connections: 5,
        idle_connections: 3,
        waiting_connections: 1,
        total_connections: 9,
        query_count: 100,
        error_count: 2,
        avg_query_time: 0.5,
      };
      const mockRedisInfo =
        'connected_clients:10\nused_memory:1000\nkeyspace_hits:500\nkeyspace_misses:50\ntotal_commands_processed:1000';
      const mockRedisKeys = ['key1', 'key2'];
      const mockQueueMetrics = {
        queue_size: 10,
        processing_count: 5,
        dead_letter_count: 2,
        avg_processing_time: 1.5,
      };
      const mockHistoryMetrics = [
        {
          total: 100,
          type: 'task',
          sender: 'agent1',
          receiver: 'agent2',
          count: 50,
        },
      ];

      mockPostgres.query
        .mockResolvedValueOnce([mockPostgresMetrics])
        .mockResolvedValueOnce([mockQueueMetrics])
        .mockResolvedValueOnce(mockHistoryMetrics);
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
      mockRedisClient.keys.mockResolvedValue(mockRedisKeys);

      const metricsListener = jest.fn();
      monitor.on('metrics', metricsListener);

      await monitor.start();
      expect(metricsListener).toHaveBeenCalled();
      expect(metricsListener.mock.calls[0][0]).toHaveProperty('timestamp');
      expect(metricsListener.mock.calls[0][0]).toHaveProperty('postgres');
      expect(metricsListener.mock.calls[0][0]).toHaveProperty('redis');
      expect(metricsListener.mock.calls[0][0]).toHaveProperty('messageQueue');
      expect(metricsListener.mock.calls[0][0]).toHaveProperty('messageHistory');
    });

    it('should emit error event when metrics collection fails', async () => {
      const error = new Error('Test error');
      mockPostgres.query.mockRejectedValue(error);

      const errorListener = jest.fn();
      monitor.on('error', errorListener);

      await monitor.start();
      expect(errorListener).toHaveBeenCalledWith(error);
    });
  });
});
