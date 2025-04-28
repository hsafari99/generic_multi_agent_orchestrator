import { ToolAccessManager, ToolAccess } from '../core/tools/access-manager';
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
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  return {
    RedisClient: {
      getInstance: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockRedisClient),
      }),
    },
  };
});

describe('ToolAccessManager', () => {
  let accessManager: ToolAccessManager;
  let mockPostgres: jest.Mocked<PostgresClient>;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockRedisClient: any;

  const mockAccess: ToolAccess = {
    toolId: 'test-tool',
    agentId: 'test-agent',
    permissions: ['read', 'write'],
    metadata: { role: 'admin' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres = new PostgresClient({ connectionString: 'test' }) as jest.Mocked<PostgresClient>;
    mockRedis = RedisClient.getInstance() as jest.Mocked<RedisClient>;
    mockRedisClient = mockRedis.getClient();
    accessManager = new ToolAccessManager({ postgres: mockPostgres, redis: mockRedis });
  });

  describe('initialize', () => {
    it('should create tables', async () => {
      await accessManager.initialize();
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS tool_access')
      );
    });
  });

  describe('grantAccess', () => {
    it('should grant access with permissions', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const accessListener = jest.fn();
      accessManager.on('accessGranted', accessListener);

      await accessManager.grantAccess(
        mockAccess.toolId,
        mockAccess.agentId,
        mockAccess.permissions,
        mockAccess.metadata
      );

      expect(mockPostgres.query).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(accessListener).toHaveBeenCalledWith({
        toolId: mockAccess.toolId,
        agentId: mockAccess.agentId,
        permissions: mockAccess.permissions,
      });
    });

    it('should grant access without metadata', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const accessListener = jest.fn();
      accessManager.on('accessGranted', accessListener);

      await accessManager.grantAccess(
        mockAccess.toolId,
        mockAccess.agentId,
        mockAccess.permissions
      );

      expect(mockPostgres.query).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(accessListener).toHaveBeenCalledWith({
        toolId: mockAccess.toolId,
        agentId: mockAccess.agentId,
        permissions: mockAccess.permissions,
      });
    });
  });

  describe('revokeAccess', () => {
    it('should revoke access', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const accessListener = jest.fn();
      accessManager.on('accessRevoked', accessListener);

      await accessManager.revokeAccess(mockAccess.toolId, mockAccess.agentId);

      expect(mockPostgres.query).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalled();
      expect(accessListener).toHaveBeenCalledWith({
        toolId: mockAccess.toolId,
        agentId: mockAccess.agentId,
      });
    });
  });

  describe('getAccess', () => {
    it('should get access from cache', async () => {
      const cachedAccess = {
        ...mockAccess,
        createdAt: mockAccess.createdAt.toISOString(),
        updatedAt: mockAccess.updatedAt.toISOString(),
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedAccess));

      const access = await accessManager.getAccess(mockAccess.toolId, mockAccess.agentId);

      expect(access).toEqual({
        ...mockAccess,
        createdAt: new Date(cachedAccess.createdAt),
        updatedAt: new Date(cachedAccess.updatedAt),
      });
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockPostgres.query).not.toHaveBeenCalled();
    });

    it('should get access from database if not in cache', async () => {
      const dbAccess = {
        tool_id: mockAccess.toolId,
        agent_id: mockAccess.agentId,
        permissions: mockAccess.permissions,
        metadata: mockAccess.metadata,
        created_at: mockAccess.createdAt,
        updated_at: mockAccess.updatedAt,
      };
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([dbAccess]);

      const access = await accessManager.getAccess(mockAccess.toolId, mockAccess.agentId);

      expect(access).toEqual(mockAccess);
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockPostgres.query).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should return null for non-existent access', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([]);

      const access = await accessManager.getAccess('non-existent', 'non-existent');

      expect(access).toBeNull();
    });

    it('should handle invalid JSON from cache', async () => {
      mockRedisClient.get.mockResolvedValue('invalid json');

      await expect(
        accessManager.getAccess(mockAccess.toolId, mockAccess.agentId)
      ).rejects.toThrow();
    });

    it('should use first row if multiple rows returned from database', async () => {
      const dbAccess1 = {
        tool_id: mockAccess.toolId,
        agent_id: mockAccess.agentId,
        permissions: mockAccess.permissions,
        metadata: mockAccess.metadata,
        created_at: mockAccess.createdAt,
        updated_at: mockAccess.updatedAt,
      };
      const dbAccess2 = {
        tool_id: mockAccess.toolId,
        agent_id: 'another-agent',
        permissions: ['read'],
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([dbAccess1, dbAccess2]);

      const access = await accessManager.getAccess(mockAccess.toolId, mockAccess.agentId);

      expect(access).toEqual(mockAccess);
    });
  });

  describe('listAccess', () => {
    it('should return all access entries for a tool', async () => {
      const dbAccess = {
        tool_id: mockAccess.toolId,
        agent_id: mockAccess.agentId,
        permissions: mockAccess.permissions,
        metadata: mockAccess.metadata,
        created_at: mockAccess.createdAt,
        updated_at: mockAccess.updatedAt,
      };
      mockPostgres.query.mockResolvedValueOnce([dbAccess]);

      const result = await accessManager.listAccess(mockAccess.toolId);

      expect(result).toEqual([mockAccess]);
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM tool_access'),
        [mockAccess.toolId]
      );
    });

    it('should return empty array if no access entries', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await accessManager.listAccess(mockAccess.toolId);

      expect(result).toEqual([]);
    });
  });

  describe('hasAccess', () => {
    it('should return true for agent with required permissions', async () => {
      const dbAccess = {
        tool_id: mockAccess.toolId,
        agent_id: mockAccess.agentId,
        permissions: mockAccess.permissions,
        metadata: mockAccess.metadata,
        created_at: mockAccess.createdAt,
        updated_at: mockAccess.updatedAt,
      };
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([dbAccess]);

      const hasAccess = await accessManager.hasAccess(mockAccess.toolId, mockAccess.agentId, [
        'read',
      ]);

      expect(hasAccess).toBe(true);
    });

    it('should return false for agent without required permissions', async () => {
      const dbAccess = {
        tool_id: mockAccess.toolId,
        agent_id: mockAccess.agentId,
        permissions: ['read'],
        metadata: mockAccess.metadata,
        created_at: mockAccess.createdAt,
        updated_at: mockAccess.updatedAt,
      };
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([dbAccess]);

      const hasAccess = await accessManager.hasAccess(mockAccess.toolId, mockAccess.agentId, [
        'write',
      ]);

      expect(hasAccess).toBe(false);
    });

    it('should return false for non-existent access', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([]);

      const hasAccess = await accessManager.hasAccess('non-existent', 'non-existent', ['read']);

      expect(hasAccess).toBe(false);
    });

    it('should return true if access exists and no required permissions', async () => {
      const dbAccess = {
        tool_id: mockAccess.toolId,
        agent_id: mockAccess.agentId,
        permissions: mockAccess.permissions,
        metadata: mockAccess.metadata,
        created_at: mockAccess.createdAt,
        updated_at: mockAccess.updatedAt,
      };
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([dbAccess]);

      const hasAccess = await accessManager.hasAccess(mockAccess.toolId, mockAccess.agentId);

      expect(hasAccess).toBe(true);
    });

    it('should return false if access exists but permissions array is empty', async () => {
      const dbAccess = {
        tool_id: mockAccess.toolId,
        agent_id: mockAccess.agentId,
        permissions: [],
        metadata: mockAccess.metadata,
        created_at: mockAccess.createdAt,
        updated_at: mockAccess.updatedAt,
      };
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([dbAccess]);

      const hasAccess = await accessManager.hasAccess(mockAccess.toolId, mockAccess.agentId, [
        'read',
      ]);

      expect(hasAccess).toBe(false);
    });
  });
});
