import { CommunicationTask, CommunicationTaskConfig } from '../core/task/communication-task';
import { TaskPriority, TaskStatus, TaskType } from '../core/task/types';

describe('CommunicationTask', () => {
  const mockConfig: CommunicationTaskConfig = {
    id: 'test-communication',
    type: TaskType.COMMUNICATION,
    priority: TaskPriority.MEDIUM,
    metadata: {
      protocol: 'A2A',
      message: {
        type: 'test-message',
        content: { data: 'test' },
        target: 'test-target',
        broadcast: false,
      },
      options: {
        timeout: 10000,
        retries: 3,
        encryption: true,
        compression: true,
      },
    },
  };

  let task: CommunicationTask;

  beforeEach(() => {
    task = new CommunicationTask(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(task.id).toBe(mockConfig.id);
      expect(task.type).toBe(TaskType.COMMUNICATION);
      expect(task.priority).toBe(mockConfig.priority);
      expect(task.status).toBe(TaskStatus.PENDING);
    });
  });

  describe('execute', () => {
    it('should execute A2A protocol successfully', async () => {
      const result = await task.execute();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ status: 'sent' });
      expect(task.status).toBe(TaskStatus.COMPLETED);
    });

    it('should execute MCP protocol successfully', async () => {
      const mcpTask = new CommunicationTask({
        ...mockConfig,
        metadata: {
          ...mockConfig.metadata,
          protocol: 'MCP',
        },
      });
      const result = await mcpTask.execute();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ status: 'sent' });
    });

    it('should handle unknown protocol', async () => {
      const unknownTask = new CommunicationTask({
        ...mockConfig,
        metadata: {
          ...mockConfig.metadata,
          protocol: 'UNKNOWN' as any,
        },
      });

      // Set up error handler before executing
      const errorHandler = jest.fn();
      unknownTask.on('error', errorHandler);

      console.log('Starting unknown protocol test...');
      const result = await unknownTask.execute();
      console.log('Unknown protocol test result:', result);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Unknown communication protocol: UNKNOWN');
      expect(unknownTask.status).toBe(TaskStatus.FAILED);
      expect(errorHandler).toHaveBeenCalledWith(result.error);
    });

    it('should include metadata in result', async () => {
      const result = await task.execute();
      expect(result.metadata).toEqual({
        protocol: 'A2A',
        messageType: 'test-message',
        options: mockConfig.metadata.options,
      });
    });
  });

  describe('cancel', () => {
    it('should cancel task execution', async () => {
      // Set up error handler before starting execution
      const errorHandler = jest.fn();
      task.on('error', errorHandler);

      // Start task execution
      const executePromise = task.execute();
      // Wait a bit to ensure task is running
      await new Promise(resolve => setTimeout(resolve, 50));
      // Cancel the task
      await task.cancel();
      // Wait for execution to complete
      await executePromise;
      expect(task.status).toBe(TaskStatus.FAILED);
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
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
          data: { status: 'sent' },
        })
      );
    });

    it('should emit error event on failure', async () => {
      const unknownTask = new CommunicationTask({
        id: 'test-communication',
        type: TaskType.COMMUNICATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          protocol: 'UNKNOWN' as any,
          message: {
            type: 'test-message',
            content: { data: 'test' },
          },
        },
      });

      const errorHandler = jest.fn().mockImplementation(error => {
        console.log('Error handler called with:', error);
      });
      unknownTask.on('error', errorHandler);

      console.log('Starting task execution...');
      const result = await unknownTask.execute();
      console.log('Task execution completed:', result);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Unknown communication protocol: UNKNOWN');
      expect(errorHandler).toHaveBeenCalledWith(result.error);
    });
  });
});
