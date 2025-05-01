import { ToolMonitor, ToolMetrics } from '../core/tools/monitor';
import { PostgresClient } from '../core/storage/postgres';
import { RedisClient } from '../core/cache/client';
import { Logger } from '../core/logging/logger';

jest.mock('../core/storage/postgres');
jest.mock('../core/cache/client');
jest.mock('../core/logging/logger');

describe('ToolMonitor', () => {
  let monitor: ToolMonitor;
  let mockPostgres: jest.Mocked<PostgresClient>;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres = new PostgresClient({
      connectionString: 'mock-connection-string',
    }) as jest.Mocked<PostgresClient>;
    mockRedis = {
      getClient: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      }),
    } as unknown as jest.Mocked<RedisClient>;
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);

    monitor = new ToolMonitor({
      postgres: mockPostgres,
      redis: mockRedis,
      checkInterval: 1000,
    });
  });

  describe('initialization', () => {
    it('should create tables on initialize', async () => {
      // Mock both postgres queries
      mockPostgres.query
        // First query - create tables
        .mockResolvedValueOnce([])
        // Second query - load metrics
        .mockResolvedValueOnce([]);

      await monitor.initialize();
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS tool_metrics')
      );
    });

    it('should load metrics on initialize', async () => {
      const mockMetrics = [
        {
          tool_id: 'test-tool',
          total_executions: 10,
          successful_executions: 8,
          failed_executions: 2,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'success',
          last_error: '',
          health_status: 'healthy',
          metadata: {},
        },
      ];

      // Mock both postgres queries
      mockPostgres.query
        // First query - create tables
        .mockResolvedValueOnce([])
        // Second query - load metrics
        .mockResolvedValueOnce(mockMetrics);

      await monitor.initialize();
      const metrics = await monitor.listMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].toolId).toBe('test-tool');
    });
  });

  describe('metrics collection', () => {
    it('should collect metrics periodically', async () => {
      const mockMetrics = [
        {
          tool_id: 'test-tool',
          total_executions: 10,
          successful_executions: 8,
          failed_executions: 2,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'success',
          last_error: '',
          health_status: 'healthy',
          metadata: {},
        },
      ];

      mockPostgres.query.mockResolvedValueOnce(mockMetrics);
      await monitor.start();

      // Wait for first collection
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM tool_metrics')
      );
    });

    it('should stop collecting metrics', async () => {
      // Mock the postgres query for collectMetrics
      mockPostgres.query.mockResolvedValueOnce([
        {
          tool_id: 'test-tool',
          total_executions: 10,
          successful_executions: 8,
          failed_executions: 2,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'success',
          last_error: '',
          health_status: 'healthy',
          metadata: {},
        },
      ]);

      await monitor.start();
      await monitor.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping tool monitor');
    });
  });

  describe('execution recording', () => {
    it('should record successful execution', async () => {
      const toolId = 'test-tool';
      const duration = 100;
      const status = 'success';
      const parameters = { param1: 'value1' };
      const result = { output: 'test' };
      const metadata = { source: 'test' };

      // Mock all postgres queries
      mockPostgres.query
        // First query - insert into execution history
        .mockResolvedValueOnce([])
        // Second query - insert/update metrics
        .mockResolvedValueOnce([])
        // Third query - get metrics
        .mockResolvedValueOnce([
          {
            tool_id: toolId,
            total_executions: 10,
            successful_executions: 8,
            failed_executions: 2,
            average_execution_time: 100,
            last_execution_time: new Date(),
            last_execution_status: 'success',
            last_error: '',
            health_status: 'healthy',
            metadata: {},
          },
        ]);

      await monitor.recordExecution(
        toolId,
        duration,
        status,
        undefined,
        parameters,
        result,
        metadata
      );

      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tool_execution_history'),
        expect.arrayContaining([toolId, duration, status])
      );
    });

    it('should record failed execution', async () => {
      const toolId = 'test-tool';
      const duration = 100;
      const status = 'failure';
      const error = 'Test error';

      // Mock all postgres queries
      mockPostgres.query
        // First query - insert into execution history
        .mockResolvedValueOnce([])
        // Second query - insert/update metrics
        .mockResolvedValueOnce([])
        // Third query - get metrics
        .mockResolvedValueOnce([
          {
            tool_id: toolId,
            total_executions: 10,
            successful_executions: 8,
            failed_executions: 2,
            average_execution_time: 100,
            last_execution_time: new Date(),
            last_execution_status: 'success',
            last_error: '',
            health_status: 'healthy',
            metadata: {},
          },
        ]);

      await monitor.recordExecution(toolId, duration, status, error);

      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tool_execution_history'),
        expect.arrayContaining([toolId, duration, status, error])
      );
    });
  });

  describe('metrics retrieval', () => {
    it('should get metrics from cache if available', async () => {
      const toolId = 'test-tool';
      const cachedMetrics: ToolMetrics = {
        toolId,
        totalExecutions: 10,
        successfulExecutions: 8,
        failedExecutions: 2,
        averageExecutionTime: 100,
        lastExecutionTime: Date.now(),
        lastExecutionStatus: 'success',
        lastError: '',
        healthStatus: 'healthy',
        metadata: {},
        timestamp: Date.now(),
      };

      (mockRedis.getClient().get as jest.Mock).mockImplementationOnce(key => {
        if (key === `tool:${toolId}:metrics`) {
          return Promise.resolve(JSON.stringify(cachedMetrics));
        }
        return Promise.resolve(null);
      });

      const metrics = await monitor.getMetrics(toolId);
      expect(metrics).toEqual(cachedMetrics);
      expect(mockPostgres.query).not.toHaveBeenCalled();
    });

    it('should get metrics from database if not in cache', async () => {
      const toolId = 'test-tool';
      const dbMetrics = [
        {
          tool_id: toolId,
          total_executions: 10,
          successful_executions: 8,
          failed_executions: 2,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'success',
          last_error: '',
          health_status: 'healthy',
          metadata: {},
        },
      ];

      (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(null);
      mockPostgres.query.mockResolvedValueOnce(dbMetrics);

      const metrics = await monitor.getMetrics(toolId);
      expect(metrics).toBeDefined();
      expect(metrics?.toolId).toBe(toolId);
    });
  });

  describe('health status calculation', () => {
    it('should return healthy for new tool with success', async () => {
      const healthStatus = monitor['calculateHealthStatus']('new-tool', 'success');
      expect(healthStatus).toBe('healthy');
    });

    it('should return unhealthy for new tool with failure', async () => {
      const healthStatus = monitor['calculateHealthStatus']('new-tool', 'failure');
      expect(healthStatus).toBe('unhealthy');
    });

    it('should return degraded for tool with 30% failure rate', async () => {
      const toolId = 'test-tool';
      monitor['metrics'].set(toolId, {
        toolId,
        totalExecutions: 10,
        successfulExecutions: 7,
        failedExecutions: 3,
        averageExecutionTime: 100,
        lastExecutionTime: Date.now(),
        lastExecutionStatus: 'success',
        lastError: '',
        healthStatus: 'healthy',
        metadata: {},
        timestamp: Date.now(),
      });

      const healthStatus = monitor['calculateHealthStatus'](toolId, 'failure');
      expect(healthStatus).toBe('degraded');
    });

    it('should return unhealthy for tool with 60% failure rate', async () => {
      const toolId = 'test-tool';
      monitor['metrics'].set(toolId, {
        toolId,
        totalExecutions: 10,
        successfulExecutions: 4,
        failedExecutions: 6,
        averageExecutionTime: 100,
        lastExecutionTime: Date.now(),
        lastExecutionStatus: 'success',
        lastError: '',
        healthStatus: 'healthy',
        metadata: {},
        timestamp: Date.now(),
      });

      const healthStatus = monitor['calculateHealthStatus'](toolId, 'failure');
      expect(healthStatus).toBe('unhealthy');
    });
  });
});
