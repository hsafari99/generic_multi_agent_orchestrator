import { TaskRegistry } from '../core/task/task-registry';
import { TaskType, TaskPriority, TaskStatus } from '../core/task/types';
import { ComputationTask } from '../core/task/computation-task';
import { CommunicationTask } from '../core/task/communication-task';

describe('TaskRegistry', () => {
  let registry: TaskRegistry;

  beforeEach(() => {
    registry = TaskRegistry.getInstance();
    registry.clearTasks();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = TaskRegistry.getInstance();
      const instance2 = TaskRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('registerTask', () => {
    it('should register a task', () => {
      const task = new ComputationTask({
        id: 'test-task',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      registry.registerTask(task);
      expect(registry.hasTask('test-task')).toBe(true);
    });

    it('should throw error when registering duplicate task', () => {
      const task = new ComputationTask({
        id: 'test-task',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      registry.registerTask(task);
      expect(() => registry.registerTask(task)).toThrow('Task with ID test-task already exists');
    });
  });

  describe('getTask', () => {
    it('should return registered task', () => {
      const task = new ComputationTask({
        id: 'test-task',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      registry.registerTask(task);
      const retrievedTask = registry.getTask('test-task');
      expect(retrievedTask).toBe(task);
    });

    it('should return undefined for non-existent task', () => {
      expect(registry.getTask('non-existent')).toBeUndefined();
    });
  });

  describe('getTasksByType', () => {
    it('should return tasks of specific type', () => {
      const computationTask = new ComputationTask({
        id: 'test-computation',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      const communicationTask = new CommunicationTask({
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
      registry.registerTask(computationTask);
      registry.registerTask(communicationTask);

      const computationTasks = registry.getTasksByType(TaskType.COMPUTATION);
      expect(computationTasks).toHaveLength(1);
      expect(computationTasks[0]).toBe(computationTask);
    });
  });

  describe('getAllTasks', () => {
    it('should return all registered tasks', () => {
      const task1 = new ComputationTask({
        id: 'test-1',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      const task2 = new CommunicationTask({
        id: 'test-2',
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
      registry.registerTask(task1);
      registry.registerTask(task2);

      const allTasks = registry.getAllTasks();
      expect(allTasks).toHaveLength(2);
      expect(allTasks).toContain(task1);
      expect(allTasks).toContain(task2);
    });
  });

  describe('removeTask', () => {
    it('should remove registered task', () => {
      const task = new ComputationTask({
        id: 'test-task',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      registry.registerTask(task);
      expect(registry.removeTask('test-task')).toBe(true);
      expect(registry.hasTask('test-task')).toBe(false);
    });

    it('should return false for non-existent task', () => {
      expect(registry.removeTask('non-existent')).toBe(false);
    });
  });

  describe('clearTasks', () => {
    it('should remove all tasks', () => {
      const task1 = new ComputationTask({
        id: 'test-1',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      const task2 = new CommunicationTask({
        id: 'test-2',
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
      registry.registerTask(task1);
      registry.registerTask(task2);

      registry.clearTasks();
      expect(registry.getTaskCount()).toBe(0);
    });
  });

  describe('getTaskCount', () => {
    it('should return correct number of tasks', () => {
      expect(registry.getTaskCount()).toBe(0);
      const task = new ComputationTask({
        id: 'test-task',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      registry.registerTask(task);
      expect(registry.getTaskCount()).toBe(1);
    });
  });

  describe('getTasksByStatus', () => {
    it('should return tasks with specific status', async () => {
      const task = new ComputationTask({
        id: 'test-task',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.MEDIUM,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      registry.registerTask(task);
      await task.execute();

      const completedTasks = registry.getTasksByStatus(TaskStatus.COMPLETED);
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0]).toBe(task);
    });
  });

  describe('getTasksByPriority', () => {
    it('should return tasks with specific priority', () => {
      const task = new ComputationTask({
        id: 'test-task',
        type: TaskType.COMPUTATION,
        priority: TaskPriority.HIGH,
        metadata: {
          operation: 'add',
          input: [1, 2],
        },
      });
      registry.registerTask(task);

      const highPriorityTasks = registry.getTasksByPriority(TaskPriority.HIGH);
      expect(highPriorityTasks).toHaveLength(1);
      expect(highPriorityTasks[0]).toBe(task);
    });
  });
});
