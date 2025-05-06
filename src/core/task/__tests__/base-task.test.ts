import { BaseTask } from '../base-task';
import { TaskType, TaskPriority, TaskStatus, TaskConfig, TaskResult } from '../types';

class TestTask extends BaseTask {
  constructor(config: TaskConfig) {
    super(config.id, config.type, config.priority, config);
  }

  async executeTask(): Promise<TaskResult> {
    console.log('TestTask: Starting executeTask');
    // Add a delay to allow cancellation to happen during execution
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('TestTask: Finished executeTask');
    return { success: true, duration: 100 };
  }

  async cancelTask(): Promise<void> {
    console.log('TestTask: Starting cancelTask');
    // Add a small delay to ensure cancellation is processed
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log('TestTask: Finished cancelTask');
  }

  async cleanupTask(): Promise<void> {
    console.log('TestTask: Starting cleanupTask');
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log('TestTask: Finished cleanupTask');
  }
}

describe('BaseTask', () => {
  it('should cancel task after execution starts', async () => {
    console.log('Test: Creating task');
    const task = new TestTask({
      id: 'test-task',
      type: TaskType.COMPUTATION,
      priority: TaskPriority.MEDIUM,
      metadata: {},
    });

    const executionPromise = task.execute();
    const cancelPromise = new Promise(resolve => setTimeout(resolve, 50)).then(() => task.cancel());

    try {
      await Promise.all([executionPromise.catch(() => {}), cancelPromise]);
    } catch (error) {
      // Expected error
    }

    expect(task.status).toBe(TaskStatus.FAILED);
  });
});
