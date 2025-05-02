import { StatePersistence } from '../core/agent/state-persistence';
import { PostgresClient } from '../core/storage/postgres';
import { RedisClient } from '../core/cache/client';
import { AgentState, AgentStatus, HealthStatus } from '../core/agent/types';

// Mock PostgresClient
jest.mock('../core/storage/postgres', () => ({
  PostgresClient: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
  })),
}));

// Mock RedisClient
jest.mock('../core/cache/client', () => ({
  RedisClient: {
    getInstance: jest.fn().mockImplementation(() => ({
      getClient: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      }),
    })),
  },
}));

describe('StatePersistence', () => {
  let persistence: StatePersistence;
  let mockPostgres: jest.Mocked<PostgresClient>;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockRedisClient: any;

  const mockState: AgentState = {
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres = new PostgresClient({ connectionString: 'test' }) as jest.Mocked<PostgresClient>;
    mockRedis = RedisClient.getInstance() as jest.Mocked<RedisClient>;
    mockRedisClient = mockRedis.getClient();
    persistence = new StatePersistence({ postgres: mockPostgres, redis: mockRedis });
  });

  afterEach(() => {
    persistence.stopSync();
  });

  describe('saveState', () => {
    it('should save state to both cache and database', async () => {
      const agentId = 'test-agent';

      mockRedisClient.set.mockResolvedValue('OK');
      mockPostgres.query.mockResolvedValue([]);

      await persistence.saveState(agentId, mockState);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `agent:${agentId}:state`,
        expect.any(String),
        { EX: 300 }
      );
      expect(mockPostgres.query).toHaveBeenCalledWith(expect.any(String), [
        agentId,
        expect.any(String),
      ]);
    });

    it('should emit stateSaved event', async () => {
      const agentId = 'test-agent';
      const listener = jest.fn();

      persistence.on('stateSaved', listener);
      await persistence.saveState(agentId, mockState);

      expect(listener).toHaveBeenCalledWith({ agentId, state: mockState });
    });

    it('should handle errors', async () => {
      const agentId = 'test-agent';
      const error = new Error('Test error');
      const listener = jest.fn();

      mockRedisClient.set.mockRejectedValue(error);
      persistence.on('error', listener);

      await expect(persistence.saveState(agentId, mockState)).rejects.toThrow(error);
      expect(listener).toHaveBeenCalledWith(error);
    });
  });

  describe('loadState', () => {
    it('should load state from cache if available', async () => {
      const agentId = 'test-agent';
      const serializedState = JSON.stringify(mockState);

      mockRedisClient.get.mockResolvedValue(serializedState);

      const state = await persistence.loadState(agentId);

      expect(state).toEqual(mockState);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`agent:${agentId}:state`);
      expect(mockPostgres.query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE'));
    });

    it('should load state from database if not in cache', async () => {
      const agentId = 'test-agent';
      const serializedState = JSON.stringify(mockState);

      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValue([{ state: serializedState }]);

      const state = await persistence.loadState(agentId);

      expect(state).toEqual(mockState);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`agent:${agentId}:state`);
      expect(mockPostgres.query).toHaveBeenCalledWith(expect.any(String), [agentId]);
      expect(mockRedisClient.set).toHaveBeenCalledWith(`agent:${agentId}:state`, serializedState, {
        EX: 300,
      });
    });

    it('should return null if state not found', async () => {
      const agentId = 'test-agent';

      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValue([]);

      const state = await persistence.loadState(agentId);

      expect(state).toBeNull();
    });

    it('should handle errors', async () => {
      const agentId = 'test-agent';
      const error = new Error('Test error');
      const listener = jest.fn();

      mockRedisClient.get.mockRejectedValue(error);
      persistence.on('error', listener);

      await expect(persistence.loadState(agentId)).rejects.toThrow(error);
      expect(listener).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteState', () => {
    it('should delete state from both cache and database', async () => {
      const agentId = 'test-agent';

      mockRedisClient.del.mockResolvedValue(1);
      mockPostgres.query.mockResolvedValue([]);

      await persistence.deleteState(agentId);

      expect(mockRedisClient.del).toHaveBeenCalledWith(`agent:${agentId}:state`);
      expect(mockPostgres.query).toHaveBeenCalledWith(expect.any(String), [agentId]);
    });

    it('should emit stateDeleted event', async () => {
      const agentId = 'test-agent';
      const listener = jest.fn();

      persistence.on('stateDeleted', listener);
      await persistence.deleteState(agentId);

      expect(listener).toHaveBeenCalledWith({ agentId });
    });

    it('should handle errors', async () => {
      const agentId = 'test-agent';
      const error = new Error('Test error');
      const listener = jest.fn();

      mockRedisClient.del.mockRejectedValue(error);
      persistence.on('error', listener);

      await expect(persistence.deleteState(agentId)).rejects.toThrow(error);
      expect(listener).toHaveBeenCalledWith(error);
    });
  });

  describe('syncStates', () => {
    it('should emit statesSynced event', async () => {
      const listener = jest.fn();

      mockPostgres.query.mockResolvedValue([]);
      persistence.on('statesSynced', listener);

      // Call syncStates directly instead of using startSync
      await (persistence as any).syncStates();

      expect(listener).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Test error');
      const listener = jest.fn();

      // Mock the error for the first query
      mockPostgres.query.mockRejectedValueOnce(error);
      persistence.on('error', listener);

      // Call syncStates directly instead of using startSync
      await (persistence as any).syncStates();

      expect(listener).toHaveBeenCalledWith(error);
    });
  });

  describe('cleanupOldStates', () => {
    it('should delete old states from database', async () => {
      const maxAge = 3600; // 1 hour

      mockPostgres.query.mockResolvedValue([]);

      await persistence.cleanupOldStates(maxAge);

      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM agent_states')
      );
    });

    it('should emit statesCleaned event', async () => {
      const listener = jest.fn();

      mockPostgres.query.mockResolvedValue([]);
      persistence.on('statesCleaned', listener);

      await persistence.cleanupOldStates(3600);

      expect(listener).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Test error');
      const listener = jest.fn();

      mockPostgres.query.mockRejectedValue(error);
      persistence.on('error', listener);

      await expect(persistence.cleanupOldStates(3600)).rejects.toThrow(error);
      expect(listener).toHaveBeenCalledWith(error);
    });
  });
});
