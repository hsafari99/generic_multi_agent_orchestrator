import { EventEmitter } from 'events';
import { Logger } from '../logging/logger';
import { PostgresClient } from '../storage/postgres';
import { RedisClient } from '../cache/client';
import { AgentState, HealthStatus } from './types';
import { RecoveryMonitor } from './recovery-monitor';

export interface StateRecoveryConfig {
  postgres: PostgresClient;
  redis: RedisClient;
  maxRetries?: number;
  retryDelay?: number;
  logger?: Logger;
}

export class StateRecovery extends EventEmitter {
  private postgres: PostgresClient;
  private redis: RedisClient;
  private logger: Logger;
  private maxRetries: number;
  private retryDelay: number;
  private monitor: RecoveryMonitor;

  constructor(config: StateRecoveryConfig) {
    super();
    this.postgres = config.postgres;
    this.redis = config.redis;
    this.logger = config.logger || Logger.getInstance();
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.monitor = new RecoveryMonitor({
      postgres: this.postgres,
      redis: this.redis,
      logger: this.logger,
    });

    // Forward monitor events
    this.monitor.on('recovery-failed', data => this.emit('recovery-failed', data));
    this.monitor.on('recovery-succeeded', data => this.emit('recovery-succeeded', data));
    this.monitor.on('health-check', data => this.emit('health-check', data));
  }

  /**
   * Validate state structure and consistency
   */
  private validateState(state: unknown): state is AgentState {
    this.logger.debug('Validating state', { state });

    if (!state || typeof state !== 'object') {
      this.logger.error('Invalid state: not an object', { state });
      return false;
    }

    const agentState = state as AgentState;

    // Check required fields
    if (
      !agentState.status ||
      !agentState.health ||
      !agentState.lastStatusChange ||
      !agentState.lastHealthCheck ||
      !agentState.resources ||
      typeof agentState.activeOperations !== 'number' ||
      typeof agentState.load !== 'number' ||
      typeof agentState.isAvailable !== 'boolean'
    ) {
      this.logger.error('Invalid state: missing required fields', {
        agentState,
        status: agentState.status,
        health: agentState.health,
        lastStatusChange: agentState.lastStatusChange,
        lastHealthCheck: agentState.lastHealthCheck,
        resources: agentState.resources,
        activeOperations: agentState.activeOperations,
        load: agentState.load,
        isAvailable: agentState.isAvailable,
      });
      return false;
    }

    // Check health structure
    if (
      !agentState.health.status ||
      !Object.values(HealthStatus).includes(agentState.health.status as HealthStatus) ||
      !agentState.health.lastCheck ||
      !agentState.health.metrics ||
      typeof agentState.health.metrics.cpu !== 'number' ||
      typeof agentState.health.metrics.memory !== 'number' ||
      typeof agentState.health.metrics.responseTime !== 'number' ||
      typeof agentState.health.metrics.errorRate !== 'number'
    ) {
      this.logger.error('Invalid state: invalid health structure', {
        health: agentState.health,
        status: agentState.health.status,
        lastCheck: agentState.health.lastCheck,
        metrics: agentState.health.metrics,
      });
      return false;
    }

    // Check resources structure
    if (
      typeof agentState.resources.cpu !== 'number' ||
      typeof agentState.resources.memory !== 'number' ||
      !agentState.resources.network ||
      typeof agentState.resources.network.bytesIn !== 'number' ||
      typeof agentState.resources.network.bytesOut !== 'number'
    ) {
      this.logger.error('Invalid state: invalid resources structure', {
        resources: agentState.resources,
      });
      return false;
    }

    // Check timestamps
    const now = new Date();
    const lastStatusChange = new Date(agentState.lastStatusChange);
    const lastHealthCheck = new Date(agentState.lastHealthCheck);
    const healthLastCheck = new Date(agentState.health.lastCheck);

    this.logger.debug('Validating timestamps', {
      now,
      lastStatusChange,
      lastHealthCheck,
      healthLastCheck,
    });

    if (
      lastStatusChange > now ||
      lastHealthCheck > now ||
      healthLastCheck > now ||
      isNaN(lastStatusChange.getTime()) ||
      isNaN(lastHealthCheck.getTime()) ||
      isNaN(healthLastCheck.getTime())
    ) {
      this.logger.error('Invalid state: invalid timestamps', {
        lastStatusChange,
        lastHealthCheck,
        healthLastCheck,
        now,
      });
      return false;
    }

    this.logger.debug('State validation successful', { agentState });
    return true;
  }

  /**
   * Recover state from database with retries
   */
  public async recoverFromDatabase(agentId: string): Promise<AgentState | null> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    this.logger.debug('Starting database recovery', { agentId, startTime });
    this.monitor.trackStart();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug('Database recovery attempt', {
          agentId,
          attempt,
          maxRetries: this.maxRetries,
        });

        const result = await this.postgres.query<{ state: string }[]>(
          'SELECT state FROM agent_states WHERE agent_id = $1',
          [agentId]
        );

        this.logger.debug('Database query result', { agentId, result });

        if (!result || !Array.isArray(result) || result.length === 0) {
          return null;
        }

        const state = this.deserializeState(result[0].state);
        this.logger.debug('Deserialized state', { agentId, state });

        if (!this.validateState(state)) {
          const error = new Error('Invalid state recovered from database');
          this.logger.error('Invalid state recovered from database', {
            agentId,
            state,
          });
          throw error;
        }

