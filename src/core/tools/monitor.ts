import { EventEmitter } from 'events';
import { Logger } from '../logging/logger';
import { PostgresClient } from '../storage/postgres';
import { RedisClient } from '../cache/client';

export interface ToolMonitorConfig {
  postgres: PostgresClient;
  redis: RedisClient;
  checkInterval?: number;
}

export interface ToolMetrics {
  toolId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime?: number;
  lastExecutionStatus?: 'success' | 'failure';
  lastError?: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  metadata?: Record<string, any>;
  timestamp: number;
}

export class ToolMonitor extends EventEmitter {
  private postgres: PostgresClient;
  private redis: RedisClient;
  private logger: Logger;
  private checkInterval: number;
  private intervalId?: NodeJS.Timeout;
  private metrics: Map<string, ToolMetrics> = new Map();

  constructor(config: ToolMonitorConfig) {
    super();
    this.postgres = config.postgres;
    this.redis = config.redis;
    this.logger = Logger.getInstance();
    this.checkInterval = config.checkInterval || 60000; // 1 minute default
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing tool monitor');
    await this.createTables();
    await this.loadMetrics();
  }

  private async createTables(): Promise<void> {
    await this.postgres.query(`
      CREATE TABLE IF NOT EXISTS tool_metrics (
        tool_id VARCHAR(255) REFERENCES tools(id),
        total_executions INTEGER NOT NULL DEFAULT 0,
        successful_executions INTEGER NOT NULL DEFAULT 0,
        failed_executions INTEGER NOT NULL DEFAULT 0,
        average_execution_time FLOAT NOT NULL DEFAULT 0,
        last_execution_time TIMESTAMP WITH TIME ZONE,
        last_execution_status VARCHAR(10),
        last_error TEXT,
        health_status VARCHAR(10) NOT NULL DEFAULT 'healthy',
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tool_id)
      );

      CREATE TABLE IF NOT EXISTS tool_execution_history (
        id SERIAL PRIMARY KEY,
        tool_id VARCHAR(255) REFERENCES tools(id),
        execution_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        duration FLOAT NOT NULL,
        status VARCHAR(10) NOT NULL,
        error TEXT,
        parameters JSONB,
        result JSONB,
        metadata JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_tool_execution_history_tool_id ON tool_execution_history(tool_id);
      CREATE INDEX IF NOT EXISTS idx_tool_execution_history_execution_time ON tool_execution_history(execution_time);
    `);
  }

  private async loadMetrics(): Promise<void> {
    const result = await this.postgres.query<
      {
        tool_id: string;
        total_executions: number;
        successful_executions: number;
        failed_executions: number;
        average_execution_time: number;
        last_execution_time: Date;
        last_execution_status: string;
        last_error: string;
        health_status: string;
        metadata: any;
      }[]
    >(`
      SELECT * FROM tool_metrics
    `);

    for (const row of result) {
      this.metrics.set(row.tool_id, {
        toolId: row.tool_id,
        totalExecutions: row.total_executions,
        successfulExecutions: row.successful_executions,
        failedExecutions: row.failed_executions,
        averageExecutionTime: row.average_execution_time,
        lastExecutionTime: row.last_execution_time.getTime(),
        lastExecutionStatus: row.last_execution_status as 'success' | 'failure',
        lastError: row.last_error,
        healthStatus: row.health_status as 'healthy' | 'degraded' | 'unhealthy',
        metadata: row.metadata,
        timestamp: Date.now(),
      });
    }
  }

  async start(): Promise<void> {
    this.logger.info('Starting tool monitor');
    this.intervalId = setInterval(() => this.collectMetrics(), this.checkInterval);
    await this.collectMetrics(); // Initial collection
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping tool monitor');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.metrics.clear();
  }

  private async collectMetrics(): Promise<void> {
    try {
      const result = await this.postgres.query<
        {
          tool_id: string;
          total_executions: number;
          successful_executions: number;
          failed_executions: number;
          average_execution_time: number;
          last_execution_time: Date;
          last_execution_status: string;
          last_error: string;
          health_status: string;
          metadata: any;
        }[]
      >(`
        SELECT * FROM tool_metrics
      `);

      if (!result || !Array.isArray(result)) {
        this.logger.warn('No metrics found or invalid result format');
        return;
      }

      for (const row of result) {
        const metrics: ToolMetrics = {
          toolId: row.tool_id,
          totalExecutions: row.total_executions,
          successfulExecutions: row.successful_executions,
          failedExecutions: row.failed_executions,
          averageExecutionTime: row.average_execution_time,
          lastExecutionTime: row.last_execution_time.getTime(),
          lastExecutionStatus: row.last_execution_status as 'success' | 'failure',
          lastError: row.last_error,
          healthStatus: row.health_status as 'healthy' | 'degraded' | 'unhealthy',
          metadata: row.metadata,
          timestamp: Date.now(),
        };

        this.metrics.set(row.tool_id, metrics);
        this.emit('metrics', metrics);
      }
    } catch (error) {
      this.logger.error('Error collecting tool metrics', error);
      this.emit('error', error);
    }
  }

