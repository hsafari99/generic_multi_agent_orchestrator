import { EventEmitter } from 'events';
import { Logger } from '../logging/logger';
import { PostgresClient } from '../storage/postgres';
import { RedisClient } from '../cache/client';
import { AgentState } from './types';

export interface StatePersistenceConfig {
  postgres: PostgresClient;
  redis: RedisClient;
  cacheTTL?: number; // Time to live for cached states in seconds
  syncInterval?: number; // Interval for syncing state between cache and database
}

export class StatePersistence extends EventEmitter {
  private postgres: PostgresClient;
  private redis: RedisClient;
  private logger: Logger;
  private cacheTTL: number;
  private syncInterval: number;
  private intervalId?: NodeJS.Timeout;

  constructor(config: StatePersistenceConfig) {
    super();
    this.postgres = config.postgres;
    this.redis = config.redis;
    this.logger = Logger.getInstance();
    this.cacheTTL = config.cacheTTL || 300; // 5 minutes default
    this.syncInterval = config.syncInterval || 60000; // 1 minute default

    // Initialize database schema
    this.initializeSchema().catch(error => {
      this.logger.error('Failed to initialize state persistence schema', error);
      this.emit('error', error);
    });
  }

  /**
   * Initialize the database schema for state persistence
   */
  private async initializeSchema(): Promise<void> {
    await this.postgres.query(`
      CREATE TABLE IF NOT EXISTS agent_states (
        agent_id VARCHAR(255) PRIMARY KEY,
        state JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_agent_states_version ON agent_states(version);
      CREATE INDEX IF NOT EXISTS idx_agent_states_updated_at ON agent_states(updated_at);
    `);
  }

  /**
   * Save agent state to both cache and database
   */
  public async saveState(agentId: string, state: AgentState): Promise<void> {
    try {
      // Serialize state
      const serializedState = this.serializeState(state);

      // Save to cache
      await this.redis
        .getClient()
        .set(`agent:${agentId}:state`, serializedState, { EX: this.cacheTTL });

      // Save to database with versioning
      await this.postgres.query(
        `
        INSERT INTO agent_states (agent_id, state, version)
        VALUES ($1, $2, 1)
        ON CONFLICT (agent_id) DO UPDATE
        SET state = $2,
            version = agent_states.version + 1,
            updated_at = CURRENT_TIMESTAMP
        `,
        [agentId, serializedState]
      );

      this.emit('stateSaved', { agentId, state });
    } catch (error) {
      this.logger.error('Failed to save agent state', { agentId, error });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Load agent state from cache or database
   */
  public async loadState(agentId: string): Promise<AgentState | null> {
    try {
      // Try cache first
      const cachedState = await this.redis.getClient().get(`agent:${agentId}:state`);
      if (cachedState) {
        return this.deserializeState(cachedState);
      }

      // Try database
      const result = await this.postgres.query<{ state: string }[]>(
        'SELECT state FROM agent_states WHERE agent_id = $1',
        [agentId]
      );

      if (result.length === 0) {
        return null;
      }

      const state = this.deserializeState(result[0].state);

      // Cache the state
      await this.redis
        .getClient()
        .set(`agent:${agentId}:state`, result[0].state, { EX: this.cacheTTL });

      return state;
    } catch (error) {
      this.logger.error('Failed to load agent state', { agentId, error });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Delete agent state from both cache and database
   */
  public async deleteState(agentId: string): Promise<void> {
    try {
      // Delete from cache
      await this.redis.getClient().del(`agent:${agentId}:state`);

      // Delete from database
      await this.postgres.query('DELETE FROM agent_states WHERE agent_id = $1', [agentId]);

      this.emit('stateDeleted', { agentId });
    } catch (error) {
      this.logger.error('Failed to delete agent state', { agentId, error });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start periodic state synchronization
   */
  public startSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => this.syncStates(), this.syncInterval);
  }

  /**
   * Stop periodic state synchronization
   */
  public stopSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Synchronize states between cache and database
   */
  private async syncStates(): Promise<void> {
    try {
      // Get all agent IDs from database
      const result = await this.postgres.query<{ agent_id: string }[]>(
        'SELECT agent_id FROM agent_states'
      );

      for (const { agent_id } of result) {
        // Get state from database
        const dbState = await this.loadState(agent_id);
        if (dbState) {
          // Update cache
          await this.redis
            .getClient()
            .set(`agent:${agent_id}:state`, this.serializeState(dbState), { EX: this.cacheTTL });
        }
      }

      this.emit('statesSynced');
    } catch (error) {
      this.logger.error('Failed to sync states', error);
      this.emit('error', error);
    }
  }

  /**
   * Serialize agent state to JSON
   */
  private serializeState(state: AgentState): string {
    return JSON.stringify({
      ...state,
      lastStatusChange: state.lastStatusChange.toISOString(),
      lastHealthCheck: state.lastHealthCheck.toISOString(),
      health: {
        ...state.health,
        lastCheck: state.health.lastCheck.toISOString(),
      },
    });
  }

  /**
   * Deserialize JSON to agent state
   */
  private deserializeState(serialized: string): AgentState {
    const parsed = JSON.parse(serialized);
    return {
      ...parsed,
      lastStatusChange: new Date(parsed.lastStatusChange),
      lastHealthCheck: new Date(parsed.lastHealthCheck),
      health: {
        ...parsed.health,
        lastCheck: new Date(parsed.health.lastCheck),
      },
    };
  }

  /**
   * Clean up old states
   */
  public async cleanupOldStates(maxAge: number): Promise<void> {
    try {
      await this.postgres.query(
        `
        DELETE FROM agent_states
        WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '${maxAge} seconds'
        `
      );
      this.emit('statesCleaned');
    } catch (error) {
      this.logger.error('Failed to cleanup old states', error);
      this.emit('error', error);
      throw error;
    }
  }
}
