import { ComputationTask, ComputationTaskConfig } from '../core/task/computation-task';
import { TaskPriority, TaskStatus, TaskType } from '../core/task/types';

describe('ComputationTask', () => {
  const mockConfig: ComputationTaskConfig = {
    id: 'test-computation',
    type: TaskType.COMPUTATION,
    priority: TaskPriority.MEDIUM,
    metadata: {
      operation: 'add',
      input: { a: 5, b: 3 },
      options: {
        timeout: 1000,
        retries: 3,
        maxIterations: 10,
      },
    },
  };

  let task: ComputationTask;

  beforeEach(() => {
    task = new ComputationTask(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(task.id).toBe(mockConfig.id);
      expect(task.type).toBe(TaskType.COMPUTATION);
      expect(task.priority).toBe(mockConfig.priority);
      expect(task.status).toBe(TaskStatus.PENDING);
    });
  });

  describe('execute', () => {
    it('should execute add operation successfully', async () => {
      const result = await task.execute();
      expect(result.success).toBe(true);
      expect(result.data).toBe(8); // 5 + 3
      expect(task.status).toBe(TaskStatus.COMPLETED);
    });

    it('should execute multiply operation successfully', async () => {
      const multiplyTask = new ComputationTask({
        ...mockConfig,
        metadata: {
          ...mockConfig.metadata,
          operation: 'multiply',
        },
      });
      const result = await multiplyTask.execute();
      expect(result.success).toBe(true);
      expect(result.data).toBe(15); // 5 * 3
    });

    it('should execute divide operation successfully', async () => {
      const divideTask = new ComputationTask({
        ...mockConfig,
        metadata: {
          ...mockConfig.metadata,
          operation: 'divide',
        },
      });
      const result = await divideTask.execute();
      expect(result.success).toBe(true);
      expect(result.data).toBe(5 / 3);
    });

    it('should handle division by zero', async () => {
      const divideTask = new ComputationTask({
        ...mockConfig,
        metadata: {
          ...mockConfig.metadata,
          operation: 'divide',
          input: { a: 5, b: 0 },
        },
      });

      // Add error handler before executing
      const errorHandler = jest.fn();
      divideTask.on('error', errorHandler);

      const result = await divideTask.execute();
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Division by zero');
      expect(errorHandler).toHaveBeenCalledWith(result.error);
    });

    it('should handle unknown operation', async () => {
      const unknownTask = new ComputationTask({
        ...mockConfig,
        metadata: {
          ...mockConfig.metadata,
          operation: 'unknown',
        },
      });

      // Add error handler before executing
      const errorHandler = jest.fn();
      unknownTask.on('error', errorHandler);

      const result = await unknownTask.execute();
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Unknown computation operation');
      expect(errorHandler).toHaveBeenCalledWith(result.error);
    });
  });

  describe('cancel', () => {
    it('should cancel task execution', async () => {
      // Start task execution
      const executePromise = task.execute();

      // Wait a bit to ensure task is running
      await new Promise(resolve => setTimeout(resolve, 50));

      // Add error handler
      task.on('error', error => {
        console.log('Error event received:', error.message);
      });

      // Cancel the task
      await task.cancel();

      // Wait for execution to complete
      const result = await executePromise;
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Task was cancelled during execution');
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
          data: 8,
        })
      );
    });

    it('should emit error event on failure', async () => {
      const divideTask = new ComputationTask({
        id: 'test-computation',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'divide',
          input: { a: 10, b: 0 },
        },
      });

      const errorHandler = jest.fn();
      divideTask.on('error', errorHandler);

      const result = await divideTask.execute();
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Division by zero');
      expect(errorHandler).toHaveBeenCalledWith(result.error);
    });
  });
});
