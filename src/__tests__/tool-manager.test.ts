import { ToolManager, Tool } from '../core/tools/tool-manager';
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

describe('ToolManager', () => {
  let toolManager: ToolManager;
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres = new PostgresClient({ connectionString: 'test' }) as jest.Mocked<PostgresClient>;
    mockRedis = RedisClient.getInstance() as jest.Mocked<RedisClient>;
    mockRedisClient = mockRedis.getClient();
    toolManager = new ToolManager({ postgres: mockPostgres, redis: mockRedis });
  });

  describe('initialize', () => {
    it('should create tables and load tools', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);
      mockPostgres.query.mockResolvedValueOnce([]);

      await toolManager.initialize();

      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS tools');
      expect(mockPostgres.query.mock.calls[1][0]).toContain('SELECT * FROM tools');
    });
  });

  describe('registerTool', () => {
    it('should register a valid tool', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);
      mockPostgres.query.mockResolvedValueOnce([]);
      mockPostgres.query.mockResolvedValueOnce([]);
      mockRedisClient.get.mockResolvedValue(null);

      const registerListener = jest.fn();
      toolManager.on('toolRegistered', registerListener);

      await toolManager.registerTool(mockTool);

      expect(mockPostgres.query).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(registerListener).toHaveBeenCalledWith(mockTool);
    });

    it('should throw error for invalid tool', async () => {
      const invalidTool = { ...mockTool, id: '' };
      await expect(toolManager.registerTool(invalidTool)).rejects.toThrow(
        'Invalid tool configuration'
      );
    });

    it('should throw error for duplicate tool', async () => {
      mockPostgres.query.mockResolvedValueOnce([mockTool]);
      await expect(toolManager.registerTool(mockTool)).rejects.toThrow(
        'Tool test-tool is already registered'
      );
    });
  });

  describe('unregisterTool', () => {
    it('should unregister an existing tool', async () => {
      mockPostgres.query.mockResolvedValueOnce([mockTool]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const unregisterListener = jest.fn();
      toolManager.on('toolUnregistered', unregisterListener);

      await toolManager.unregisterTool(mockTool.id);

      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.del).toHaveBeenCalled();
      expect(unregisterListener).toHaveBeenCalledWith(mockTool.id);
    });

    it('should throw error for non-existent tool', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);
      await expect(toolManager.unregisterTool('non-existent')).rejects.toThrow(
        'Tool non-existent not found'
      );
    });
  });

  describe('getTool', () => {
    it('should get tool from cache', async () => {
      const toolWithoutExecute = { ...mockTool };
      delete toolWithoutExecute.execute;
      mockRedisClient.get.mockResolvedValue(JSON.stringify(toolWithoutExecute));

      const tool = await toolManager.getTool(mockTool.id);

      expect(tool).toEqual(toolWithoutExecute);
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockPostgres.query).not.toHaveBeenCalled();
    });

    it('should get tool from database if not in cache', async () => {
      const toolWithoutExecute = { ...mockTool };
      delete toolWithoutExecute.execute;
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([toolWithoutExecute]);

      const tool = await toolManager.getTool(mockTool.id);

      expect(tool).toEqual(toolWithoutExecute);
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockPostgres.query).toHaveBeenCalled();
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should return null for non-existent tool', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPostgres.query.mockResolvedValueOnce([]);

      const tool = await toolManager.getTool('non-existent');

      expect(tool).toBeNull();
    });
  });

  describe('listTools', () => {
    it('should return all registered tools', async () => {
      const tools = await toolManager.listTools();
      expect(Array.isArray(tools)).toBe(true);
    });
  });
});
