import { ToolVersionManager, ToolVersion } from '../core/tools/version-manager';
import { PostgresClient } from '../core/storage/postgres';
import { RedisClient } from '../core/cache/client';
import { Tool } from '../core/tools/tool-manager';

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

describe('ToolVersionManager', () => {
  let versionManager: ToolVersionManager;
  let mockPostgres: jest.Mocked<PostgresClient>;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockRedisClient: any;

  const mockTool: Tool = {
    id: 'test-tool',
    version: '1.0.0',
    name: 'Test Tool',
    description: 'A test tool',
    parameters: [
      {
        name: 'param1',
        type: 'string',
        description: 'Test parameter',
        required: true,
      },
    ],
    capabilities: ['test'],
    metadata: { category: 'test' },
    execute: jest.fn(),
  };

  const mockVersion: ToolVersion = {
    toolId: 'test-tool',
    version: '1.0.0',
    parameters: mockTool.parameters,
    capabilities: mockTool.capabilities,
    metadata: mockTool.metadata,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres = new PostgresClient({ connectionString: 'test' }) as jest.Mocked<PostgresClient>;
    mockRedis = RedisClient.getInstance() as jest.Mocked<RedisClient>;
    mockRedisClient = mockRedis.getClient();
    versionManager = new ToolVersionManager({ postgres: mockPostgres, redis: mockRedis });
  });

  describe('initialize', () => {
    it('should create tables', async () => {
      await versionManager.initialize();
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS tool_versions')
      );
    });
  });

  describe('addVersion', () => {
    it('should add a valid version', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);
      mockRedisClient.get.mockResolvedValue(null);

      const versionListener = jest.fn();
      versionManager.on('versionAdded', versionListener);

      await versionManager.addVersion(mockTool);

      expect(mockPostgres.query).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(versionListener).toHaveBeenCalledWith({
        toolId: mockTool.id,
        version: mockTool.version,
      });
    });

    it('should throw error for invalid version format', async () => {
      const invalidTool = { ...mockTool, version: 'invalid' };
      await expect(versionManager.addVersion(invalidTool)).rejects.toThrow(
        'Invalid version format'
      );
    });

    it('should throw error for duplicate version', async () => {
      mockPostgres.query.mockResolvedValueOnce([mockVersion]);
      await expect(versionManager.addVersion(mockTool)).rejects.toThrow(
        'Version 1.0.0 already exists'
      );
    });
  });

  describe('getVersion', () => {
    it('should get version from cache', async () => {
      const cachedVersion = {
        ...mockVersion,
        createdAt: mockVersion.createdAt.toISOString(),
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedVersion));

      const version = await versionManager.getVersion(mockTool.id, mockTool.version);

      expect(version).toEqual({
        ...mockVersion,
        createdAt: new Date(cachedVersion.createdAt),
      });
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockPostgres.query).not.toHaveBeenCalled();
    });

    it('should get version from database if not in cache', async () => {
      const dbVersion = {
        tool_id: 'test-tool',
        version: '1.0.0',
        parameters: mockTool.parameters,
        capabilities: mockTool.capabilities,
        metadata: mockTool.metadata,
        created_at: new Date(),
      };
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([dbVersion]);

      const version = await versionManager.getVersion(mockTool.id, mockTool.version);

      expect(version).toEqual({
        toolId: dbVersion.tool_id,
        version: dbVersion.version,
        parameters: dbVersion.parameters,
        capabilities: dbVersion.capabilities,
        metadata: dbVersion.metadata,
        createdAt: dbVersion.created_at,
      });
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockPostgres.query).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should return null for non-existent version', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([]);

      const version = await versionManager.getVersion(mockTool.id, '2.0.0');

      expect(version).toBeNull();
    });
  });

  describe('listVersions', () => {
    it('should return all versions for a tool', async () => {
      const versions = [
        {
          tool_id: 'test-tool',
          version: '1.0.0',
          parameters: mockTool.parameters,
          capabilities: mockTool.capabilities,
          metadata: mockTool.metadata,
          created_at: new Date(),
        },
        {
          tool_id: 'test-tool',
          version: '1.1.0',
          parameters: mockTool.parameters,
          capabilities: mockTool.capabilities,
          metadata: mockTool.metadata,
          created_at: new Date(),
        },
      ];
      mockPostgres.query.mockResolvedValueOnce(versions);

      const result = await versionManager.listVersions(mockTool.id);

      expect(result).toEqual(
        versions.map(v => ({
          toolId: v.tool_id,
          version: v.version,
          parameters: v.parameters,
          capabilities: v.capabilities,
          metadata: v.metadata,
          createdAt: v.created_at,
        }))
      );
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM tool_versions'),
        [mockTool.id]
      );
    });
  });

  describe('getLatestVersion', () => {
    it('should return the latest version', async () => {
      const latestVersion = {
        tool_id: 'test-tool',
        version: '2.0.0',
        parameters: mockTool.parameters,
        capabilities: mockTool.capabilities,
        metadata: mockTool.metadata,
        created_at: new Date(),
      };
      mockPostgres.query.mockResolvedValueOnce([latestVersion]);

      const version = await versionManager.getLatestVersion(mockTool.id);

      expect(version).toEqual({
        toolId: latestVersion.tool_id,
        version: latestVersion.version,
        parameters: latestVersion.parameters,
        capabilities: latestVersion.capabilities,
        metadata: latestVersion.metadata,
        createdAt: latestVersion.created_at,
      });
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY version DESC'),
        [mockTool.id]
      );
    });

    it('should return null if no versions exist', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const version = await versionManager.getLatestVersion(mockTool.id);

      expect(version).toBeNull();
    });
  });
});
