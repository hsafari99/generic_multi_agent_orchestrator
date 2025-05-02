/**
 * Agent status enum
 */
export enum AgentStatus {
  INITIALIZING = 'initializing',
  READY = 'ready',
  BUSY = 'busy',
  ERROR = 'error',
  SHUTDOWN = 'shutdown',
}

/**
 * Agent health status enum
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Agent capabilities interface
 */
export interface AgentCapabilities {
  /** List of tools the agent can use */
  tools: string[];
  /** List of protocols the agent supports */
  protocols: string[];
  /** Maximum number of concurrent operations */
  maxConcurrency: number;
  /** Whether the agent can handle long-running tasks */
  supportsLongRunningTasks: boolean;
}

/**
 * Agent state interface
 */
export interface AgentState {
  /** Current status of the agent */
  status: AgentStatus;

  /** Health status of the agent */
  health: {
    status: HealthStatus;
    lastCheck: Date;
    metrics: {
      cpu: number;
      memory: number;
      responseTime: number;
      errorRate: number;
    };
  };

  /** Current number of active operations */
  activeOperations: number;

  /** Current task being processed, if any */
  currentTask?: string;

  /** Last error message if any */
  lastError?: string;

  /** Timestamp of last status change */
  lastStatusChange: Date;

  /** Timestamp of last health check */
  lastHealthCheck: Date;

  /** Resource usage metrics */
  resources: {
    cpu: number;
    memory: number;
    network: {
      bytesIn: number;
      bytesOut: number;
    };
  };

  /** Current capabilities of the agent */
  capabilities: string[];

  /** Current load percentage (0-100) */
  load: number;

  /** Priority level of the agent */
  priority?: 'low' | 'normal' | 'high' | 'critical';

  /** Whether the agent is available for new tasks */
  isAvailable: boolean;
}

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Unique identifier for the agent */
  id: string;
  /** Display name of the agent */
  name: string;
  /** Description of the agent's purpose */
  description: string;
  /** Agent capabilities */
  capabilities: AgentCapabilities;
  /** Maximum number of retries for operations */
  maxRetries: number;
  /** Timeout for operations in milliseconds */
  operationTimeout: number;
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
}

/**
 * Agent interface
 */
export interface IAgent {
  /** Get agent configuration */
  getConfig(): AgentConfig;

  /** Get current agent state */
  getState(): AgentState;

  /** Initialize the agent */
  initialize(): Promise<void>;

  /** Start the agent */
  start(): Promise<void>;

  /** Stop the agent */
  stop(): Promise<void>;

  /** Shutdown the agent */
  shutdown(): Promise<void>;

  /** Check agent health */
  checkHealth(): Promise<boolean>;

  /** Update agent capabilities */
  updateCapabilities(capabilities: AgentCapabilities): Promise<void>;

  /** Register the agent with the orchestrator */
  register(): Promise<void>;

  /** Deregister the agent from the orchestrator */
  deregister(): Promise<void>;
}
