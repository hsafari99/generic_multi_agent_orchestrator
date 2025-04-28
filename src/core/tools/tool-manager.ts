import { EventEmitter } from 'events';
import { Logger } from '../logging/logger';
import { PostgresClient } from '../storage/postgres';
import { RedisClient } from '../cache/client';

export interface ToolManagerConfig {
  postgres: PostgresClient;
  redis: RedisClient;
}

export interface Tool {
  id: string;
  version: string;
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
  capabilities: string[];
  metadata?: Record<string, any>;
  validate?: (parameters: Record<string, any>) => boolean;
  execute?: (parameters: Record<string, any>) => Promise<any>;
}

export class ToolManager extends EventEmitter {
  private postgres: PostgresClient;
  private redis: RedisClient;
  private logger: Logger;
  private tools: Map<string, Tool> = new Map();

  constructor(config: ToolManagerConfig) {
    super();
    this.postgres = config.postgres;
    this.redis = config.redis;
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing tool manager');
    await this.createTables();
    await this.loadTools();
  }

  private async createTables(): Promise<void> {
    await this.postgres.query(`
      CREATE TABLE IF NOT EXISTS tools (
        id VARCHAR(255) PRIMARY KEY,
        version VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parameters JSONB NOT NULL,
        capabilities JSONB NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tool_versions (
        tool_id VARCHAR(255) REFERENCES tools(id),
        version VARCHAR(50) NOT NULL,
        parameters JSONB NOT NULL,
        capabilities JSONB NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tool_id, version)
      );
    `);
  }

  private async loadTools(): Promise<void> {
    const result = await this.postgres.query<
      {
        id: string;
        version: string;
        name: string;
        description: string;
        parameters: any;
        capabilities: string[];
        metadata: any;
      }[]
    >(`
      SELECT * FROM tools
    `);

    for (const tool of result) {
      this.tools.set(tool.id, {
        ...tool,
        parameters: tool.parameters,
        capabilities: tool.capabilities,
        metadata: tool.metadata,
      });
    }
  }

  async registerTool(tool: Tool): Promise<void> {
    this.logger.info('Registering tool', { toolId: tool.id, version: tool.version });

    // Validate tool
    if (!this.validateTool(tool)) {
      throw new Error(`Invalid tool configuration for ${tool.id}`);
    }

    // Check if tool exists
    const existingTool = await this.getTool(tool.id);
    if (existingTool) {
      throw new Error(`Tool ${tool.id} is already registered`);
    }

    // Store in database
    await this.postgres.query(
      `
      INSERT INTO tools (id, version, name, description, parameters, capabilities, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        tool.id,
        tool.version,
        tool.name,
        tool.description,
        JSON.stringify(tool.parameters),
        JSON.stringify(tool.capabilities),
        JSON.stringify(tool.metadata || {}),
      ]
    );

    // Store version
    await this.postgres.query(
      `
      INSERT INTO tool_versions (tool_id, version, parameters, capabilities, metadata)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        tool.id,
        tool.version,
        JSON.stringify(tool.parameters),
        JSON.stringify(tool.capabilities),
        JSON.stringify(tool.metadata || {}),
      ]
    );

    // Cache tool
    await this.redis.getClient().set(
      `tool:${tool.id}`,
      JSON.stringify(tool),
      { EX: 3600 } // 1 hour cache
    );

    // Store in memory
    this.tools.set(tool.id, tool);

    this.emit('toolRegistered', tool);
  }

  async unregisterTool(toolId: string): Promise<void> {
    this.logger.info('Unregistering tool', { toolId });

    // Check if tool exists
    const tool = await this.getTool(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    // Remove from database
    await this.postgres.query(
      `
      DELETE FROM tools WHERE id = $1
      `,
      [toolId]
    );

    // Remove from cache
    await this.redis.getClient().del(`tool:${toolId}`);

    // Remove from memory
    this.tools.delete(toolId);

    this.emit('toolUnregistered', toolId);
  }

  async getTool(toolId: string): Promise<Tool | null> {
    // Try cache first
    const cachedTool = await this.redis.getClient().get(`tool:${toolId}`);
    if (cachedTool) {
      return JSON.parse(cachedTool);
    }

    // Try database
    const result = await this.postgres.query<
      {
        id: string;
        version: string;
        name: string;
        description: string;
        parameters: any;
        capabilities: string[];
        metadata: any;
      }[]
    >(
      `
      SELECT * FROM tools WHERE id = $1
      `,
      [toolId]
    );

    if (result.length === 0) {
      return null;
    }

    const tool = {
      ...result[0],
      parameters: result[0].parameters,
      capabilities: result[0].capabilities,
      metadata: result[0].metadata,
    };

    // Cache the result
    await this.redis.getClient().set(
      `tool:${toolId}`,
      JSON.stringify(tool),
      { EX: 3600 } // 1 hour cache
    );

    return tool;
  }

  async listTools(): Promise<Tool[]> {
    return Array.from(this.tools.values());
  }

  private validateTool(tool: Tool): boolean {
    // Basic validation
    if (!tool.id || !tool.version || !tool.name || !tool.description) {
      return false;
    }

    // Validate parameters
    if (!Array.isArray(tool.parameters)) {
      return false;
    }

    for (const param of tool.parameters) {
      if (!param.name || !param.type || !param.description) {
        return false;
      }
    }

    // Validate capabilities
    if (!Array.isArray(tool.capabilities)) {
      return false;
    }

    return true;
  }
}
