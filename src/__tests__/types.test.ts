import {
  AgentStatus,
  AgentCapabilities,
  AgentState,
  AgentConfig,
  IAgent,
  HealthStatus,
} from '../core/agent/types';

describe('Agent Types', () => {
  describe('AgentStatus', () => {
    it('should have all required status values', () => {
      expect(AgentStatus.INITIALIZING).toBe('initializing');
      expect(AgentStatus.READY).toBe('ready');
      expect(AgentStatus.BUSY).toBe('busy');
      expect(AgentStatus.ERROR).toBe('error');
      expect(AgentStatus.SHUTDOWN).toBe('shutdown');
    });
  });

  describe('AgentCapabilities', () => {
    it('should have all required properties', () => {
      const capabilities: AgentCapabilities = {
        tools: ['tool1', 'tool2'],
        protocols: ['protocol1'],
        maxConcurrency: 5,
        supportsLongRunningTasks: true,
      };

      expect(capabilities.tools).toBeDefined();
      expect(capabilities.protocols).toBeDefined();
      expect(capabilities.maxConcurrency).toBeDefined();
      expect(capabilities.supportsLongRunningTasks).toBeDefined();
    });
  });

  describe('AgentState', () => {
    it('should have all required properties', () => {
      const state: AgentState = {
        status: AgentStatus.READY,
        health: {
          status: HealthStatus.HEALTHY,
          lastCheck: new Date(),
          metrics: {
            cpu: 0,
            memory: 0,
            responseTime: 0,
            errorRate: 0,
          },
        },
        activeOperations: 0,
        lastStatusChange: new Date(),
        lastHealthCheck: new Date(),
        resources: {
          cpu: 0,
          memory: 0,
          network: {
            bytesIn: 0,
            bytesOut: 0,
          },
        },
        capabilities: [],
        load: 0,
        isAvailable: true,
      };

      expect(state.status).toBeDefined();
      expect(state.health).toBeDefined();
      expect(state.activeOperations).toBeDefined();
      expect(state.lastStatusChange).toBeDefined();
      expect(state.lastHealthCheck).toBeDefined();
      expect(state.resources).toBeDefined();
      expect(state.capabilities).toBeDefined();
      expect(state.load).toBeDefined();
      expect(state.isAvailable).toBeDefined();
    });

    it('should allow optional lastError property', () => {
      const state: AgentState = {
        status: AgentStatus.ERROR,
        health: {
          status: HealthStatus.HEALTHY,
          lastCheck: new Date(),
          metrics: {
            cpu: 0,
            memory: 0,
            responseTime: 0,
            errorRate: 0,
          },
        },
        activeOperations: 0,
        lastStatusChange: new Date(),
        lastHealthCheck: new Date(),
        lastError: 'Test error',
        resources: {
          cpu: 0,
          memory: 0,
          network: {
            bytesIn: 0,
            bytesOut: 0,
          },
        },
        capabilities: [],
        load: 0,
        isAvailable: true,
      };

      expect(state.lastError).toBe('Test error');
    });
  });

  describe('AgentConfig', () => {
    it('should have all required properties', () => {
      const config: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'Test agent description',
        capabilities: {
          tools: [],
          protocols: [],
          maxConcurrency: 1,
          supportsLongRunningTasks: false,
        },
        maxRetries: 3,
        operationTimeout: 5000,
        healthCheckInterval: 30000,
      };

      expect(config.id).toBeDefined();
      expect(config.name).toBeDefined();
      expect(config.description).toBeDefined();
      expect(config.capabilities).toBeDefined();
      expect(config.maxRetries).toBeDefined();
      expect(config.operationTimeout).toBeDefined();
      expect(config.healthCheckInterval).toBeDefined();
    });
  });

  describe('IAgent', () => {
    it('should define all required methods', () => {
      const mockAgent: IAgent = {
        getConfig: jest.fn(),
        getState: jest.fn(),
        initialize: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        shutdown: jest.fn(),
        checkHealth: jest.fn(),
        updateCapabilities: jest.fn(),
        register: jest.fn(),
        deregister: jest.fn(),
      };

      expect(mockAgent.getConfig).toBeDefined();
      expect(mockAgent.getState).toBeDefined();
      expect(mockAgent.initialize).toBeDefined();
      expect(mockAgent.start).toBeDefined();
      expect(mockAgent.stop).toBeDefined();
      expect(mockAgent.shutdown).toBeDefined();
      expect(mockAgent.checkHealth).toBeDefined();
      expect(mockAgent.updateCapabilities).toBeDefined();
      expect(mockAgent.register).toBeDefined();
      expect(mockAgent.deregister).toBeDefined();
    });
  });
});
