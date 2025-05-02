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

    it('should handle redis operation failures in getMetrics', async () => {
      const toolId = 'test-tool';
      const redisError = new Error('Redis error');

      // Set up error handler before mocking Redis
      const errorHandler = jest.fn();
      monitor.on('error', errorHandler);

      // Mock Redis error
      (mockRedis.getClient().get as jest.Mock).mockRejectedValueOnce(redisError);

      // Mock successful database fallback
      mockPostgres.query.mockResolvedValueOnce([
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

      // Mock successful cache set
      (mockRedis.getClient().set as jest.Mock).mockResolvedValueOnce('OK');

      const metrics = await monitor.getMetrics(toolId);

      // Verify metrics were returned despite Redis error
      expect(metrics).toBeTruthy();
      expect(metrics?.toolId).toBe(toolId);

      // Verify error was logged and emitted
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get metrics from cache', redisError);
      expect(errorHandler).toHaveBeenCalledWith(redisError);
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

  describe('error handling', () => {
    it('should handle postgres query errors in collectMetrics', async () => {
      const dbError = new Error('Database error');
      mockPostgres.query.mockRejectedValueOnce(dbError);

      // Set up error handler before starting
      const errorHandler = jest.fn();
      monitor.on('error', errorHandler);

      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLogger.error).toHaveBeenCalledWith('Error collecting tool metrics', dbError);
      expect(errorHandler).toHaveBeenCalledWith(dbError);
      await monitor.stop(); // Clean up
    });

    it('should handle invalid result format in collectMetrics', async () => {
      mockPostgres.query.mockResolvedValueOnce(null);
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockLogger.warn).toHaveBeenCalledWith('No metrics found or invalid result format');
      await monitor.stop(); // Clean up
    });

    it('should handle empty result in collectMetrics', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockLogger.warn).not.toHaveBeenCalled();
      await monitor.stop(); // Clean up
    });
  });

  describe('health status calculation', () => {
    it('should handle edge cases in health status calculation', async () => {
      const toolId = 'test-tool';

      // Test with zero executions
      mockPostgres.query.mockResolvedValueOnce([]);
      await monitor.recordExecution(toolId, 100, 'success');
      mockPostgres.query.mockResolvedValueOnce([
        {
          tool_id: toolId,
          total_executions: 1,
          successful_executions: 1,
          failed_executions: 0,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'success',
          last_error: null,
          health_status: 'healthy',
          metadata: {},
        },
      ]);
      let metrics = await monitor.getMetrics(toolId);
      expect(metrics?.healthStatus).toBe('healthy');

      // Test with single failure
      mockPostgres.query.mockResolvedValueOnce([]);
      await monitor.recordExecution(toolId, 100, 'failure');
      mockPostgres.query.mockResolvedValueOnce([
        {
          tool_id: toolId,
          total_executions: 2,
          successful_executions: 1,
          failed_executions: 1,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'failure',
          last_error: null,
          health_status: 'unhealthy',
          metadata: {},
        },
      ]);
      metrics = await monitor.getMetrics(toolId);
      expect(metrics?.healthStatus).toBe('unhealthy');

      // Test with multiple executions
      for (let i = 0; i < 10; i++) {
        mockPostgres.query.mockResolvedValueOnce([]);
        await monitor.recordExecution(toolId, 100, i < 3 ? 'failure' : 'success');
      }
      mockPostgres.query.mockResolvedValueOnce([
        {
          tool_id: toolId,
          total_executions: 12,
          successful_executions: 9,
          failed_executions: 3,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'success',
          last_error: null,
          health_status: 'degraded',
          metadata: {},
        },
      ]);
      metrics = await monitor.getMetrics(toolId);
      expect(metrics?.healthStatus).toBe('degraded');
    });

    it('should handle health status transitions', async () => {
      const toolId = 'test-tool';

      // Start healthy
      mockPostgres.query.mockResolvedValueOnce([]);
      await monitor.recordExecution(toolId, 100, 'success');
      mockPostgres.query.mockResolvedValueOnce([
        {
          tool_id: toolId,
          total_executions: 1,
          successful_executions: 1,
          failed_executions: 0,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'success',
          last_error: null,
          health_status: 'healthy',
          metadata: {},
        },
      ]);
      let metrics = await monitor.getMetrics(toolId);
      expect(metrics?.healthStatus).toBe('healthy');

      // Transition to degraded
      for (let i = 0; i < 5; i++) {
        mockPostgres.query.mockResolvedValueOnce([]);
        await monitor.recordExecution(toolId, 100, i < 2 ? 'failure' : 'success');
      }
      mockPostgres.query.mockResolvedValueOnce([
        {
          tool_id: toolId,
          total_executions: 6,
          successful_executions: 5,
          failed_executions: 1,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'success',
          last_error: null,
          health_status: 'degraded',
          metadata: {},
        },
      ]);
      metrics = await monitor.getMetrics(toolId);
      expect(metrics?.healthStatus).toBe('degraded');

      // Transition to unhealthy
      for (let i = 0; i < 5; i++) {
        mockPostgres.query.mockResolvedValueOnce([]);
        await monitor.recordExecution(toolId, 100, i < 3 ? 'failure' : 'success');
      }
      mockPostgres.query.mockResolvedValueOnce([
        {
          tool_id: toolId,
          total_executions: 10,
          successful_executions: 8,
          failed_executions: 2,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'success',
          last_error: null,
          health_status: 'unhealthy',
          metadata: {},
        },
      ]);
      metrics = await monitor.getMetrics(toolId);
      expect(metrics?.healthStatus).toBe('unhealthy');

      // Recover to healthy
      for (let i = 0; i < 10; i++) {
        mockPostgres.query.mockResolvedValueOnce([]);
        await monitor.recordExecution(toolId, 100, 'success');
      }
      mockPostgres.query.mockResolvedValueOnce([
        {
          tool_id: toolId,
          total_executions: 10,
          successful_executions: 8,
          failed_executions: 2,
          average_execution_time: 100,
          last_execution_time: new Date(),
          last_execution_status: 'success',
          last_error: null,
          health_status: 'healthy',
          metadata: {},
        },
      ]);
      metrics = await monitor.getMetrics(toolId);
      expect(metrics?.healthStatus).toBe('healthy');
    });
  });

  describe('cache operations', () => {
    it('should handle cache expiration', async () => {
      const toolId = 'test-tool';
      const mockMetrics = {
        tool_id: toolId,
        total_executions: 10,
        successful_executions: 8,
        failed_executions: 2,
        average_execution_time: 100,
        last_execution_time: new Date(),
        last_execution_status: 'success' as const,
        last_error: null,
        health_status: 'healthy' as const,
        metadata: {},
      };

      // First call: cache miss, get from DB
      (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(null);
      mockPostgres.query.mockResolvedValueOnce([mockMetrics]);
      (mockRedis.getClient().set as jest.Mock).mockResolvedValueOnce('OK');

      const metrics1 = await monitor.getMetrics(toolId);
      expect(metrics1).toBeTruthy();

      // Simulate cache expiration by returning null
      (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(null);
      mockPostgres.query.mockResolvedValueOnce([mockMetrics]);
      (mockRedis.getClient().set as jest.Mock).mockResolvedValueOnce('OK');

      const metrics2 = await monitor.getMetrics(toolId);
      expect(metrics2).toBeTruthy();
      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
    });

    it('should handle cache update failures in recordExecution', async () => {
      const toolId = 'test-tool';
      const cacheError = new Error('Cache update failed');

      mockPostgres.query.mockResolvedValueOnce([]);
      mockPostgres.query.mockResolvedValueOnce([]);
      (mockRedis.getClient().get as unknown as jest.Mock).mockRejectedValueOnce(cacheError);

      const errorPromise = new Promise<Error>(resolve => {
        monitor.once('error', resolve);
      });

      await monitor.recordExecution(toolId, 100, 'success' as const);
      const emittedError = await errorPromise;

      expect(emittedError).toBe(cacheError);
    });
  });

  describe('database operations', () => {
    it('should handle concurrent database operations', async () => {
      const toolId = 'test-tool';
      const executions = Array.from({ length: 5 }, (_, i) => ({
        toolId,
        duration: 100 + i,
        status: i % 2 === 0 ? ('success' as const) : ('failure' as const),
      }));

      // Mock Redis cache misses for all executions
      (mockRedis.getClient().get as unknown as jest.Mock).mockResolvedValue(null);
      mockPostgres.query.mockResolvedValue([]);

      const promises = executions.map(exec =>
        monitor.recordExecution(exec.toolId, exec.duration, exec.status)
      );

      await Promise.all(promises);
      // Each execution makes 3 database calls:
      // 1. Insert into execution history
      // 2. Insert/update metrics
      // 3. Get metrics for cache update
      expect(mockPostgres.query).toHaveBeenCalledTimes(executions.length * 3);
    });

    it('should handle database connection failures', async () => {
      const error = new Error('Database connection failed');
      mockPostgres.query.mockRejectedValueOnce(error);

      const errorPromise = new Promise<Error>(resolve => {
        monitor.once('error', resolve);
      });

      await monitor.start();
      const emittedError = await errorPromise;

      expect(emittedError).toBe(error);
      await monitor.stop();
    });
  });

  describe('event handling', () => {
    it('should emit metrics event during collectMetrics', async () => {
      const mockMetrics = {
        tool_id: 'test-tool',
        total_executions: 10,
        successful_executions: 8,
        failed_executions: 2,
        average_execution_time: 100,
        last_execution_time: new Date(),
        last_execution_status: 'success',
        last_error: null,
        health_status: 'healthy',
        metadata: {},
      };

      mockPostgres.query.mockResolvedValueOnce([mockMetrics]);

      const metricsPromise = new Promise<ToolMetrics>(resolve => {
        monitor.once('metrics', resolve);
      });

      await monitor.start();
      const metrics = await metricsPromise;

      expect(metrics).toEqual({
        toolId: mockMetrics.tool_id,
        totalExecutions: mockMetrics.total_executions,
        successfulExecutions: mockMetrics.successful_executions,
        failedExecutions: mockMetrics.failed_executions,
        averageExecutionTime: mockMetrics.average_execution_time,
        lastExecutionTime: mockMetrics.last_execution_time.getTime(),
        lastExecutionStatus: mockMetrics.last_execution_status,
        lastError: mockMetrics.last_error,
        healthStatus: mockMetrics.health_status,
        metadata: mockMetrics.metadata,
        timestamp: expect.any(Number),
      });

      await monitor.stop();
    });

    it('should emit error event during collectMetrics failure', async () => {
      const error = new Error('Database error');
      mockPostgres.query.mockRejectedValueOnce(error);

      const errorPromise = new Promise<Error>(resolve => {
        monitor.once('error', resolve);
      });

      await monitor.start();
      const emittedError = await errorPromise;

      expect(emittedError).toBe(error);
      await monitor.stop();
    });

    it('should emit executionRecorded event after recording execution', async () => {
      const executionData = {
        toolId: 'test-tool',
        duration: 100,
        status: 'success' as const,
        parameters: { test: true },
        result: { success: true },
        metadata: { source: 'test' },
      };

      mockPostgres.query.mockResolvedValueOnce([]);
      mockPostgres.query.mockResolvedValueOnce([]);
      (mockRedis.getClient().get as unknown as jest.Mock).mockResolvedValueOnce(null);

      const executionPromise = new Promise<any>(resolve => {
        monitor.once('executionRecorded', resolve);
      });

      await monitor.recordExecution(
        executionData.toolId,
        executionData.duration,
        executionData.status,
        undefined,
        executionData.parameters,
        executionData.result,
        executionData.metadata
      );

      const recordedExecution = await executionPromise;
      expect(recordedExecution).toEqual(executionData);
    });
  });
});
