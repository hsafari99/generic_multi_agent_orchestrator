import { AgentState, AgentStatus, HealthStatus } from './types';
import { EventEmitter } from 'events';
import { Logger } from '../logging/logger';

/**
 * Events emitted by the AgentStateManager
 */
export enum StateEventType {
  STATE_CHANGED = 'state_changed',
  HEALTH_CHANGED = 'health_changed',
  RESOURCE_UPDATED = 'resource_updated',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  ERROR_OCCURRED = 'error_occurred',
}

/**
 * Manages the state of an agent, including state transitions, validation, and event handling
 */
export class AgentStateManager extends EventEmitter {
  private state: AgentState;
  private logger: Logger;

  constructor(initialState: Partial<AgentState> = {}) {
    super();
    this.logger = Logger.getInstance();
    this.state = this.initializeState(initialState);
  }

  /**
   * Initialize the agent state with default values
   */
  private initializeState(initialState: Partial<AgentState>): AgentState {
    const now = new Date();
    return {
      status: initialState.status || AgentStatus.INITIALIZING,
      health: {
        status: initialState.health?.status || HealthStatus.HEALTHY,
        lastCheck: initialState.health?.lastCheck || now,
        metrics: {
          cpu: initialState.health?.metrics?.cpu || 0,
          memory: initialState.health?.metrics?.memory || 0,
          responseTime: initialState.health?.metrics?.responseTime || 0,
          errorRate: initialState.health?.metrics?.errorRate || 0,
        },
      },
      activeOperations: initialState.activeOperations || 0,
      currentTask: initialState.currentTask,
      lastError: initialState.lastError,
      lastStatusChange: initialState.lastStatusChange || now,
      lastHealthCheck: initialState.lastHealthCheck || now,
      resources: {
        cpu: initialState.resources?.cpu || 0,
        memory: initialState.resources?.memory || 0,
        network: {
          bytesIn: initialState.resources?.network?.bytesIn || 0,
          bytesOut: initialState.resources?.network?.bytesOut || 0,
        },
      },
      capabilities: initialState.capabilities || [],
      load: initialState.load || 0,
      priority: initialState.priority,
      isAvailable: initialState.isAvailable ?? true,
    };
  }

  /**
   * Get the current state
   */
  public getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Update the agent state
   */
  public updateState(newState: Partial<AgentState>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };

    // Validate the new state
    this.validateState(this.state);

    // Emit appropriate events based on changes
    this.emitStateEvents(oldState, this.state);

    this.logger.debug('Agent state updated', {
      oldState,
      newState: this.state,
    });
  }

  /**
   * Validate the agent state
   */
  private validateState(state: AgentState): void {
    // Validate load is between 0 and 100
    if (state.load < 0 || state.load > 100) {
      throw new Error(`Invalid load value: ${state.load}. Must be between 0 and 100.`);
    }

    // Validate resource metrics are non-negative
    if (
      state.resources.cpu < 0 ||
      state.resources.memory < 0 ||
      state.resources.network.bytesIn < 0 ||
      state.resources.network.bytesOut < 0
    ) {
      throw new Error('Resource metrics cannot be negative');
    }

    // Validate health metrics are non-negative
    if (
      state.health.metrics.cpu < 0 ||
      state.health.metrics.memory < 0 ||
      state.health.metrics.responseTime < 0 ||
      state.health.metrics.errorRate < 0
    ) {
      throw new Error('Health metrics cannot be negative');
    }

    // Validate active operations is non-negative
    if (state.activeOperations < 0) {
      throw new Error('Active operations cannot be negative');
    }
  }

  /**
   * Emit appropriate events based on state changes
   */
  private emitStateEvents(oldState: AgentState, newState: AgentState): void {
    // Emit state changed event
    this.emit(StateEventType.STATE_CHANGED, {
      oldState,
      newState,
    });

    // Check for health status changes
    if (oldState.health.status !== newState.health.status) {
      this.emit(StateEventType.HEALTH_CHANGED, {
        oldStatus: oldState.health.status,
        newStatus: newState.health.status,
        metrics: newState.health.metrics,
      });
    }

    // Check for resource updates
    if (
      oldState.resources.cpu !== newState.resources.cpu ||
      oldState.resources.memory !== newState.resources.memory ||
      oldState.resources.network.bytesIn !== newState.resources.network.bytesIn ||
      oldState.resources.network.bytesOut !== newState.resources.network.bytesOut
    ) {
      this.emit(StateEventType.RESOURCE_UPDATED, {
        oldResources: oldState.resources,
        newResources: newState.resources,
      });
    }

    // Check for task changes
    if (oldState.currentTask !== newState.currentTask) {
      if (newState.currentTask) {
        this.emit(StateEventType.TASK_ASSIGNED, {
          taskId: newState.currentTask,
        });
      } else {
        this.emit(StateEventType.TASK_COMPLETED, {
          taskId: oldState.currentTask,
        });
      }
    }

    // Check for error changes
    if (oldState.lastError !== newState.lastError && newState.lastError) {
      this.emit(StateEventType.ERROR_OCCURRED, {
        error: newState.lastError,
      });
    }
  }

  /**
   * Update the agent's health status
   */
  public updateHealth(health: Partial<AgentState['health']>): void {
    this.updateState({
      health: {
        ...this.state.health,
        ...health,
        lastCheck: new Date(),
      },
    });
  }

  /**
   * Update the agent's resource usage
   */
  public updateResources(resources: Partial<AgentState['resources']>): void {
    this.updateState({
      resources: {
        ...this.state.resources,
        ...resources,
      },
    });
  }

  /**
   * Assign a task to the agent
   */
  public assignTask(taskId: string): void {
    if (this.state.currentTask) {
      throw new Error('Agent already has an assigned task');
    }
    if (!this.state.isAvailable) {
      throw new Error('Agent is not available for new tasks');
    }
    this.updateState({
      currentTask: taskId,
      status: AgentStatus.BUSY,
      activeOperations: this.state.activeOperations + 1,
    });
  }

  /**
   * Complete the current task
   */
  public completeTask(): void {
    if (!this.state.currentTask) {
      throw new Error('No task is currently assigned');
    }
    this.updateState({
      currentTask: undefined,
      status: AgentStatus.READY,
      activeOperations: Math.max(0, this.state.activeOperations - 1),
    });
  }

  /**
   * Update the agent's capabilities
   */
  public updateCapabilities(capabilities: string[]): void {
    this.updateState({
      capabilities,
    });
  }

  /**
   * Set the agent's priority
   */
  public setPriority(priority: AgentState['priority']): void {
    this.updateState({
      priority,
    });
  }

  /**
   * Set the agent's availability
   */
  public setAvailability(isAvailable: boolean): void {
    this.updateState({
      isAvailable,
    });
  }
}
