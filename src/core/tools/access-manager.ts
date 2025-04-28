import { EventEmitter } from 'events';
import { Logger } from '../logging/logger';
import { PostgresClient } from '../storage/postgres';
import { RedisClient } from '../cache/client';

export interface ToolAccessManagerConfig {
  postgres: PostgresClient;
  redis: RedisClient;
}

export interface ToolAccess {
  toolId: string;
  agentId: string;
  permissions: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class ToolAccessManager extends EventEmitter {
  private postgres: PostgresClient;
  private redis: RedisClient;
  private logger: Logger;

  constructor(config: ToolAccessManagerConfig) {
    super();
    this.postgres = config.postgres;
    this.redis = config.redis;
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing tool access manager');
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    await this.postgres.query(`
      CREATE TABLE IF NOT EXISTS tool_access (
        tool_id VARCHAR(255) REFERENCES tools(id),
        agent_id VARCHAR(255) NOT NULL,
        permissions JSONB NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tool_id, agent_id)
      );

      CREATE INDEX IF NOT EXISTS idx_tool_access_tool_id ON tool_access(tool_id);
      CREATE INDEX IF NOT EXISTS idx_tool_access_agent_id ON tool_access(agent_id);
    `);
  }

  async grantAccess(
    toolId: string,
    agentId: string,
    permissions: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    this.logger.info('Granting tool access', { toolId, agentId, permissions });

    // Store in database
    await this.postgres.query(
      `
      INSERT INTO tool_access (tool_id, agent_id, permissions, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tool_id, agent_id) 
      DO UPDATE SET 
        permissions = $3,
        metadata = $4,
        updated_at = CURRENT_TIMESTAMP
      `,
      [toolId, agentId, JSON.stringify(permissions), JSON.stringify(metadata || {})]
    );

    // Cache access
    await this.redis.getClient().set(
      `tool:${toolId}:access:${agentId}`,
      JSON.stringify({
        toolId,
        agentId,
        permissions,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      { EX: 3600 } // 1 hour cache
    );

    this.emit('accessGranted', { toolId, agentId, permissions });
  }

  async revokeAccess(toolId: string, agentId: string): Promise<void> {
    this.logger.info('Revoking tool access', { toolId, agentId });

    // Remove from database
    await this.postgres.query(
      `
      DELETE FROM tool_access WHERE tool_id = $1 AND agent_id = $2
      `,
      [toolId, agentId]
    );

    // Remove from cache
    await this.redis.getClient().del(`tool:${toolId}:access:${agentId}`);

    this.emit('accessRevoked', { toolId, agentId });
  }

  async getAccess(toolId: string, agentId: string): Promise<ToolAccess | null> {
    // Try cache first
    const cachedAccess = await this.redis.getClient().get(`tool:${toolId}:access:${agentId}`);
    if (cachedAccess) {
      const parsed = JSON.parse(cachedAccess);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      };
    }

    // Try database
    const result = await this.postgres.query<
      {
        tool_id: string;
        agent_id: string;
        permissions: string[];
        metadata: any;
        created_at: Date;
        updated_at: Date;
      }[]
    >(
      `
      SELECT * FROM tool_access WHERE tool_id = $1 AND agent_id = $2
      `,
      [toolId, agentId]
    );

    if (result.length === 0) {
      return null;
    }

    const access = {
      toolId: result[0].tool_id,
      agentId: result[0].agent_id,
      permissions: result[0].permissions,
      metadata: result[0].metadata,
      createdAt: result[0].created_at,
      updatedAt: result[0].updated_at,
    };

    // Cache the result
    await this.redis.getClient().set(
      `tool:${toolId}:access:${agentId}`,
      JSON.stringify(access),
      { EX: 3600 } // 1 hour cache
    );

    return access;
  }

  async listAccess(toolId: string): Promise<ToolAccess[]> {
    const result = await this.postgres.query<
      {
        tool_id: string;
        agent_id: string;
        permissions: string[];
        metadata: any;
        created_at: Date;
        updated_at: Date;
      }[]
    >(
      `
      SELECT * FROM tool_access WHERE tool_id = $1
      `,
      [toolId]
    );

    return result.map(row => ({
      toolId: row.tool_id,
      agentId: row.agent_id,
      permissions: row.permissions,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async hasAccess(
    toolId: string,
    agentId: string,
    requiredPermissions: string[] = []
  ): Promise<boolean> {
    const access = await this.getAccess(toolId, agentId);
    if (!access) {
      return false;
    }

    if (requiredPermissions.length === 0) {
      return true;
    }

    return requiredPermissions.every(permission => access.permissions.includes(permission));
  }
}