  async recordExecution(
    toolId: string,
    duration: number,
    status: 'success' | 'failure',
    error?: string,
    parameters?: Record<string, any>,
    result?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    this.logger.info('Recording tool execution', { toolId, duration, status });

    // Record in execution history
    await this.postgres.query(
      `
      INSERT INTO tool_execution_history (
        tool_id, duration, status, error, parameters, result, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        toolId,
        duration,
        status,
        error,
        JSON.stringify(parameters || {}),
        JSON.stringify(result || {}),
        JSON.stringify(metadata || {}),
      ]
    );

    // Update metrics
    await this.postgres.query(
      `
      INSERT INTO tool_metrics (
        tool_id, total_executions, successful_executions, failed_executions,
        average_execution_time, last_execution_time, last_execution_status,
        last_error, health_status, metadata
      )
      VALUES ($1, 1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8)
      ON CONFLICT (tool_id) DO UPDATE SET
        total_executions = tool_metrics.total_executions + 1,
        successful_executions = tool_metrics.successful_executions + $2,
        failed_executions = tool_metrics.failed_executions + $3,
        average_execution_time = (
          (tool_metrics.average_execution_time * tool_metrics.total_executions + $4) /
          (tool_metrics.total_executions + 1)
        ),
        last_execution_time = CURRENT_TIMESTAMP,
        last_execution_status = $5,
        last_error = $6,
        health_status = $7,
        metadata = $8,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        toolId,
        status === 'success' ? 1 : 0,
        status === 'failure' ? 1 : 0,
        duration,
        status,
        error,
        this.calculateHealthStatus(toolId, status),
        JSON.stringify(metadata || {}),
      ]
    );

    // Update cache
    const metrics = await this.getMetrics(toolId);
    if (metrics) {
      await this.redis.getClient().set(
        `tool:${toolId}:metrics`,
        JSON.stringify(metrics),
        { EX: 3600 } // 1 hour cache
      );
    }

    this.emit('executionRecorded', {
      toolId,
      duration,
      status,
      error,
      parameters,
      result,
      metadata,
    });
  }

  async getMetrics(toolId: string): Promise<ToolMetrics | null> {
    // Try cache first
    const cachedMetrics = await this.redis.getClient().get(`tool:${toolId}:metrics`);
    if (cachedMetrics) {
      return JSON.parse(cachedMetrics);
    }

    // Try database
    const result = await this.postgres.query<
      {
        tool_id: string;
        total_executions: number;
        successful_executions: number;
        failed_executions: number;
        average_execution_time: number;
        last_execution_time: Date;
        last_execution_status: string;
        last_error: string;
        health_status: string;
        metadata: any;
      }[]
    >(
      `
      SELECT * FROM tool_metrics WHERE tool_id = $1
      `,
      [toolId]
    );

    if (result.length === 0) {
      return null;
    }

    const metrics: ToolMetrics = {
      toolId: result[0].tool_id,
      totalExecutions: result[0].total_executions,
      successfulExecutions: result[0].successful_executions,
      failedExecutions: result[0].failed_executions,
      averageExecutionTime: result[0].average_execution_time,
      lastExecutionTime: result[0].last_execution_time.getTime(),
      lastExecutionStatus: result[0].last_execution_status as 'success' | 'failure',
      lastError: result[0].last_error,
      healthStatus: result[0].health_status as 'healthy' | 'degraded' | 'unhealthy',
      metadata: result[0].metadata,
      timestamp: Date.now(),
    };

    // Cache the result
    await this.redis.getClient().set(
      `tool:${toolId}:metrics`,
      JSON.stringify(metrics),
      { EX: 3600 } // 1 hour cache
    );

    return metrics;
  }

  async listMetrics(): Promise<ToolMetrics[]> {
    return Array.from(this.metrics.values());
  }

  private calculateHealthStatus(
    toolId: string,
    status: 'success' | 'failure'
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const metrics = this.metrics.get(toolId);
    if (!metrics) {
      return status === 'success' ? 'healthy' : 'unhealthy';
    }

    const failureRate = metrics.failedExecutions / metrics.totalExecutions;
    if (failureRate > 0.5) {
      return 'unhealthy';
    } else if (failureRate > 0.2) {
      return 'degraded';
    }
    return 'healthy';
  }
}