        // Track recovery time after successful recovery
        await this.monitor.trackRecovery(agentId, startTime);
        await this.monitor.trackSuccess(agentId);

        this.logger.debug('Database recovery successful', { agentId, state });
        return state as AgentState;
      } catch (error) {
        lastError = error as Error;

        // Track each failed attempt
        await this.monitor.trackFailure(agentId, lastError);

        this.logger.warn('Database recovery attempt failed', {
          agentId,
          attempt,
          maxRetries: this.maxRetries,
          error,
        });

        const shouldRetry =
          attempt < this.maxRetries &&
          !(error instanceof Error && error.message === 'Invalid state recovered from database');

        if (shouldRetry) {
          this.logger.debug('Retrying database recovery', {
            agentId,
            attempt,
            nextAttempt: attempt + 1,
          });
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          continue;
        }

        this.logger.error('All database recovery attempts failed', {
          agentId,
          maxRetries: this.maxRetries,
          error: lastError,
        });

        const finalError = new Error(`All database recovery attempts failed: ${lastError.message}`);
        Object.assign(finalError, { originalError: lastError });
        throw finalError;
      }
    }

    return null;
  }

  /**
   * Recover state from cache with retries
   */
  public async recoverFromCache(agentId: string): Promise<AgentState | null> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    this.logger.debug('Starting cache recovery', { agentId, startTime });

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug('Cache recovery attempt', {
          agentId,
          attempt,
          maxRetries: this.maxRetries,
        });

        const cachedState = await this.redis.getClient().get(`agent:${agentId}:state`);
        this.logger.debug('Cache query result', { agentId, cachedState });

        if (!cachedState) {
          this.logger.debug('No state found in cache', { agentId });
          return null;
        }

        const state = this.deserializeState(cachedState);
        this.logger.debug('Deserialized state from cache', { agentId, state });

        if (!this.validateState(state)) {
          const error = new Error('Invalid state recovered from cache');
          this.logger.error('Invalid state recovered from cache', {
            agentId,
            state,
          });
          throw error;
        }

        // Track recovery time after successful recovery
        await this.monitor.trackRecovery(agentId, startTime);
        await this.monitor.trackSuccess(agentId);

        this.logger.debug('Cache recovery successful', { agentId, state });
        return state as AgentState;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn('Cache recovery attempt failed', {
          agentId,
          attempt,
          maxRetries: this.maxRetries,
          error,
        });

        const shouldRetry =
          attempt < this.maxRetries &&
          !(error instanceof Error && error.message === 'Invalid state recovered from cache');

        if (shouldRetry) {
          this.logger.debug('Retrying cache recovery', {
            agentId,
            attempt,
            nextAttempt: attempt + 1,
          });
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          continue;
        }

        await this.monitor.trackFailure(agentId, lastError);
        this.logger.error('All cache recovery attempts failed', {
          agentId,
          maxRetries: this.maxRetries,
          error: lastError,
        });

        const finalError = new Error(`All cache recovery attempts failed: ${lastError.message}`);
        Object.assign(finalError, { originalError: lastError });
        throw finalError;
      }
    }

    return null;
  }

  /**
   * Get recovery metrics
   */
  public getMetrics() {
    return this.monitor.getMetrics();
  }

  /**
   * Get recovery success rate
   */
  public getSuccessRate() {
    return this.monitor.getSuccessRate();
  }

  /**
   * Get average recovery time
   */
  public getAverageRecoveryTime() {
    return this.monitor.getAverageRecoveryTime();
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    try {
      // Cleanup monitor resources first
      await this.monitor.cleanup();

      // Ensure Redis connection is still alive
      await this.redis.getClient().ping();

      // Remove all event listeners
      this.removeAllListeners();

      // Wait for any pending operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      this.logger.error('Error during cleanup', { error });
      throw error;
    }
  }

  /**
   * Recover state from both database and cache, resolving conflicts
   */
  public async recoverState(agentId: string): Promise<AgentState | null> {
    try {
      // Try to recover from both sources
      const [dbState, cacheState] = await Promise.all([
        this.recoverFromDatabase(agentId),
        this.recoverFromCache(agentId),
      ]);

      // If both are null, return null
      if (!dbState && !cacheState) {
        return null;
      }

      // If only one exists, use it
      if (!dbState) {
        return cacheState;
      }
      if (!cacheState) {
        return dbState;
      }

      // If both exist, use the most recent one
      const dbTimestamp = new Date(dbState.lastStatusChange).getTime();
      const cacheTimestamp = new Date(cacheState.lastStatusChange).getTime();

      return dbTimestamp > cacheTimestamp ? dbState : cacheState;
    } catch (error) {
      this.logger.error('Failed to recover state', { agentId, error });
      throw error;
    }
  }

  /**
   * Deserialize state from string
   */
  private deserializeState(serialized: string): unknown {
    this.logger.debug('Deserializing state', { serialized });
    try {
      const state = JSON.parse(serialized);
      // Convert date strings back to Date objects
      if (state.health?.lastCheck) {
        state.health.lastCheck = new Date(state.health.lastCheck);
      }
      if (state.lastStatusChange) {
        state.lastStatusChange = new Date(state.lastStatusChange);
      }
      if (state.lastHealthCheck) {
        state.lastHealthCheck = new Date(state.lastHealthCheck);
      }
      this.logger.debug('State deserialized successfully', { state });
      return state;
    } catch (error) {
      this.logger.error('Failed to deserialize state', { error, serialized });
      throw new Error('Failed to deserialize state');
    }
  }
}
