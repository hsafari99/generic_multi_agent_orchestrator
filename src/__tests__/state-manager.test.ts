import { AgentStateManager, StateEventType } from '../core/agent/state-manager';
import { AgentStatus, HealthStatus } from '../core/agent/types';

describe('AgentStateManager', () => {
  let stateManager: AgentStateManager;

  beforeEach(() => {
    stateManager = new AgentStateManager();
  });

  describe('State Initialization', () => {
    it('should initialize with default values', () => {
      const state = stateManager.getState();
      expect(state.status).toBe(AgentStatus.INITIALIZING);
      expect(state.health.status).toBe(HealthStatus.HEALTHY);
      expect(state.activeOperations).toBe(0);
      expect(state.isAvailable).toBe(true);
    });

    it('should initialize with provided values', () => {
      const initialState = {
        status: AgentStatus.READY,
        health: {
          status: HealthStatus.DEGRADED,
          lastCheck: new Date(),
          metrics: {
            cpu: 50,
            memory: 60,
            responseTime: 100,
            errorRate: 5,
          },
        },
        activeOperations: 2,
      };
      stateManager = new AgentStateManager(initialState);
      const state = stateManager.getState();
      expect(state.status).toBe(AgentStatus.READY);
      expect(state.health.status).toBe(HealthStatus.DEGRADED);
      expect(state.health.metrics.cpu).toBe(50);
      expect(state.activeOperations).toBe(2);
    });
  });

  describe('State Updates', () => {
    it('should update state correctly', () => {
      const newState = {
        status: AgentStatus.READY,
        load: 50,
      };
      stateManager.updateState(newState);
      const state = stateManager.getState();
      expect(state.status).toBe(AgentStatus.READY);
      expect(state.load).toBe(50);
    });

    it('should emit state changed event on update', done => {
      stateManager.on(StateEventType.STATE_CHANGED, data => {
        expect(data.oldState.status).toBe(AgentStatus.INITIALIZING);
        expect(data.newState.status).toBe(AgentStatus.READY);
        done();
      });
      stateManager.updateState({ status: AgentStatus.READY });
    });
  });

  describe('State Validation', () => {
    it('should validate load is between 0 and 100', () => {
      expect(() => stateManager.updateState({ load: -1 })).toThrow('Invalid load value');
      expect(() => stateManager.updateState({ load: 101 })).toThrow('Invalid load value');
      expect(() => stateManager.updateState({ load: 50 })).not.toThrow();
    });

    it('should validate resource metrics are non-negative', () => {
      expect(() =>
        stateManager.updateState({
          resources: { cpu: -1, memory: 0, network: { bytesIn: 0, bytesOut: 0 } },
        })
      ).toThrow('Resource metrics cannot be negative');
    });

    it('should validate health metrics are non-negative', () => {
      expect(() =>
        stateManager.updateState({
          health: {
            status: HealthStatus.HEALTHY,
            lastCheck: new Date(),
            metrics: { cpu: -1, memory: 0, responseTime: 0, errorRate: 0 },
          },
        })
      ).toThrow('Health metrics cannot be negative');
    });

    it('should validate active operations is non-negative', () => {
      expect(() => stateManager.updateState({ activeOperations: -1 })).toThrow(
        'Active operations cannot be negative'
      );
    });
  });

  describe('State Transitions', () => {
    it('should handle task assignment', () => {
      stateManager.assignTask('task-1');
      const state = stateManager.getState();
      expect(state.currentTask).toBe('task-1');
      expect(state.status).toBe(AgentStatus.BUSY);
      expect(state.activeOperations).toBe(1);
    });

    it('should handle task completion', () => {
      stateManager.assignTask('task-1');
      stateManager.completeTask();
      const state = stateManager.getState();
      expect(state.currentTask).toBeUndefined();
      expect(state.status).toBe(AgentStatus.READY);
      expect(state.activeOperations).toBe(0);
    });

    it('should prevent assigning task when already busy', () => {
      stateManager.assignTask('task-1');
      expect(() => stateManager.assignTask('task-2')).toThrow('Agent already has an assigned task');
    });

    it('should prevent completing task when none assigned', () => {
      expect(() => stateManager.completeTask()).toThrow('No task is currently assigned');
    });
  });

  describe('Event Handling', () => {
    it('should emit health changed event', done => {
      stateManager.on(StateEventType.HEALTH_CHANGED, data => {
        expect(data.oldStatus).toBe(HealthStatus.HEALTHY);
        expect(data.newStatus).toBe(HealthStatus.DEGRADED);
        done();
      });
      stateManager.updateHealth({ status: HealthStatus.DEGRADED });
    });

    it('should emit resource updated event', done => {
      stateManager.on(StateEventType.RESOURCE_UPDATED, data => {
        expect(data.oldResources.cpu).toBe(0);
        expect(data.newResources.cpu).toBe(50);
        done();
      });
      stateManager.updateResources({ cpu: 50 });
    });

    it('should emit task assigned event', done => {
      stateManager.on(StateEventType.TASK_ASSIGNED, data => {
        expect(data.taskId).toBe('task-1');
        done();
      });
      stateManager.assignTask('task-1');
    });

    it('should emit task completed event', done => {
      stateManager.assignTask('task-1');
      stateManager.on(StateEventType.TASK_COMPLETED, data => {
        expect(data.taskId).toBe('task-1');
        done();
      });
      stateManager.completeTask();
    });

    it('should emit error occurred event', done => {
      stateManager.on(StateEventType.ERROR_OCCURRED, data => {
        expect(data.error).toBe('Test error');
        done();
      });
      stateManager.updateState({ lastError: 'Test error' });
    });
  });

  describe('Capability Management', () => {
    it('should update capabilities correctly', () => {
      const capabilities = ['cap1', 'cap2'];
      stateManager.updateCapabilities(capabilities);
      const state = stateManager.getState();
      expect(state.capabilities).toEqual(capabilities);
    });
  });

  describe('Priority Management', () => {
    it('should update priority correctly', () => {
      stateManager.setPriority('high');
      const state = stateManager.getState();
      expect(state.priority).toBe('high');
    });
  });

  describe('Availability Management', () => {
    it('should update availability correctly', () => {
      stateManager.setAvailability(false);
      const state = stateManager.getState();
      expect(state.isAvailable).toBe(false);
    });

    it('should prevent task assignment when unavailable', () => {
      stateManager.setAvailability(false);
      expect(() => stateManager.assignTask('task-1')).toThrow(
        'Agent is not available for new tasks'
      );
    });
  });
});
