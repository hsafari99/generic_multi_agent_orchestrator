import { BaseTask } from './base-task';
import { TaskConfig, TaskResult, TaskStatus, TaskType } from './types';

/**
 * Configuration for communication tasks
 */
export interface CommunicationTaskConfig extends TaskConfig {
  type: TaskType.COMMUNICATION;
  metadata: {
    protocol: 'A2A' | 'MCP';
    message: {
      type: string;
      content: any;
      target?: string;
      broadcast?: boolean;
    };
    options?: {
      timeout?: number;
      retries?: number;
      encryption?: boolean;
      compression?: boolean;
    };
  };
}

/**
 * Communication task implementation
 */
export class CommunicationTask extends BaseTask {
  constructor(config: CommunicationTaskConfig) {
    super(config.id, config.type, config.priority, config);
  }

  /**
   * Execute the communication task
   */
  protected async executeTask(): Promise<TaskResult> {
    const startTime = Date.now();
    try {
      const metadata = this.config.metadata as CommunicationTaskConfig['metadata'];
      this.logger.debug('Executing communication task', { protocol: metadata.protocol });
      const result = await this.executeCommunication(
        metadata.protocol,
        metadata.message,
        metadata.options
      );

      // Check if the result contains an error
      if (result && !result.success && result.error) {
        this._status = TaskStatus.FAILED;
        return {
          success: false,
          error: result.error,
          duration: Date.now() - startTime,
          metadata: {
            protocol: metadata.protocol,
            messageType: metadata.message.type,
            options: metadata.options,
          },
        };
      }

      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
        metadata: {
          protocol: metadata.protocol,
          messageType: metadata.message.type,
          options: metadata.options,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Communication task failed', { error: errorObj });
      this.emit('error', errorObj);
      this._status = TaskStatus.FAILED;
      return {
        success: false,
        error: errorObj,
        duration,
        metadata: {
          protocol: (this.config.metadata as CommunicationTaskConfig['metadata']).protocol,
          messageType: (this.config.metadata as CommunicationTaskConfig['metadata']).message.type,
        },
      };
    }
  }

  /**
   * Cancel the communication task
   */
  protected async cancelTask(): Promise<void> {
    this.logger.debug('Cancelling communication task', { taskId: this.id });
    this._status = TaskStatus.FAILED;
    this._result = {
      success: false,
      error: new Error('Task cancelled'),
      duration: this._duration || 0,
      metadata: {
        protocol: (this.config.metadata as CommunicationTaskConfig['metadata']).protocol,
        messageType: (this.config.metadata as CommunicationTaskConfig['metadata']).message.type,
      },
    };
    this.emit('error', this._result.error);
    this.logger.info('Communication task cancelled', { taskId: this.id, status: this.status });
  }

  /**
   * Clean up communication task resources
   */
  protected async cleanupTask(): Promise<void> {
    // Implement task-specific cleanup logic
    this.logger.info('Communication task cleaned up');
  }

  /**
   * Execute the communication operation
   */
  private async executeCommunication(
    protocol: CommunicationTaskConfig['metadata']['protocol'],
    message: CommunicationTaskConfig['metadata']['message'],
    options?: CommunicationTaskConfig['metadata']['options']
  ): Promise<any> {
    this.logger.debug('Executing communication with protocol', { protocol });

    // Implement specific communication operations
    switch (protocol) {
      case 'A2A':
        return this.executeA2A(message, options);
      case 'MCP':
        return this.executeMCP(message, options);
      default:
        this.logger.error('Unknown protocol encountered', { protocol });
        return {
          success: false,
          error: new Error(`Unknown communication protocol: ${protocol}`),
        };
    }
  }

  /**
   * Execute A2A protocol communication
   */
  private async executeA2A(
    message: CommunicationTaskConfig['metadata']['message'],
    options?: CommunicationTaskConfig['metadata']['options']
  ): Promise<any> {
    // Simulate a longer running task
    this.logger.info('Executing A2A communication', { message, options });
    await new Promise(resolve => setTimeout(resolve, 100)); // Add delay

    // Check if task was cancelled during execution
    if (this._isCancelled) {
      this.logger.debug('A2A communication cancelled during execution');
      throw new Error('Task cancelled during execution');
    }

    return { status: 'sent' };
  }

  /**
   * Execute MCP protocol communication
   */
  private async executeMCP(
    message: CommunicationTaskConfig['metadata']['message'],
    options?: CommunicationTaskConfig['metadata']['options']
  ): Promise<any> {
    // TODO: Implement MCP protocol communication
    this.logger.info('Executing MCP communication', { message, options });
    return { status: 'sent' };
  }
}
