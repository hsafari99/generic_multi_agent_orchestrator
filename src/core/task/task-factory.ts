import { Task, TaskConfig, TaskType } from './types';
import { ComputationTask, ComputationTaskConfig } from './computation-task';
import { CommunicationTask, CommunicationTaskConfig } from './communication-task';
import { StorageTask, StorageTaskConfig } from './storage-task';

/**
 * Task factory for creating task instances
 */
export class TaskFactory {
  /**
   * Create a new task instance based on the provided configuration
   */
  static createTask(config: TaskConfig): Task {
    switch (config.type) {
      case TaskType.COMPUTATION:
        return new ComputationTask(config as ComputationTaskConfig);
      case TaskType.COMMUNICATION:
        return new CommunicationTask(config as CommunicationTaskConfig);
      case TaskType.STORAGE:
        return new StorageTask(config as StorageTaskConfig);
      default:
        throw new Error(`Unknown task type: ${config.type}`);
    }
  }

  /**
   * Create a computation task
   */
  static createComputationTask(config: Omit<ComputationTaskConfig, 'type'>): Task {
    return this.createTask({
      ...config,
      type: TaskType.COMPUTATION,
    });
  }

  /**
   * Create a communication task
   */
  static createCommunicationTask(config: Omit<CommunicationTaskConfig, 'type'>): Task {
    return this.createTask({
      ...config,
      type: TaskType.COMMUNICATION,
    });
  }

  /**
   * Create a storage task
   */
  static createStorageTask(config: Omit<StorageTaskConfig, 'type'>): Task {
    return this.createTask({
      ...config,
      type: TaskType.STORAGE,
    });
  }
}
