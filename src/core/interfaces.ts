/**
 * Core interfaces and types for the AI Orchestrator
 *
 * This module defines all core interfaces and types used throughout the orchestrator system.
 * It includes agent management, message handling, tool management, and task execution interfaces.
 *
 * @packageDocumentation
 */

/**
 * Represents the possible states of an agent in the system
 */
export enum AgentStatus {
  /** Agent is in the process of initializing */
  INITIALIZING = 'INITIALIZING',
  /** Agent is ready to receive and process tasks */
  READY = 'READY',
  /** Agent is currently processing a task */
  BUSY = 'BUSY',
  /** Agent has encountered an error */
  ERROR = 'ERROR',
  /** Agent has been shut down */
  SHUTDOWN = 'SHUTDOWN',
}

/**
 * Represents the types of messages that can be exchanged in the system
 */
export enum MessageType {
  /** Message containing a task to be executed */
  TASK = 'task',
  /** Message containing the result of a task execution */
  RESULT = 'RESULT',
  /** Message containing status updates */
  STATUS = 'STATUS',
  /** Message containing error information */
  ERROR = 'error',
  /** Message containing control commands */
  CONTROL = 'CONTROL',
  /** Message containing a response to a task */
  RESPONSE = 'response',
  /** Message containing a heartbeat */
  HEARTBEAT = 'heartbeat',
  /** Message containing a broadcast */
  BROADCAST = 'broadcast',
  /** Message containing a message processing command */
  MCP = 'mcp',
}

/**
 * Represents the possible states of the orchestrator
 */
export enum OrchestratorStatus {
  /** Orchestrator is in the process of initializing */
  INITIALIZING = 'INITIALIZING',
  /** Orchestrator is running and processing messages */
  RUNNING = 'RUNNING',
  /** Orchestrator is in maintenance mode */
  MAINTENANCE = 'MAINTENANCE',
  /** Orchestrator has encountered an error */
  ERROR = 'ERROR',
  /** Orchestrator has been shut down */
  SHUTDOWN = 'SHUTDOWN',
}

/**
 * Interface for agents in the system
 */
export interface IAgent {
  /** Unique identifier for the agent */
  id: string;
  /** Display name of the agent */
  name: string;
  /** List of capabilities this agent possesses */
  capabilities: string[];
  /** Current status of the agent */
  status: AgentStatus;
  /** List of tools available to this agent */
  tools: ITool[];

  /**
   * Initialize the agent
   * @throws {Error} If initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the agent
   * @throws {Error} If shutdown fails
   */
  shutdown(): Promise<void>;

  /**
   * Execute a task
   * @param task - The task to execute
   * @returns The result of the task execution
   * @throws {Error} If task execution fails
   */
  executeTask(task: ITask): Promise<TaskResult>;

  /**
   * Handle an incoming message
   * @param message - The message to handle
   * @returns The response message
   * @throws {Error} If message handling fails
   */
  handleMessage(message: IMessage): Promise<IMessage>;
}

/**
 * Interface for tools that can be used by agents
 */
export interface ITool {
  /** Unique identifier for the tool */
  id: string;
  /** Display name of the tool */
  name: string;
  /** Version of the tool */
  version: string;
  /** List of capabilities this tool provides */
  capabilities: string[];

  /**
   * Execute the tool with given parameters
   * @param params - Parameters for tool execution
   * @returns The result of tool execution
   * @throws {Error} If execution fails
   */
  execute(params: any): Promise<any>;

  /**
   * Validate if the given parameters are valid for this tool
   * @param params - Parameters to validate
   * @returns True if parameters are valid, false otherwise
   */
  validate(params: any): boolean;

  /**
   * Get metadata about this tool
   * @returns Tool metadata including description, parameters, and examples
   */
  getMetadata(): ToolMetadata;
}

/**
 * Interface for messages exchanged in the system
 */
export interface IMessage {
  /** Unique identifier for the message */
  id: string;
  /** Type of the message */
  type: MessageType;
  /** ID of the message sender */
  sender: string;
  /** ID of the message receiver */
  receiver: string;
  /** Message payload */
  payload: any;
  /** Timestamp when the message was created */
  timestamp: number;
  /** Additional message metadata */
  metadata: MessageMetadata;
  /** Timeout for the message */
  timeout?: number;
}

/**
 * Interface for tasks that can be executed by agents
 */
export interface ITask {
  /** Unique identifier for the task */
  id: string;
  /** Type of the task */
  type: string;
  /** Description of the task */
  description: string;
  /** Priority of the task (higher number = higher priority) */
  priority: number;
  /** Current status of the task */
  status: TaskStatus;
  /** ID of the agent assigned to this task (optional) */
  agentId?: string;
  /** Task data */
  data: any;
  /** Additional task metadata */
  metadata: any;

  /**
   * Execute the task
   * @returns The result of task execution
   * @throws {Error} If execution fails
   */
  execute(): Promise<TaskResult>;
}

/**
 * Interface for tool metadata
 */
export interface ToolMetadata {
  /** Description of what the tool does */
  description: string;
  /** List of parameters the tool accepts */
  parameters: ParameterDefinition[];
  /** Type of the tool's return value */
  returnType: string;
  /** List of example usages */
  examples: Example[];
}

/**
 * Interface for parameter definitions
 */
export interface ParameterDefinition {
  /** Name of the parameter */
  name: string;
  /** Type of the parameter */
  type: string;
  /** Whether the parameter is required */
  required: boolean;
  /** Description of the parameter */
  description: string;
}

/**
 * Interface for example usages
 */
export interface Example {
  /** Example input */
  input: any;
  /** Example output */
  output: any;
  /** Description of the example */
  description: string;
}

/**
 * Interface for message metadata
 */
export interface MessageMetadata {
  /** Priority of the message (higher number = higher priority) */
  priority?: number;
  /** Time-to-live in milliseconds (optional) */
  ttl?: number;
  /** List of tags associated with the message (optional) */
  tags?: string[];
  /** Whether the message requires acknowledgment */
  requiresAck?: boolean;
  /** WebSocket connection ID (optional) */
  connectionId?: string;
  /** Topic of the message (optional) */
  topic?: string;
  /** Additional metadata */
  [key: string]: any;
}

/**
 * Interface for task execution results
 */
export interface TaskResult {
  /** Whether the task was executed successfully */
  success: boolean;
  /** Result data (if successful) */
  data?: any;
  /** Error information (if failed) */
  error?: Error;
  /** Duration of task execution in milliseconds */
  duration: number;
}

/**
 * Represents the possible states of a task
 */
export enum TaskStatus {
  /** Task is waiting to be executed */
  PENDING = 'PENDING',
  /** Task is currently being executed */
  RUNNING = 'RUNNING',
  /** Task has completed successfully */
  COMPLETED = 'COMPLETED',
  /** Task has failed */
  FAILED = 'FAILED',
  /** Task has been cancelled */
  CANCELLED = 'CANCELLED',
}

/**
 * Interface for the orchestrator's message handling capabilities
 */
export interface IOrchestrator {
  handleMessage(message: IMessage): Promise<IMessage>;
}
