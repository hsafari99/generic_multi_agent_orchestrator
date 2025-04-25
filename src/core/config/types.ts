/**
 * Configuration types for the AI Orchestrator
 *
 * This module defines all configuration-related types and interfaces.
 *
 * @packageDocumentation
 */

/**
 * WebSocket server configuration
 */
export interface WebSocketConfig {
  /** Port to listen on */
  port: number;
  /** Optional path for WebSocket connections */
  path?: string;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  /** Maximum number of concurrent connections */
  maxConnections?: number;
}

/**
 * Main configuration interface for the Orchestrator
 */
export interface OrchestratorConfig {
  /** Core system configuration */
  system: SystemConfig;
  /** Agent management configuration */
  agents: AgentConfig;
  /** Message handling configuration */
  messaging: MessagingConfig;
  /** Tool management configuration */
  tools: ToolConfig;
  /** Logging configuration */
  logging: LoggingConfig;
  /** WebSocket server configuration */
  websocket: WebSocketConfig;
}

/**
 * System-wide configuration
 */
export interface SystemConfig {
  /** Name of the orchestrator instance */
  name: string;
  /** Version of the orchestrator */
  version: string;
  /** Environment (development, production, test) */
  environment: string;
  /** Maximum number of concurrent operations */
  maxConcurrency: number;
  /** Timeout for operations in milliseconds */
  operationTimeout: number;
  /** Directory for storing persistent data */
  dataDir: string;
}

/**
 * Agent management configuration
 */
export interface AgentConfig {
  /** Default timeout for agent operations in milliseconds */
  defaultTimeout: number;
  /** Maximum number of agents allowed */
  maxAgents: number;
  /** Auto-recovery settings for failed agents */
  recovery: {
    /** Whether to enable auto-recovery */
    enabled: boolean;
    /** Maximum retry attempts */
    maxRetries: number;
    /** Delay between retries in milliseconds */
    retryDelay: number;
  };
  /** Health check configuration */
  healthCheck: {
    /** Whether to enable health checks */
    enabled: boolean;
    /** Interval between health checks in milliseconds */
    interval: number;
    /** Timeout for health check responses */
    timeout: number;
  };
}

/**
 * Message handling configuration
 */
export interface MessagingConfig {
  /** Maximum message size in bytes */
  maxMessageSize: number;
  /** Message retention period in milliseconds */
  retentionPeriod: number;
  /** Message queue settings */
  queue: {
    /** Maximum queue size */
    maxSize: number;
    /** Whether to persist messages */
    persistent: boolean;
  };
  /** Rate limiting settings */
  rateLimit: {
    /** Whether to enable rate limiting */
    enabled: boolean;
    /** Maximum requests per window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
  };
}

/**
 * Tool management configuration
 */
export interface ToolConfig {
  /** Maximum number of concurrent tool executions */
  maxConcurrentExecutions: number;
  /** Default timeout for tool operations in milliseconds */
  defaultTimeout: number;
  /** Whether to validate tool inputs */
  validateInputs: boolean;
  /** Whether to cache tool results */
  cacheResults: boolean;
  /** Tool execution retry settings */
  retry: {
    /** Whether to enable retries */
    enabled: boolean;
    /** Maximum retry attempts */
    maxRetries: number;
    /** Delay between retries in milliseconds */
    retryDelay: number;
  };
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Minimum log level to record */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Whether to enable console logging */
  console: boolean;
  /** File logging settings */
  file: {
    /** Whether to enable file logging */
    enabled: boolean;
    /** Directory for log files */
    directory: string;
    /** Maximum size of each log file in bytes */
    maxSize: number;
    /** Maximum number of log files to keep */
    maxFiles: number;
  };
}
