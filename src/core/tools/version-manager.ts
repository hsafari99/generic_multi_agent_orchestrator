import { EventEmitter } from 'events';
import { Logger } from '../logging/logger';
import { PostgresClient } from '../storage/postgres';
import { RedisClient } from '../cache/client';
import { Tool } from './tool-manager';

export interface ToolVersionManagerConfig {
  postgres: PostgresClient;
  redis: RedisClient;
}

export interface ToolVersion {
  toolId: string;
  version: string;
  parameters: any;
  capabilities: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
}

export class ToolVersionManager extends EventEmitter {
  private postgres: PostgresClient;
  private redis: RedisClient;
  private logger: Logger;

  constructor(config: ToolVersionManagerConfig) {
    super();
    this.postgres = config.postgres;
    this.redis = config.redis;
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing tool version manager');
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    await this.postgres.query(`
      CREATE TABLE IF NOT EXISTS tool_versions (
        tool_id VARCHAR(255) REFERENCES tools(id),
        version VARCHAR(50) NOT NULL,
        parameters JSONB NOT NULL,
        capabilities JSONB NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tool_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_tool_versions_tool_id ON tool_versions(tool_id);
      CREATE INDEX IF NOT EXISTS idx_tool_versions_version ON tool_versions(version);
    `);
  }

  async addVersion(tool: Tool): Promise<void> {
    this.logger.info('Adding tool version', { toolId: tool.id, version: tool.version });

    // Validate version format
    if (!this.isValidVersion(tool.version)) {
      throw new Error(`Invalid version format: ${tool.version}`);
    }

    // Check if version exists
    const existingVersion = await this.getVersion(tool.id, tool.version);
    if (existingVersion) {
      throw new Error(`Version ${tool.version} already exists for tool ${tool.id}`);
    }

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

    // Cache version
    await this.redis.getClient().set(
      `tool:${tool.id}:version:${tool.version}`,
      JSON.stringify({
        toolId: tool.id,
        version: tool.version,
        parameters: tool.parameters,
        capabilities: tool.capabilities,
        metadata: tool.metadata,
        createdAt: new Date(),
      }),
      { EX: 3600 } // 1 hour cache
    );

    this.emit('versionAdded', { toolId: tool.id, version: tool.version });
  }

  async getVersion(toolId: string, version: string): Promise<ToolVersion | null> {
    // Try cache first
    const cachedVersion = await this.redis.getClient().get(`tool:${toolId}:version:${version}`);
    if (cachedVersion) {
      const parsed = JSON.parse(cachedVersion);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
      };
    }

    // Try database
    const result = await this.postgres.query<
      {
        tool_id: string;
        version: string;
        parameters: any;
        capabilities: string[];
        metadata: any;
        created_at: Date;
      }[]
    >(
      `
      SELECT * FROM tool_versions WHERE tool_id = $1 AND version = $2
      `,
      [toolId, version]
    );

    if (result.length === 0) {
      return null;
    }

    const toolVersion = {
      toolId: result[0].tool_id,
      version: result[0].version,
      parameters: result[0].parameters,
      capabilities: result[0].capabilities,
      metadata: result[0].metadata,
      createdAt: result[0].created_at,
    };

    // Cache the result
    await this.redis.getClient().set(
      `tool:${toolId}:version:${version}`,
      JSON.stringify(toolVersion),
      { EX: 3600 } // 1 hour cache
    );

    return toolVersion;
  }

  async listVersions(toolId: string): Promise<ToolVersion[]> {
    const result = await this.postgres.query<
      {
        tool_id: string;
        version: string;
        parameters: any;
        capabilities: string[];
        metadata: any;
        created_at: Date;
      }[]
    >(
      `
      SELECT * FROM tool_versions WHERE tool_id = $1 ORDER BY created_at DESC
      `,
      [toolId]
    );

    return result.map(row => ({
      toolId: row.tool_id,
      version: row.version,
      parameters: row.parameters,
      capabilities: row.capabilities,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));
  }

  async getLatestVersion(toolId: string): Promise<ToolVersion | null> {
    const result = await this.postgres.query<
      {
        tool_id: string;
        version: string;
        parameters: any;
        capabilities: string[];
        metadata: any;
        created_at: Date;
      }[]
    >(
      `
      SELECT * FROM tool_versions 
      WHERE tool_id = $1 
      ORDER BY version DESC 
      LIMIT 1
      `,
      [toolId]
    );

    if (result.length === 0) {
      return null;
    }

    return {
      toolId: result[0].tool_id,
      version: result[0].version,
      parameters: result[0].parameters,
      capabilities: result[0].capabilities,
      metadata: result[0].metadata,
      createdAt: result[0].created_at,
    };
  }

  private isValidVersion(version: string): boolean {
    // Semantic versioning format: major.minor.patch
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
  }
}
