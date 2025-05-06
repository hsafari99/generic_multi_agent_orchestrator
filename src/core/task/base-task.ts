import { EventEmitter } from 'events';
import {
  Task,
  TaskConfig,
  TaskResult,
  TaskStatus,
  TaskType,
  TaskPriority,
  ValidationResult,
} from './types';
import { Logger } from '../logging/logger';

/**
 * Base task class that implements the Task interface
 */
export abstract class BaseTask extends EventEmitter implements Task {
  protected readonly logger: Logger;
  protected _status: TaskStatus = TaskStatus.PENDING;
  protected _result?: TaskResult;
  protected _startTime?: Date;
  protected _endTime?: Date;
  protected _duration?: number;
  protected _isCancelled: boolean = false;

  constructor(
    public readonly id: string,
    public readonly type: TaskType,
    public readonly priority: TaskPriority,
    public readonly config: TaskConfig
  ) {
    super();
    this.logger = Logger.getInstance();
  }

  // Getters for readonly properties
  get status(): TaskStatus {
    return this._status;
  }

  get result(): TaskResult | undefined {
    return this._result;
  }

  get startTime(): Date | undefined {
    return this._startTime;
  }

  get endTime(): Date | undefined {
    return this._endTime;
  }

  get duration(): number | undefined {
    return this._duration;
  }

  /**
   * Validate the task configuration and state
   */
  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!this.id) {
      errors.push('Task ID is required');
    }

    if (!this.type) {
      errors.push('Task type is required');
    }

    if (!this.priority) {
      errors.push('Task priority is required');
    }

    // Validate dependencies
    if (this.config.dependencies) {
      for (const dep of this.config.dependencies) {
        if (!dep.taskId) {
          errors.push('Dependency task ID is required');
        }
        if (!dep.type) {
          errors.push('Dependency type is required');
        }
      }
    }

    // Validate resources
    if (this.config.resources) {
      const { cpu, memory, storage, network } = this.config.resources;
      if (cpu && cpu < 0) {
        errors.push('CPU requirement must be non-negative');
      }
      if (memory && memory < 0) {
        errors.push('Memory requirement must be non-negative');
      }
      if (storage && storage < 0) {
        errors.push('Storage requirement must be non-negative');
      }
      if (network) {
        if (network.bandwidth && network.bandwidth < 0) {
          errors.push('Network bandwidth must be non-negative');
        }
        if (network.latency && network.latency < 0) {
          errors.push('Network latency must be non-negative');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Execute the task
   */
  async execute(): Promise<TaskResult> {
    try {
      this.logger.debug(`[${this.id}] Starting task execution`);
      // Validate before execution
      const validation = await this.validate();
      if (!validation.valid) {
        this._status = TaskStatus.FAILED;
        this._result = {
          success: false,
          error: new Error(`Task validation failed: ${validation.errors?.join(', ')}`),
          duration: 0,
        };
        this.emit('error', this._result.error);
        return this._result;
      }

      // Check if task was cancelled before starting execution
      if (this._isCancelled) {
        this.logger.debug(`[${this.id}] Task was cancelled before execution`);
        this._status = TaskStatus.FAILED;
        this._result = {
          success: false,
          error: new Error('Task was cancelled before execution'),
          duration: 0,
        };
        this.emit('error', this._result.error);
        return this._result;
      }

      // Update state
      this._status = TaskStatus.RUNNING;
      this._startTime = new Date();
      this.emit('start');
      this.logger.debug(`[${this.id}] Task status set to RUNNING`);

      try {
        // Execute task-specific logic
        const result = await this.executeTask();
        this.logger.debug(`[${this.id}] Task execution completed`);

        // Check if task was cancelled during execution
        if (this._isCancelled) {
          this.logger.debug(`[${this.id}] Task was cancelled during execution`);
          this._status = TaskStatus.FAILED;
          this._endTime = new Date();
          this._duration = this._endTime.getTime() - (this._startTime?.getTime() || 0);
          this._result = {
            success: false,
            error: new Error('Task was cancelled during execution'),
            duration: this._duration,
          };
          this.emit('error', this._result.error);
          return this._result;
        }

        // Update state based on result success
        this._status = result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED;
        this._endTime = new Date();
        this._duration = this._endTime.getTime() - this._startTime.getTime();
        this._result = {
          ...result,
          duration: this._duration,
        };

        if (result.success) {
          this.emit('complete', this._result);
        } else if (result.error) {
          this.emit('error', result.error);
        }
        return this._result;
      } catch (error) {
        // Handle errors from task-specific execution
        this.logger.debug(`[${this.id}] Error during task execution: ${error}`);
        this._status = TaskStatus.FAILED;
        this._endTime = new Date();
        this._duration = this._endTime.getTime() - (this._startTime?.getTime() || 0);

        // Ensure we have a proper Error object
        const errorObj = error instanceof Error ? error : new Error(String(error));

        this._result = {
          success: false,
          error: errorObj,
          duration: this._duration,
        };

        // Emit error event before returning
        this.emit('error', errorObj);
        return this._result;
      }
    } catch (error) {
      // Handle any other errors
      this.logger.debug(`[${this.id}] Error during task execution: ${error}`);
      this._status = TaskStatus.FAILED;
      this._endTime = new Date();
      this._duration = this._endTime.getTime() - (this._startTime?.getTime() || 0);

      // Ensure we have a proper Error object
      const errorObj = error instanceof Error ? error : new Error(String(error));

      this._result = {
        success: false,
        error: errorObj,
        duration: this._duration,
      };

      // Emit error event before returning
      this.emit('error', errorObj);
      return this._result;
    }
  }

  /**
   * Cancel the task
   */
  async cancel(): Promise<void> {
    this.logger.debug(`[${this.id}] Cancelling task`);
    this._isCancelled = true;

    // If task is still pending, mark it as failed immediately
    if (this._status === TaskStatus.PENDING) {
      this._status = TaskStatus.FAILED;
      this._result = {
        success: false,
        error: new Error('Task was cancelled before execution'),
        duration: 0,
      };
      this.emit('error', this._result.error);
      return;
    }

    // If task is running, call the task-specific cancellation
    if (this._status === TaskStatus.RUNNING) {
      try {
        await this.cancelTask();
        this._status = TaskStatus.FAILED;
        this._result = {
          success: false,
          error: new Error('Task was cancelled during execution'),
          duration: this._duration || 0,
        };
        this.emit('error', this._result.error);
      } catch (error) {
        // Handle any errors during cancellation
        const errorObj = error instanceof Error ? error : new Error(String(error));
        this._status = TaskStatus.FAILED;
        this._result = {
          success: false,
          error: errorObj,
          duration: this._duration || 0,
        };
        this.emit('error', errorObj);
      }
    }
  }

  /**
   * Clean up task resources
   */
  async cleanup(): Promise<void> {
    await this.cleanupTask();
    this.emit('cleanup');
  }

  /**
   * Task-specific execution logic to be implemented by subclasses
   */
  protected abstract executeTask(): Promise<TaskResult>;

  /**
   * Task-specific cancellation logic to be implemented by subclasses
   */
  protected abstract cancelTask(): Promise<void>;

  /**
   * Task-specific cleanup logic to be implemented by subclasses
   */
  protected abstract cleanupTask(): Promise<void>;
}
