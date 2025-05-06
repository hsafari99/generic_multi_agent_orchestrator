import { TaskFactory } from '../core/task/task-factory';
import { ComputationTask } from '../core/task/computation-task';
import { CommunicationTask } from '../core/task/communication-task';
import { StorageTask } from '../core/task/storage-task';
import { TaskType, TaskPriority } from '../core/task/types';

describe('TaskFactory', () => {
  describe('createTask', () => {
    it('should create computation task', () => {
      const task = TaskFactory.createTask({
        id: 'test-computation',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      expect(task).toBeInstanceOf(ComputationTask);
      expect(task.id).toBe('test-computation');
      expect(task.type).toBe(TaskType.COMPUTATION);
    });

    it('should create communication task', () => {
      const task = TaskFactory.createTask({
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
        },
      });
      expect(task).toBeInstanceOf(CommunicationTask);
      expect(task.id).toBe('test-communication');
      expect(task.type).toBe(TaskType.COMMUNICATION);
    });

    it('should create storage task', () => {
      const task = TaskFactory.createTask({
        id: 'test-storage',
        type: TaskType.STORAGE,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'write',
          data: { test: 'data' },
          path: '/test/path',
        },
      });
      expect(task).toBeInstanceOf(StorageTask);
      expect(task.id).toBe('test-storage');
      expect(task.type).toBe(TaskType.STORAGE);
    });

    it('should throw error for unknown task type', () => {
      expect(() => {
        TaskFactory.createTask({
          id: 'test-unknown',
          type: 'UNKNOWN' as TaskType,
          priority: TaskPriority.MEDIUM,
          metadata: {},
        });
      }).toThrow('Unknown task type: UNKNOWN');
    });
  });

  describe('createComputationTask', () => {
    it('should create computation task with correct type', () => {
      const task = TaskFactory.createComputationTask({
        id: 'test-computation',
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      expect(task).toBeInstanceOf(ComputationTask);
      expect(task.type).toBe(TaskType.COMPUTATION);
    });
  });

  describe('createCommunicationTask', () => {
    it('should create communication task with correct type', () => {
      const task = TaskFactory.createCommunicationTask({
        id: 'test-communication',
        priority: TaskPriority.MEDIUM,
        metadata: {
          protocol: 'A2A',
          message: {
            type: 'test-message',
            content: { data: 'test' },
            target: 'test-target',
            broadcast: false,
          },
        },
      });
      expect(task).toBeInstanceOf(CommunicationTask);
      expect(task.type).toBe(TaskType.COMMUNICATION);
    });
  });

  describe('createStorageTask', () => {
    it('should create storage task with correct type', () => {
      const task = TaskFactory.createStorageTask({
        id: 'test-storage',
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'write',
          data: { test: 'data' },
          path: '/test/path',
        },
      });
      expect(task).toBeInstanceOf(StorageTask);
      expect(task.type).toBe(TaskType.STORAGE);
    });
  });
});
