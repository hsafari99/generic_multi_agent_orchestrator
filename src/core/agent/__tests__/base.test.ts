import { BaseAgent } from '../base';
import { AgentConfig, AgentStatus, AgentCapabilities } from '../types';
// Mock Logger
jest.mock('../../logging/logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
    }),
  },
}));

// Test agent implementation
class TestAgent extends BaseAgent {
  protected async onInitialize(): Promise<void> {
    // Test implementation
  }

  protected async onStart(): Promise<void> {
    // Test implementation
  }

  protected async onStop(): Promise<void> {
    // Test implementation
  }

  protected async onShutdown(): Promise<void> {
    // Test implementation
  }

  protected async onHealthCheck(): Promise<boolean> {
    return true;
  }

  protected async onUpdateCapabilities(_capabilities: AgentCapabilities): Promise<void> {
    // Update capabilities in test implementation
    this.config.capabilities = _capabilities;
  }

  protected async onRegister(): Promise<void> {
    // Test implementation
  }

  protected async onDeregister(): Promise<void> {
    // Test implementation
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
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
    agent = new TestAgent(config);
  });

  describe('constructor', () => {
    it('should initialize with correct state', () => {
      const state = agent.getState();
      expect(state.status).toBe(AgentStatus.INITIALIZING);
      expect(state.activeOperations).toBe(0);
      expect(state.lastStatusChange).toBeInstanceOf(Date);
      expect(state.lastHealthCheck).toBeInstanceOf(Date);
    });

    it('should store configuration', () => {
      const storedConfig = agent.getConfig();
      expect(storedConfig).toEqual(config);
    });
  });

  describe('initialize', () => {
    it('should update status to READY on successful initialization', async () => {
      await agent.initialize();
      expect(agent.getState().status).toBe(AgentStatus.READY);
    });

    it('should handle initialization errors', async () => {
      const errorAgent = new TestAgent(config);
      jest.spyOn(errorAgent as any, 'onInitialize').mockRejectedValueOnce(new Error('Init error'));

      await expect(errorAgent.initialize()).rejects.toThrow('Init error');
      expect(errorAgent.getState().status).toBe(AgentStatus.ERROR);
      expect(errorAgent.getState().lastError).toBe('Init error');
    });
  });

  describe('start', () => {
    it('should start health check on successful start', async () => {
      await agent.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(agent.getState().lastHealthCheck).toBeDefined();
    });

    it('should handle start errors', async () => {
      const errorAgent = new TestAgent(config);
      jest.spyOn(errorAgent as any, 'onStart').mockRejectedValueOnce(new Error('Start error'));

      await expect(errorAgent.start()).rejects.toThrow('Start error');
      expect(errorAgent.getState().status).toBe(AgentStatus.ERROR);
    });

    it('should not start health check if already started', async () => {
      await agent.start();
      const firstHealthCheck = agent.getState().lastHealthCheck;
      await agent.start();
      expect(agent.getState().lastHealthCheck).toEqual(firstHealthCheck);
    });

    it('should handle start when already in ERROR state', async () => {
      const errorAgent = new TestAgent(config);
      errorAgent.getState().status = AgentStatus.ERROR;
      await expect(errorAgent.start()).rejects.toThrow('Cannot start agent in ERROR state');
    });
  });

  describe('stop', () => {
    it('should stop health check on successful stop', async () => {
      await agent.start();
      await agent.stop();
      const lastHealthCheck = agent.getState().lastHealthCheck;
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(agent.getState().lastHealthCheck).toEqual(lastHealthCheck);
    });

    it('should handle stop errors', async () => {
      const errorAgent = new TestAgent(config);
      jest.spyOn(errorAgent as any, 'onStop').mockRejectedValueOnce(new Error('Stop error'));

      await expect(errorAgent.stop()).rejects.toThrow('Stop error');
      expect(errorAgent.getState().status).toBe(AgentStatus.ERROR);
    });

    it('should not stop health check if already stopped', async () => {
      await agent.stop();
      const lastHealthCheck = agent.getState().lastHealthCheck;
      await agent.stop();
      expect(agent.getState().lastHealthCheck).toEqual(lastHealthCheck);
    });

    it('should handle stop when in SHUTDOWN state', async () => {
      const shutdownAgent = new TestAgent(config);
      shutdownAgent.getState().status = AgentStatus.SHUTDOWN;
      await expect(shutdownAgent.stop()).rejects.toThrow('Cannot stop agent in SHUTDOWN state');
    });
  });

  describe('shutdown', () => {
    it('should update status to SHUTDOWN on successful shutdown', async () => {
      await agent.shutdown();
      expect(agent.getState().status).toBe(AgentStatus.SHUTDOWN);
    });

    it('should handle shutdown errors', async () => {
      const errorAgent = new TestAgent(config);
      jest
        .spyOn(errorAgent as any, 'onShutdown')
        .mockRejectedValueOnce(new Error('Shutdown error'));

      await expect(errorAgent.shutdown()).rejects.toThrow('Shutdown error');
      expect(errorAgent.getState().status).toBe(AgentStatus.ERROR);
    });

    it('should not allow operations after shutdown', async () => {
      await agent.shutdown();
      await expect(agent.start()).rejects.toThrow('Cannot start agent in SHUTDOWN state');
      await expect(agent.stop()).rejects.toThrow('Cannot stop agent in SHUTDOWN state');
      await expect(agent.register()).rejects.toThrow('Cannot register agent in SHUTDOWN state');
      await expect(agent.deregister()).rejects.toThrow('Cannot deregister agent in SHUTDOWN state');
    });
  });

  describe('checkHealth', () => {
    it('should update lastHealthCheck timestamp', async () => {
      const beforeCheck = agent.getState().lastHealthCheck;
      await new Promise(resolve => setTimeout(resolve, 10));
      await agent.checkHealth();
      const afterCheck = agent.getState().lastHealthCheck;
      expect(afterCheck.getTime()).toBeGreaterThan(beforeCheck.getTime());
    });

    it('should update status to ERROR on unhealthy check', async () => {
      const unhealthyAgent = new TestAgent(config);
      jest.spyOn(unhealthyAgent as any, 'onHealthCheck').mockResolvedValueOnce(false);

      await unhealthyAgent.checkHealth();
      expect(unhealthyAgent.getState().status).toBe(AgentStatus.ERROR);
    });

    it('should handle health check errors', async () => {
      const errorAgent = new TestAgent(config);
      jest
        .spyOn(errorAgent as any, 'onHealthCheck')
        .mockRejectedValueOnce(new Error('Health check failed'));

      await errorAgent.checkHealth();
      expect(errorAgent.getState().status).toBe(AgentStatus.ERROR);
      expect(errorAgent.getState().lastError).toBe('Health check failed');
    });

    it('should maintain READY status on successful health check', async () => {
      await agent.initialize();
      await agent.checkHealth();
      expect(agent.getState().status).toBe(AgentStatus.READY);
    });

    it('should not perform health check in SHUTDOWN state', async () => {
      await agent.shutdown();
      const lastHealthCheck = agent.getState().lastHealthCheck;
      await agent.checkHealth();
      expect(agent.getState().lastHealthCheck).toEqual(lastHealthCheck);
    });
  });

  describe('updateCapabilities', () => {
    it('should update agent capabilities', async () => {
      const newCapabilities: AgentCapabilities = {
        tools: ['new-tool'],
        protocols: ['new-protocol'],
        maxConcurrency: 2,
        supportsLongRunningTasks: true,
      };

      await agent.updateCapabilities(newCapabilities);
      expect(agent.getConfig().capabilities).toEqual(newCapabilities);
    });

    it('should handle capability update errors', async () => {
      const errorAgent = new TestAgent(config);
      jest
        .spyOn(errorAgent as any, 'onUpdateCapabilities')
        .mockRejectedValueOnce(new Error('Update error'));

      await expect(errorAgent.updateCapabilities({} as AgentCapabilities)).rejects.toThrow(
        'Update error'
      );
      expect(errorAgent.getState().status).toBe(AgentStatus.ERROR);
    });

    it('should maintain current capabilities on update error', async () => {
      const originalCapabilities = agent.getConfig().capabilities;
      const errorAgent = new TestAgent(config);
      jest
        .spyOn(errorAgent as any, 'onUpdateCapabilities')
        .mockRejectedValueOnce(new Error('Update error'));

      await expect(errorAgent.updateCapabilities({} as AgentCapabilities)).rejects.toThrow();
      expect(errorAgent.getConfig().capabilities).toEqual(originalCapabilities);
    });
  });

  describe('register/deregister', () => {
    it('should handle registration errors', async () => {
      const errorAgent = new TestAgent(config);
      jest
        .spyOn(errorAgent as any, 'onRegister')
        .mockRejectedValueOnce(new Error('Register error'));

      await expect(errorAgent.register()).rejects.toThrow('Register error');
      expect(errorAgent.getState().status).toBe(AgentStatus.ERROR);
    });

    it('should handle deregistration errors', async () => {
      const errorAgent = new TestAgent(config);
      jest
        .spyOn(errorAgent as any, 'onDeregister')
        .mockRejectedValueOnce(new Error('Deregister error'));

      await expect(errorAgent.deregister()).rejects.toThrow('Deregister error');
      expect(errorAgent.getState().status).toBe(AgentStatus.ERROR);
    });

    it('should maintain state after successful registration', async () => {
      await agent.initialize();
      await agent.register();
      expect(agent.getState().status).toBe(AgentStatus.READY);
    });

    it('should maintain state after successful deregistration', async () => {
      await agent.initialize();
      await agent.deregister();
      expect(agent.getState().status).toBe(AgentStatus.READY);
    });
  });
});
