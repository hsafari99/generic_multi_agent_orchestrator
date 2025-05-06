import { BaseTask } from './base-task';
import { TaskConfig, TaskResult, TaskType } from './types';

/**
 * Configuration for computation tasks
 */
export interface ComputationTaskConfig extends TaskConfig {
  type: TaskType.COMPUTATION;
  metadata: {
    operation: string;
    input: any;
    options?: {
      timeout?: number;
      retries?: number;
      maxIterations?: number;
    };
  };
}

/**
 * Computation task implementation
 */
export class ComputationTask extends BaseTask {
  constructor(config: ComputationTaskConfig) {
    super(config.id, config.type, config.priority, config);
  }

  /**
   * Execute the computation task
   */
  protected async executeTask(): Promise<TaskResult> {
    const startTime = Date.now();
    try {
      const metadata = this.config.metadata as ComputationTaskConfig['metadata'];

      // Check if task was cancelled before starting computation
      if (this._isCancelled) {
        return {
          success: false,
          error: new Error('Task was cancelled before execution'),
          duration: Date.now() - startTime,
          metadata: {
            operation: metadata.operation,
            options: metadata.options,
          },
        };
      }

      const result = await this.executeComputation(metadata.operation, metadata.input);

      // Check if task was cancelled during computation
      if (this._isCancelled) {
        return {
          success: false,
          error: new Error('Task was cancelled during execution'),
          duration: Date.now() - startTime,
          metadata: {
            operation: metadata.operation,
            options: metadata.options,
          },
        };
      }

      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
        metadata: {
          operation: metadata.operation,
          options: metadata.options,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Computation error', { error: errorObj.message });
      return {
        success: false,
        error: errorObj,
        duration,
        metadata: {
          operation: (this.config.metadata as ComputationTaskConfig['metadata']).operation,
        },
      };
    }
  }

  /**
   * Cancel the computation task
   */
  protected async cancelTask(): Promise<void> {
    this.logger.info('Computation task cancelled');
  }

  /**
   * Clean up computation task resources
   */
  protected async cleanupTask(): Promise<void> {
    // Implement task-specific cleanup logic
    this.logger.info('Computation task cleaned up');
  }

  /**
   * Execute the computation operation
   */
  private async executeComputation(operation: string, input: any): Promise<number> {
    this.logger.debug('Starting computation execution', { operation, input });

    // Add a delay to simulate computation time
    await new Promise(resolve => setTimeout(resolve, 100));

    switch (operation) {
      case 'add':
        this.logger.debug('Executing add operation');
        return input.a + input.b;
      case 'multiply':
        this.logger.debug('Executing multiply operation');
        return input.a * input.b;
      case 'divide':
        this.logger.debug('Executing divide operation', { input });
        if (input.b === 0) {
          this.logger.error('Division by zero error', { input });
          throw new Error('Division by zero');
        }
        return input.a / input.b;
      default:
        this.logger.error('Unknown operation error', { operation });
        throw new Error(`Unknown computation operation: ${operation}`);
    }
  }
}
