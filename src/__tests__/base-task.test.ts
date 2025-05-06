import { BaseTask } from '../core/task/base-task';
import { TaskConfig, TaskPriority, TaskResult, TaskStatus, TaskType } from '../core/task/types';

// Mock task implementation for testing
class MockTask extends BaseTask {
  constructor(config: TaskConfig) {
    super(config.id, config.type, config.priority, config);
  }

  protected async executeTask(): Promise<TaskResult> {
    console.log('MockTask: Starting executeTask');
    // Add a delay to allow cancellation to happen during execution
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('MockTask: Finished executeTask');
    return {
      success: true,
      data: 'test',
      duration: 100,
      metadata: {},
    };
  }

  protected async cancelTask() {
    console.log('MockTask: Starting cancelTask');
    // Add a small delay to ensure cancellation is processed
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log('MockTask: Finished cancelTask');
  }

  protected async cleanupTask() {
    console.log('MockTask: Starting cleanupTask');
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log('MockTask: Finished cleanupTask');
  }
}

describe('BaseTask', () => {
  let task: MockTask;
  const mockConfig: TaskConfig = {
    id: 'test-task',
    type: TaskType.COMPUTATION,
    priority: TaskPriority.MEDIUM,
    metadata: {},
  };

  beforeEach(() => {
    task = new MockTask(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(task.id).toBe(mockConfig.id);
      expect(task.type).toBe(mockConfig.type);
      expect(task.priority).toBe(mockConfig.priority);
      expect(task.status).toBe(TaskStatus.PENDING);
    });
  });

  describe('validate', () => {
    it('should validate required fields', async () => {
      const result = await task.validate();
      expect(result.valid).toBe(true);
    });

    it('should fail validation with missing ID', async () => {
      const invalidTask = new MockTask({
        ...mockConfig,
        id: '',
      });
      const result = await invalidTask.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Task ID is required');
    });

    it('should validate dependencies', async () => {
      const taskWithDeps = new MockTask({
        ...mockConfig,
        dependencies: [
          { taskId: 'dep1', type: 'required' },
          { taskId: 'dep2', type: 'optional' },
        ],
      });
      const result = await taskWithDeps.validate();
      expect(result.valid).toBe(true);
    });

    it('should validate resources', async () => {
      const taskWithResources = new MockTask({
        ...mockConfig,
        resources: {
          cpu: 1,
          memory: 1024,
          storage: 100,
          network: {
            bandwidth: 1000,
            latency: 50,
          },
        },
      });
      const result = await taskWithResources.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute task successfully', async () => {
      const result = await task.execute();
      expect(result.success).toBe(true);
      expect(result.data).toBe('test');
      expect(task.status).toBe(TaskStatus.COMPLETED);
      expect(task.startTime).toBeDefined();
      expect(task.endTime).toBeDefined();
      expect(task.duration).toBeDefined();
    });

    it('should handle execution errors', async () => {
      jest.spyOn(task as any, 'executeTask').mockRejectedValueOnce(new Error('Test error'));
      await expect(task.execute()).rejects.toThrow('Test error');
      expect(task.status).toBe(TaskStatus.FAILED);
    });
  });

  describe('cancel', () => {
    it('should cancel running task', async () => {
      console.log('Test: Starting execution');
      // Set up error handler before execution
      const errorPromise = new Promise<Error>(resolve => {
        task.on('error', error => {
          console.log('Test: Error event received:', error.message);
          resolve(error);
        });
      });
      const executionPromise = task.execute();
      console.log('Test: Current status after starting execution:', task.status);
      // Wait a bit to ensure task is running
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('Test: Calling cancel');
      await task.cancel();
      console.log('Test: Current status after cancel:', task.status);
      console.log('Test: Waiting for error event');
      const error = await errorPromise;
      console.log('Test: Error event received with message:', error.message);
      console.log('Test: Waiting for execution to complete');
      const result = await executionPromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Task was cancelled during execution');
      console.log('Test: Final status:', task.status);
      expect(task.status).toBe(TaskStatus.FAILED);
    });
  });

  describe('cleanup', () => {
    it('should cleanup task resources', async () => {
      await task.cleanup();
      // Add assertions based on cleanup implementation
    });
  });

  describe('events', () => {
    it('should emit start event', async () => {
      const startHandler = jest.fn();
      task.on('start', startHandler);
      await task.execute();
      expect(startHandler).toHaveBeenCalled();
    });

    it('should emit complete event', async () => {
      const completeHandler = jest.fn();
      task.on('complete', completeHandler);
      await task.execute();
      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: 'test',
        })
      );
    });
  });
});
