import { EventEmitter } from 'events';

/**
 * Task types supported by the system
 */
export enum TaskType {
  COMPUTATION = 'COMPUTATION',
  COMMUNICATION = 'COMMUNICATION',
  STORAGE = 'STORAGE',
}

/**
 * Task status states
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Task dependency model
 */
export interface TaskDependency {
  taskId: string;
  type: 'required' | 'optional';
  timeout?: number;
}

/**
 * Task resource requirements
 */
export interface TaskResources {
  cpu?: number;
  memory?: number;
  storage?: number;
  network?: {
    bandwidth?: number;
    latency?: number;
  };
}

/**
 * Task configuration
 */
export interface TaskConfig {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  timeout?: number;
  retries?: number;
  dependencies?: TaskDependency[];
  resources?: TaskResources;
  metadata?: Record<string, any>;
}

/**
 * Task result
 */
export interface TaskResult {
  success: boolean;
  data?: any;
  error?: Error;
  duration: number;
  metadata?: Record<string, any>;
}

/**
 * Task validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Core task interface
 */
export interface Task extends EventEmitter {
  // Properties
  readonly id: string;
  readonly type: TaskType;
  readonly priority: TaskPriority;
  readonly status: TaskStatus;
  readonly config: TaskConfig;
  readonly result?: TaskResult;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly duration?: number;

  // Methods
  validate(): Promise<ValidationResult>;
  execute(): Promise<TaskResult>;
  cancel(): Promise<void>;
  cleanup(): Promise<void>;

  // Event handlers
  on(event: 'start', listener: () => void): this;
  on(event: 'complete', listener: (result: TaskResult) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'cancel', listener: () => void): this;
  on(event: 'cleanup', listener: () => void): this;
}

/**
 * Task factory interface
 */
export interface TaskFactory {
  createTask(config: TaskConfig): Promise<Task>;
  validateConfig(config: TaskConfig): ValidationResult;
}

/**
 * Task registry interface
 */
export interface TaskRegistry {
  registerTaskType(type: TaskType, factory: TaskFactory): void;
  getTaskFactory(type: TaskType): TaskFactory;
  hasTaskType(type: TaskType): boolean;
  getRegisteredTypes(): TaskType[];
}
