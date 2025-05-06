import { StorageTask, StorageTaskConfig } from '../core/task/storage-task';
import { TaskPriority, TaskStatus, TaskType } from '../core/task/types';

describe('StorageTask', () => {
  const mockConfig: StorageTaskConfig = {
    id: 'test-storage',
    type: TaskType.STORAGE,
    priority: TaskPriority.MEDIUM,
    metadata: {
      operation: 'write',
      data: { test: 'data' },
      path: '/test/path',
      options: {
        timeout: 1000,
        retries: 3,
        compression: true,
        encryption: true,
      },
    },
  };

  let task: StorageTask;

  beforeEach(() => {
    task = new StorageTask(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(task.id).toBe(mockConfig.id);
      expect(task.type).toBe(TaskType.STORAGE);
      expect(task.priority).toBe(mockConfig.priority);
      expect(task.status).toBe(TaskStatus.PENDING);
    });
  });

  describe('execute', () => {
    it('should execute write operation successfully', async () => {
      const result = await task.execute();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ status: 'written' });
      expect(task.status).toBe(TaskStatus.COMPLETED);
    });

    it('should execute read operation successfully', async () => {
      const readTask = new StorageTask({
        ...mockConfig,
        metadata: {
          ...mockConfig.metadata,
          operation: 'read',
        },
      });
      const result = await readTask.execute();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ status: 'read' });
    });

    it('should execute delete operation successfully', async () => {
      const deleteTask = new StorageTask({
        ...mockConfig,
        metadata: {
          ...mockConfig.metadata,
          operation: 'delete',
        },
      });
      const result = await deleteTask.execute();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ status: 'deleted' });
    });

    it('should include metadata in result', async () => {
      const result = await task.execute();
      expect(result.metadata).toEqual({
        operation: 'write',
        path: '/test/path',
        options: mockConfig.metadata.options,
      });
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
          data: { status: 'written' },
        })
      );
    });
  });
});
