import { Task, TaskType, TaskPriority } from './types';

/**
 * Task registry for managing task instances
 */
export class TaskRegistry {
  private static instance: TaskRegistry;
  private tasks: Map<string, Task>;

  private constructor() {
    this.tasks = new Map();
  }

  /**
   * Get the singleton instance of the task registry
   */
  static getInstance(): TaskRegistry {
    if (!TaskRegistry.instance) {
      TaskRegistry.instance = new TaskRegistry();
    }
    return TaskRegistry.instance;
  }

  /**
   * Register a task in the registry
   */
  registerTask(task: Task): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task with ID ${task.id} already exists`);
    }
    this.tasks.set(task.id, task);
  }

  /**
   * Get a task by its ID
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks of a specific type
   */
  getTasksByType(type: TaskType): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.type === type);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Remove a task from the registry
   */
  removeTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  /**
   * Clear all tasks from the registry
   */
  clearTasks(): void {
    this.tasks.clear();
  }

  /**
   * Get the number of tasks in the registry
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Check if a task exists in the registry
   */
  hasTask(id: string): boolean {
    return this.tasks.has(id);
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: string): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get tasks by priority
   */
  getTasksByPriority(priority: TaskPriority): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.priority === priority);
  }
}
