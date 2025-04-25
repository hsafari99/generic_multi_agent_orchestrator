import { AgentStatus } from '../agent/types';

/**
 * Message types for agent-orchestrator communication
 */
export enum MessageType {
  // System messages
  HEARTBEAT = 'heartbeat',
  STATUS_UPDATE = 'status_update',
  ERROR = 'error',
  SHUTDOWN = 'shutdown',

  // Agent management
  REGISTER = 'register',
  DEREGISTER = 'deregister',
  CAPABILITY_UPDATE = 'capability_update',

  // Task management
  TASK_ASSIGN = 'task_assign',
  TASK_COMPLETE = 'task_complete',
  TASK_FAIL = 'task_fail',
  TASK_PROGRESS = 'task_progress',

  // Tool management
  TOOL_REQUEST = 'tool_request',
  TOOL_RESPONSE = 'tool_response',
  TOOL_ERROR = 'tool_error',

  // A2A communication
  A2A_MESSAGE = 'a2a_message',
  A2A_STATE_SYNC = 'a2a_state_sync',
}

/**
 * Base message interface
 */
export interface BaseMessage {
  type: MessageType;
  timestamp: number;
  sender: string;
  receiver: string;
  correlationId: string;
  version: string;
}

/**
 * Heartbeat message
 */
export interface HeartbeatMessage extends BaseMessage {
  type: MessageType.HEARTBEAT;
  status: AgentStatus;
  lastHealthCheck: number;
}

/**
 * Status update message
 */
export interface StatusUpdateMessage extends BaseMessage {
  type: MessageType.STATUS_UPDATE;
  status: AgentStatus;
  lastError?: string;
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Task assignment message
 */
export interface TaskAssignMessage extends BaseMessage {
  type: MessageType.TASK_ASSIGN;
  taskId: string;
  taskType: string;
  parameters: Record<string, unknown>;
  priority: number;
  timeout: number;
}

/**
 * Task completion message
 */
export interface TaskCompleteMessage extends BaseMessage {
  type: MessageType.TASK_COMPLETE;
  taskId: string;
  result: unknown;
  duration: number;
}

/**
 * Task failure message
 */
export interface TaskFailMessage extends BaseMessage {
  type: MessageType.TASK_FAIL;
  taskId: string;
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Task progress message
 */
export interface TaskProgressMessage extends BaseMessage {
  type: MessageType.TASK_PROGRESS;
  taskId: string;
  progress: number;
  status: string;
  details?: unknown;
}

/**
 * Tool request message
 */
export interface ToolRequestMessage extends BaseMessage {
  type: MessageType.TOOL_REQUEST;
  toolId: string;
  version: string;
  parameters: Record<string, unknown>;
  timeout: number;
}

/**
 * Tool response message
 */
export interface ToolResponseMessage extends BaseMessage {
  type: MessageType.TOOL_RESPONSE;
  toolId: string;
  result: unknown;
  duration: number;
}

/**
 * Tool error message
 */
export interface ToolErrorMessage extends BaseMessage {
  type: MessageType.TOOL_ERROR;
  toolId: string;
  error: string;
  code: string;
  details?: unknown;
}

/**
 * A2A message
 */
export interface A2AMessage extends BaseMessage {
  type: MessageType.A2A_MESSAGE;
  content: unknown;
  metadata: Record<string, unknown>;
}

/**
 * A2A state sync message
 */
export interface A2AStateSyncMessage extends BaseMessage {
  type: MessageType.A2A_STATE_SYNC;
  state: Record<string, unknown>;
  timestamp: number;
}

/**
 * Union type for all message types
 */
export type Message =
  | HeartbeatMessage
  | StatusUpdateMessage
  | ErrorMessage
  | TaskAssignMessage
  | TaskCompleteMessage
  | TaskFailMessage
  | TaskProgressMessage
  | ToolRequestMessage
  | ToolResponseMessage
  | ToolErrorMessage
  | A2AMessage
  | A2AStateSyncMessage;

/**
 * Protocol version
 */
export const PROTOCOL_VERSION = '1.0.0';

/**
 * Error codes
 */
export enum ErrorCode {
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  VERSION_MISMATCH = 'VERSION_MISMATCH',

  // Agent errors
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_BUSY = 'AGENT_BUSY',
  AGENT_ERROR = 'AGENT_ERROR',

  // Task errors
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_TIMEOUT = 'TASK_TIMEOUT',
  TASK_FAILED = 'TASK_FAILED',

  // Tool errors
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_ERROR = 'TOOL_ERROR',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',

  // A2A errors
  A2A_CONNECTION_ERROR = 'A2A_CONNECTION_ERROR',
  A2A_SYNC_ERROR = 'A2A_SYNC_ERROR',
}
