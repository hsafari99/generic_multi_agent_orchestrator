import { StateRecovery } from '../../core/agent/state-recovery';
import { PostgresClient } from '../../core/storage/postgres';
import { RedisClient } from '../../core/cache/client';
import { AgentState, AgentStatus, HealthStatus } from '../../core/agent/types';
import { Logger } from '../../core/logging/logger';

// Mock dependencies
jest.mock('../../core/storage/postgres');
jest.mock('../../core/cache/client');
jest.mock('../../core/logging/logger');

describe('StateRecovery', () => {
  let stateRecovery: StateRecovery;
  let mockPostgres: jest.Mocked<PostgresClient>;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockState: AgentState;
  let mockRedisClient: {
    get: jest.Mock;
    set: jest.Mock;
    ping: jest.Mock;
  };
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    // Setup mock state with dates as strings
    mockState = {
      status: AgentStatus.READY,
      health: {
        status: HealthStatus.HEALTHY,
        lastCheck: new Date(),
        metrics: {
          cpu: 0,
          memory: 0,
          responseTime: 0,
          errorRate: 0,
        },
      },
      activeOperations: 0,
      lastStatusChange: new Date(),
      lastHealthCheck: new Date(),
      resources: {
        cpu: 0,
        memory: 0,
        network: {
          bytesIn: 0,
          bytesOut: 0,
        },
      },
      capabilities: [],
      load: 0,
      isAvailable: true,
    };

    // Setup mock clients
    mockPostgres = {
      query: jest.fn(),
    } as unknown as jest.Mocked<PostgresClient>;

    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      ping: jest.fn(),
    };

    mockRedis = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    } as unknown as jest.Mocked<RedisClient>;

    // Create instance
    stateRecovery = new StateRecovery({
      postgres: mockPostgres,
      redis: mockRedis,
      maxRetries: 3,
      retryDelay: 100,
      logger: mockLogger,
    });
  });

  afterEach(async () => {
    // Cleanup resources after each test
    await stateRecovery.cleanup();
  });

  afterAll(async () => {
    // Final cleanup after all tests
    await stateRecovery.cleanup();
  });

  describe('Database Recovery', () => {
    it('should successfully recover state from database', async () => {
      const serializedState = JSON.stringify(mockState);
      mockPostgres.query.mockResolvedValueOnce([{ state: serializedState }]);

      const result = await stateRecovery.recoverFromDatabase('agent1');
      expect(result).toEqual(mockState);
      expect(mockPostgres.query).toHaveBeenCalledTimes(1);
    });

    it('should return null when no state exists in database', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await stateRecovery.recoverFromDatabase('agent1');
      expect(result).toBeNull();
      expect(mockPostgres.query).toHaveBeenCalledTimes(1);
    });

    it('should retry on database failure', async () => {
      const serializedState = JSON.stringify(mockState);
      mockPostgres.query
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce([{ state: serializedState }]);

      const result = await stateRecovery.recoverFromDatabase('agent1');
      expect(result).toEqual(mockState);
      expect(mockPostgres.query).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      mockPostgres.query
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(stateRecovery.recoverFromDatabase('agent1')).rejects.toThrow(
        'All database recovery attempts failed'
      );
      expect(mockPostgres.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cache Recovery', () => {
    it('should successfully recover state from cache', async () => {
      const serializedState = JSON.stringify(mockState);
      mockRedisClient.get.mockResolvedValueOnce(serializedState);

      const result = await stateRecovery.recoverFromCache('agent1');
      expect(result).toEqual(mockState);
      expect(mockRedisClient.get).toHaveBeenCalledTimes(1);
    });

    it('should return null when no state exists in cache', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await stateRecovery.recoverFromCache('agent1');
      expect(result).toBeNull();
      expect(mockRedisClient.get).toHaveBeenCalledTimes(1);
    });

    it('should retry on cache failure', async () => {
      const serializedState = JSON.stringify(mockState);
      mockRedisClient.get
        .mockRejectedValueOnce(new Error('Cache error'))
        .mockRejectedValueOnce(new Error('Cache error'))
        .mockResolvedValueOnce(serializedState);

      const result = await stateRecovery.recoverFromCache('agent1');
      expect(result).toEqual(mockState);
      expect(mockRedisClient.get).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      mockRedisClient.get
        .mockRejectedValueOnce(new Error('Cache error'))
        .mockRejectedValueOnce(new Error('Cache error'))
        .mockRejectedValueOnce(new Error('Cache error'));

      await expect(stateRecovery.recoverFromCache('agent1')).rejects.toThrow(
        'All cache recovery attempts failed'
      );
      expect(mockRedisClient.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts using most recent state', async () => {
      const oldState = {
        ...mockState,
        lastStatusChange: new Date(Date.now() - 1000),
      };
      const newState = {
        ...mockState,
        lastStatusChange: new Date(),
      };

      mockPostgres.query.mockResolvedValueOnce([{ state: JSON.stringify(oldState) }]);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(newState));

      const result = await stateRecovery.recoverState('agent1');
      expect(result).toEqual(newState);
    });

    it('should use database state when cache is empty', async () => {
      const serializedState = JSON.stringify(mockState);
      mockPostgres.query.mockResolvedValueOnce([{ state: serializedState }]);
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await stateRecovery.recoverState('agent1');
      expect(result).toEqual(mockState);
    });

    it('should use cache state when database is empty', async () => {
      const serializedState = JSON.stringify(mockState);
      mockPostgres.query.mockResolvedValueOnce([]);
      mockRedisClient.get.mockResolvedValueOnce(serializedState);

      const result = await stateRecovery.recoverState('agent1');
      expect(result).toEqual(mockState);
    });

    it('should return null when both storages are empty', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await stateRecovery.recoverState('agent1');
      expect(result).toBeNull();
    });
  });

  describe('State Validation', () => {
    it('should validate state structure', async () => {
      const invalidState = { ...mockState, status: undefined };
      const serializedState = JSON.stringify(invalidState);
      mockPostgres.query.mockResolvedValueOnce([{ state: serializedState }]);

      await expect(stateRecovery.recoverFromDatabase('agent1')).rejects.toThrow(
        'Invalid state recovered from database'
      );
    });

    it('should validate timestamps', async () => {
      const invalidState = {
        ...mockState,
        lastStatusChange: new Date(Date.now() + 1000),
      };
      const serializedState = JSON.stringify(invalidState);
      mockPostgres.query.mockResolvedValueOnce([{ state: serializedState }]);

      await expect(stateRecovery.recoverFromDatabase('agent1')).rejects.toThrow(
        'Invalid state recovered from database'
      );
    });

    it('should validate health status', async () => {
      const invalidState = {
        ...mockState,
        health: {
          ...mockState.health,
          status: 'invalid' as HealthStatus,
        },
      };
      const serializedState = JSON.stringify(invalidState);
      mockPostgres.query.mockResolvedValueOnce([{ state: serializedState }]);

      await expect(stateRecovery.recoverFromDatabase('agent1')).rejects.toThrow(
        'Invalid state recovered from database'
      );
    });
  });

  describe('Recovery Monitoring', () => {
    it('should track successful recoveries', async () => {
      const serializedState = JSON.stringify(mockState);
      mockPostgres.query.mockResolvedValueOnce([{ state: serializedState }]);

      await stateRecovery.recoverFromDatabase('agent1');
      const metrics = stateRecovery.getMetrics();

      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.totalAttempts).toBe(1);
    });

    it('should track failed recoveries', async () => {
      mockPostgres.query
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(stateRecovery.recoverFromDatabase('agent1')).rejects.toThrow();
      const metrics = stateRecovery.getMetrics();

      expect(metrics.successCount).toBe(0);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.totalAttempts).toBe(3);
    });

    it('should track recovery time', async () => {
      const serializedState = JSON.stringify(mockState);
      // Add a small delay to the mock query to ensure we can measure recovery time
      mockPostgres.query.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return [{ state: serializedState }];
      });

      await stateRecovery.recoverFromDatabase('agent1');
      const metrics = stateRecovery.getMetrics();

      expect(metrics.totalRecoveryTime).toBeGreaterThan(0);
      expect(metrics.lastRecoveryTime).toBeGreaterThan(0);
    });

    it('should track error types', async () => {
      mockPostgres.query
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(stateRecovery.recoverFromDatabase('agent1')).rejects.toThrow();
      const metrics = stateRecovery.getMetrics();

      expect(metrics.errorTypes.get('Database error')).toBe(3);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      await stateRecovery.cleanup();
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });
  });
});
