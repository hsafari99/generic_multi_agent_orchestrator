/**
 * Configuration loader for the AI Orchestrator
 *
 * This module handles loading configuration from various sources:
 * - Default values
 * - Configuration files
 * - Environment variables
 * - Runtime overrides
 *
 * @packageDocumentation
 */

import {
  OrchestratorConfig,
  SystemConfig,
  AgentConfig,
  MessagingConfig,
  ToolConfig,
  LoggingConfig,
} from './types';
import * as fs from 'fs';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: OrchestratorConfig = {
  system: {
    name: 'AI Orchestrator',
    version: '1.0.0',
    environment: 'development',
    maxConcurrency: 10,
    operationTimeout: 30000,
    dataDir: './data',
  },
  agents: {
    defaultTimeout: 5000,
    maxAgents: 100,
    recovery: {
      enabled: true,
      maxRetries: 3,
      retryDelay: 1000,
    },
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
    },
  },
  messaging: {
    maxMessageSize: 1024 * 1024, // 1MB
    retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
    queue: {
      maxSize: 1000,
      persistent: true,
    },
    rateLimit: {
      enabled: true,
      maxRequests: 1000,
      windowMs: 60000,
    },
  },
  tools: {
    maxConcurrentExecutions: 5,
    defaultTimeout: 10000,
    validateInputs: true,
    cacheResults: true,
    retry: {
      enabled: true,
      maxRetries: 3,
      retryDelay: 1000,
    },
  },
  logging: {
    level: 'info',
    console: true,
    file: {
      enabled: true,
      directory: './logs',
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    },
  },
};

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Configuration loader class
 */
export class ConfigLoader {
  private config: OrchestratorConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Load configuration from a file
   * @param filePath - Path to the configuration file
   * @throws {Error} If file reading fails
   */
  public loadFromFile(filePath: string): void {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileConfig = JSON.parse(fileContent);
      this.mergeConfig(fileConfig);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error instanceof SyntaxError) {
          throw new Error('Failed to parse config file');
        }
        throw new Error(`Failed to load config from file: ${error.message}`);
      }
      throw new Error('Failed to load config from file: Unknown error');
    }
  }

  /**
   * Load configuration from environment variables
   */
  public loadFromEnv(): void {
    // System configuration
    const name = process.env.ORCHESTRATOR_NAME?.trim() || 'AI Orchestrator';
    const version = process.env.ORCHESTRATOR_VERSION?.trim() || '1.0.0';
    const maxConcurrency = this.parseEnvInt('ORCHESTRATOR_MAX_CONCURRENCY', 10);
    const operationTimeout = this.parseEnvInt('ORCHESTRATOR_OPERATION_TIMEOUT', 30000);
    const environment = process.env.ORCHESTRATOR_ENV?.trim() || 'development';
    const dataDir = process.env.ORCHESTRATOR_DATA_DIR?.trim() || './data';

    this.config.system = {
      name,
      version,
      maxConcurrency,
      operationTimeout,
      environment,
      dataDir,
    };

    // Agent configuration
    const defaultTimeout = this.parseEnvInt('ORCHESTRATOR_AGENT_TIMEOUT', 5000);
    const maxAgents = this.parseEnvInt('ORCHESTRATOR_MAX_AGENTS', 100);
    const recoveryEnabled = this.parseEnvBool('ORCHESTRATOR_AGENT_RECOVERY_ENABLED', true);
    const retryDelay = this.parseEnvInt('ORCHESTRATOR_AGENT_RETRY_DELAY', 1000);
    const maxRetries = this.parseEnvInt('ORCHESTRATOR_AGENT_MAX_RETRIES', 3);
    const healthCheckEnabled = this.parseEnvBool('ORCHESTRATOR_HEALTH_CHECK_ENABLED', true);
    const healthCheckInterval = this.parseEnvInt('ORCHESTRATOR_HEALTH_CHECK_INTERVAL', 30000);
    const healthCheckTimeout = this.parseEnvInt('ORCHESTRATOR_HEALTH_CHECK_TIMEOUT', 5000);

    this.config.agents = {
      defaultTimeout,
      maxAgents,
      recovery: {
        enabled: recoveryEnabled,
        retryDelay,
        maxRetries,
      },
      healthCheck: {
        enabled: healthCheckEnabled,
        interval: healthCheckInterval,
        timeout: healthCheckTimeout,
      },
    };

    // Messaging configuration
    const maxMessageSize = this.parseEnvInt('ORCHESTRATOR_MAX_MESSAGE_SIZE', 1048576);
    const rateLimitEnabled = this.parseEnvBool('ORCHESTRATOR_RATE_LIMIT_ENABLED', false);
    const maxRequests = this.parseEnvInt('ORCHESTRATOR_RATE_LIMIT_MAX_REQUESTS', 100);
    const windowMs = this.parseEnvInt('ORCHESTRATOR_RATE_LIMIT_WINDOW_MS', 60000);
    const retentionPeriod = this.parseEnvInt('ORCHESTRATOR_MESSAGE_RETENTION', 86400000);
    const queueMaxSize = this.parseEnvInt('ORCHESTRATOR_QUEUE_SIZE', 1000);
    const queuePersistent = this.parseEnvBool('ORCHESTRATOR_QUEUE_PERSISTENT', false);

    this.config.messaging = {
      maxMessageSize,
      rateLimit: {
        enabled: rateLimitEnabled,
        maxRequests,
        windowMs,
      },
      retentionPeriod,
      queue: {
        maxSize: queueMaxSize,
        persistent: queuePersistent,
      },
    };

    // Tool configuration
    const validateInputs = this.parseEnvBool('ORCHESTRATOR_TOOL_VALIDATE', true);
    const maxConcurrentExecutions = this.parseEnvInt('ORCHESTRATOR_TOOL_MAX_CONCURRENT', 5);
    const toolDefaultTimeout = this.parseEnvInt('ORCHESTRATOR_TOOL_TIMEOUT', 30000);

    this.config.tools = {
      validateInputs,
      maxConcurrentExecutions,
      defaultTimeout: toolDefaultTimeout,
      cacheResults: false,
      retry: {
        enabled: false,
        maxRetries: 3,
        retryDelay: 1000,
      },
    };

    // Logging configuration
    const consoleEnabled = this.parseEnvBool('ORCHESTRATOR_LOG_CONSOLE', true);
    const fileEnabled = this.parseEnvBool('ORCHESTRATOR_LOG_FILE', false);
    const logDir = process.env.ORCHESTRATOR_LOG_DIR?.trim() || './logs';
    const logLevel = (process.env.ORCHESTRATOR_LOG_LEVEL?.trim() || 'info') as
      | 'debug'
      | 'info'
      | 'warn'
      | 'error';
    const maxSize = this.parseEnvInt('ORCHESTRATOR_LOG_MAX_SIZE', 10485760);
    const maxFiles = this.parseEnvInt('ORCHESTRATOR_LOG_MAX_FILES', 5);

    this.config.logging = {
      console: consoleEnabled,
      file: {
        enabled: fileEnabled,
        directory: logDir,
        maxSize,
        maxFiles,
      },
      level: logLevel,
    };
  }

  private parseEnvInt(key: string, defaultValue: number): number {
    const value = process.env[key]?.trim();
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private parseEnvBool(key: string, defaultValue: boolean): boolean {
    const value = process.env[key]?.trim()?.toLowerCase();
    if (!value) return defaultValue;

    if (value === 'true') return true;
    if (value === 'false') return false;
    return defaultValue;
  }

  /**
   * Update configuration with runtime values
   * @param updates - Partial configuration updates
   */
  public updateConfig(updates: Partial<OrchestratorConfig>): void {
    this.mergeConfig(updates);
  }

  /**
   * Get the current configuration
   * @returns The current configuration
   */
  public getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  /**
   * Validate the current configuration
   * @throws {ConfigValidationError} If validation fails
   */
  public validate(): void {
    this.validateSystemConfig(this.config.system);
    this.validateAgentConfig(this.config.agents);
    this.validateMessagingConfig(this.config.messaging);
    this.validateToolConfig(this.config.tools);
    this.validateLoggingConfig(this.config.logging);
  }

  private mergeConfig(updates: Partial<OrchestratorConfig>): void {
    if (!updates) return;

    // Handle null/undefined values in updates
    const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined) {
        (acc as any)[key] = value;
      }
      return acc;
    }, {} as Partial<OrchestratorConfig>);

    this.config = {
      ...this.config,
      system: { ...this.config.system, ...(cleanUpdates.system || {}) },
      agents: {
        ...this.config.agents,
        ...(cleanUpdates.agents || {}),
        recovery: {
          ...this.config.agents.recovery,
          ...(cleanUpdates.agents?.recovery || {}),
        },
        healthCheck: {
          ...this.config.agents.healthCheck,
          ...(cleanUpdates.agents?.healthCheck || {}),
        },
      },
      messaging: {
        ...this.config.messaging,
        ...(cleanUpdates.messaging || {}),
        queue: {
          ...this.config.messaging.queue,
          ...(cleanUpdates.messaging?.queue || {}),
        },
        rateLimit: {
          ...this.config.messaging.rateLimit,
          ...(cleanUpdates.messaging?.rateLimit || {}),
        },
      },
      tools: {
        ...this.config.tools,
        ...(cleanUpdates.tools || {}),
        retry: {
          ...this.config.tools.retry,
          ...(cleanUpdates.tools?.retry || {}),
        },
      },
      logging: {
        ...this.config.logging,
        ...(cleanUpdates.logging || {}),
        file: {
          ...this.config.logging.file,
          ...(cleanUpdates.logging?.file || {}),
        },
      },
    };
  }

  private validateSystemConfig(config: SystemConfig): void {
    if (!config.name) throw new ConfigValidationError('System name is required');
    if (!config.version) throw new ConfigValidationError('System version is required');
    if (!config.environment) throw new ConfigValidationError('System environment is required');
    if (config.maxConcurrency < 1)
      throw new ConfigValidationError('maxConcurrency must be greater than 0');
    if (config.operationTimeout < 1)
      throw new ConfigValidationError('operationTimeout must be greater than 0');
  }

  private validateAgentConfig(config: AgentConfig): void {
    if (config.defaultTimeout < 1)
      throw new ConfigValidationError('Agent defaultTimeout must be greater than 0');
    if (config.maxAgents < 1) throw new ConfigValidationError('maxAgents must be greater than 0');
    if (config.recovery.maxRetries < 0)
      throw new ConfigValidationError('recovery.maxRetries must be non-negative');
    if (config.recovery.retryDelay < 1)
      throw new ConfigValidationError('recovery.retryDelay must be greater than 0');
  }

  private validateMessagingConfig(config: MessagingConfig): void {
    if (config.maxMessageSize < 1)
      throw new ConfigValidationError('maxMessageSize must be greater than 0');
    if (config.retentionPeriod < 0)
      throw new ConfigValidationError('retentionPeriod must be non-negative');
    if (config.queue.maxSize < 1)
      throw new ConfigValidationError('queue.maxSize must be greater than 0');
    if (config.rateLimit.enabled) {
      if (config.rateLimit.maxRequests < 1)
        throw new ConfigValidationError('maxRequests must be greater than 0');
      if (config.rateLimit.windowMs < 1)
        throw new ConfigValidationError('windowMs must be greater than 0');
    }
  }

  private validateToolConfig(config: ToolConfig): void {
    if (config.maxConcurrentExecutions < 1)
      throw new ConfigValidationError('maxConcurrentExecutions must be greater than 0');
    if (config.defaultTimeout < 1)
      throw new ConfigValidationError('Tool defaultTimeout must be greater than 0');
    if (config.retry.maxRetries < 0)
      throw new ConfigValidationError('retry.maxRetries must be non-negative');
    if (config.retry.retryDelay < 0)
      throw new ConfigValidationError('retry.retryDelay must be non-negative');
  }

  private validateLoggingConfig(config: LoggingConfig): void {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(config.level)) {
      throw new ConfigValidationError(`Log level must be one of: ${validLevels.join(', ')}`);
    }
    if (config.file.enabled) {
      if (!config.file.directory)
        throw new ConfigValidationError('Log directory is required when file logging is enabled');
      if (config.file.maxSize < 1)
        throw new ConfigValidationError('file.maxSize must be greater than 0');
      if (config.file.maxFiles < 1)
        throw new ConfigValidationError('file.maxFiles must be greater than 0');
    }
  }
}
