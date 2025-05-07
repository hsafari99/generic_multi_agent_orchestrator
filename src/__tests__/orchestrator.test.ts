/**
 * Unit tests for the Orchestrator class
 */
import { Orchestrator } from '../core/orchestrator';
import {
  IAgent,
  ITool,
  IMessage,
  MessageType,
  AgentStatus,
  OrchestratorStatus,
} from '../core/interfaces';

// Mock Agent implementation
class MockAgent implements IAgent {
  id: string;
  name: string;
  capabilities: string[];
  status: AgentStatus;
  tools: ITool[];
  messageHandler: jest.Mock;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.capabilities = [];
    this.status = AgentStatus.INITIALIZING;
    this.tools = [];
    this.messageHandler = jest.fn();
  }

  async initialize(): Promise<void> {
    this.status = AgentStatus.READY;
  }

  async shutdown(): Promise<void> {
    this.status = AgentStatus.SHUTDOWN;
  }

  async executeTask(task: any): Promise<any> {
    return { success: true, data: task.data };
  }

  async handleMessage(message: IMessage): Promise<IMessage> {
    this.messageHandler(message);
    return {
      id: `resp-${message.id}`,
      type: MessageType.RESULT,
      sender: this.id,
      receiver: message.sender,
      payload: { success: true },
      timestamp: Date.now(),
      metadata: {},
    };
  }
}

// Mock Tool implementation
class MockTool implements ITool {
  id: string;
  name: string;
  version: string;
  capabilities: string[];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.version = '1.0.0';
    this.capabilities = [];
  }

  async execute(params: any): Promise<any> {
    return params;
  }

  validate(): boolean {
    return true;
  }

  getMetadata(): any {
    return {
      description: 'Mock tool',
      parameters: [],
      returnType: 'any',
      examples: [],
    };
  }
}

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let mockAgent: MockAgent;
  let mockTool: MockTool;

  beforeEach(() => {
    orchestrator = new Orchestrator();
    mockAgent = new MockAgent('agent1', 'Test Agent');
    mockTool = new MockTool('tool1', 'Test Tool');
  });

  describe('Initialization', () => {
    it('should initialize with correct initial status', async () => {
      expect(orchestrator.getStatus()).toBe(OrchestratorStatus.INITIALIZING);
      await orchestrator.initialize();
      expect(orchestrator.getStatus()).toBe(OrchestratorStatus.RUNNING);
    });

    it('should handle initialization errors', async () => {
      const errorOrchestrator = new Orchestrator();
      // Simulate an error during initialization
      jest.spyOn(errorOrchestrator as any, 'setupMessageHandlers').mockImplementation(() => {
        throw new Error('Initialization error');
      });
      await expect(errorOrchestrator.initialize()).rejects.toThrow('Initialization error');
      expect(errorOrchestrator.getStatus()).toBe(OrchestratorStatus.ERROR);
    });

    it('should handle initialization errors in message handler setup', async () => {
      const errorOrchestrator = new Orchestrator();
      // Simulate an error during message handler setup
      jest.spyOn(errorOrchestrator as any, 'setupMessageHandlers').mockImplementation(() => {
        throw new Error('Message handler setup error');
      });
      await expect(errorOrchestrator.initialize()).rejects.toThrow('Message handler setup error');
      expect(errorOrchestrator.getStatus()).toBe(OrchestratorStatus.ERROR);
    });

    it('should handle successful shutdown', async () => {
      await orchestrator.initialize();
      await orchestrator.registerAgent(mockAgent);
      await orchestrator.shutdown();
      expect(orchestrator.getStatus()).toBe(OrchestratorStatus.SHUTDOWN);
      expect(mockAgent.status).toBe(AgentStatus.SHUTDOWN);
    });

    it('should handle errors during agent shutdown', async () => {
      await orchestrator.initialize();
      const errorAgent = new MockAgent('error-agent', 'Error Agent');
      jest.spyOn(errorAgent, 'shutdown').mockImplementation(() => {
        throw new Error('Agent shutdown error');
      });
      await orchestrator.registerAgent(errorAgent);
      await expect(orchestrator.shutdown()).rejects.toThrow('Agent shutdown error');
      expect(orchestrator.getStatus()).toBe(OrchestratorStatus.ERROR);
    });

    it('should handle multiple agent shutdown errors', async () => {
      await orchestrator.initialize();
      const errorAgent1 = new MockAgent('error-agent-1', 'Error Agent 1');
      const errorAgent2 = new MockAgent('error-agent-2', 'Error Agent 2');
      jest.spyOn(errorAgent1, 'shutdown').mockImplementation(() => {
        throw new Error('Agent 1 shutdown error');
      });
      jest.spyOn(errorAgent2, 'shutdown').mockImplementation(() => {
        throw new Error('Agent 2 shutdown error');
      });
      await orchestrator.registerAgent(errorAgent1);
      await orchestrator.registerAgent(errorAgent2);
      await expect(orchestrator.shutdown()).rejects.toThrow('Agent 1 shutdown error');
      expect(orchestrator.getStatus()).toBe(OrchestratorStatus.ERROR);
    });
  });

  describe('Agent Management', () => {
    it('should register and unregister agents', async () => {
      await orchestrator.registerAgent(mockAgent);
      expect(orchestrator.listAgents()).toHaveLength(1);
      expect(orchestrator.getAgent('agent1')).toBe(mockAgent);

      await orchestrator.unregisterAgent('agent1');
      expect(orchestrator.listAgents()).toHaveLength(0);
    });

    it('should not allow duplicate agent registration', async () => {
      await orchestrator.registerAgent(mockAgent);
      await expect(orchestrator.registerAgent(mockAgent)).rejects.toThrow(
        'Agent with ID agent1 already exists'
      );
    });

    it('should throw error when unregistering non-existent agent', async () => {
      await expect(orchestrator.unregisterAgent('non-existent')).rejects.toThrow(
        'Agent with ID non-existent not found'
      );
    });
  });

  describe('Tool Management', () => {
    it('should register and unregister tools', async () => {
      await orchestrator.registerTool(mockTool);
      expect(orchestrator.listTools()).toHaveLength(1);
      expect(orchestrator.getTool('tool1')).toBe(mockTool);

      await orchestrator.unregisterTool('tool1');
      expect(orchestrator.listTools()).toHaveLength(0);
    });

    it('should not allow duplicate tool registration', async () => {
      await orchestrator.registerTool(mockTool);
      await expect(orchestrator.registerTool(mockTool)).rejects.toThrow(
        'Tool with ID tool1 already exists'
      );
    });

    it('should throw error when unregistering non-existent tool', async () => {
      await expect(orchestrator.unregisterTool('non-existent')).rejects.toThrow(
        'Tool with ID non-existent not found'
      );
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      await orchestrator.registerAgent(mockAgent);
    });

    it('should handle task messages', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: {
          priority: 1,
          requiresAck: false,
        },
      };
      await expect(orchestrator.handleMessage(message)).resolves.not.toThrow();
      expect(mockAgent.messageHandler).toHaveBeenCalledWith(message);
    });

    it('should handle result messages', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.RESULT,
        sender: 'agent1',
        receiver: 'system',
        payload: { result: 'test result' },
        timestamp: Date.now(),
        metadata: {
          priority: 1,
          requiresAck: false,
        },
      };
      await expect(orchestrator.handleMessage(message)).resolves.not.toThrow();
    });

    it('should handle status messages', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.STATUS,
        sender: 'agent1',
        receiver: 'system',
        payload: { status: 'ready' },
        timestamp: Date.now(),
        metadata: {
          priority: 1,
          requiresAck: false,
        },
      };
      await expect(orchestrator.handleMessage(message)).resolves.not.toThrow();
    });

    it('should handle control messages', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.CONTROL,
        sender: 'system',
        receiver: 'agent1',
        payload: { command: 'stop' },
        timestamp: Date.now(),
        metadata: {
          priority: 1,
          requiresAck: false,
        },
      };
      await expect(orchestrator.handleMessage(message)).resolves.not.toThrow();
    });

    it('should throw error for unknown message type', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: 'UNKNOWN' as MessageType,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };
      await expect(orchestrator.handleMessage(message)).rejects.toThrow(
        'No handler registered for message type UNKNOWN'
      );
    });

    it('should handle task message when agent exists', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };
      await expect(orchestrator.handleMessage(message)).resolves.not.toThrow();
      expect(mockAgent.messageHandler).toHaveBeenCalledWith(message);
    });

    it('should throw error when handling task message for non-existent agent', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'non-existent',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };
      await expect(orchestrator.handleMessage(message)).rejects.toThrow(
        'Agent with ID non-existent not found'
      );
    });
  });

  describe('Broadcast Messages', () => {
    let mockAgent2: MockAgent;

    beforeEach(async () => {
      await orchestrator.initialize();
      mockAgent2 = new MockAgent('agent2', 'Test Agent 2');
      await orchestrator.registerAgent(mockAgent);
      await orchestrator.registerAgent(mockAgent2);
    });

    it('should broadcast messages to all agents', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.CONTROL,
        sender: 'system',
        receiver: 'broadcast',
        payload: { command: 'stop' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };
      await orchestrator.broadcastMessage(message);
      expect(mockAgent.messageHandler).toHaveBeenCalledWith(message);
      expect(mockAgent2.messageHandler).toHaveBeenCalledWith(message);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await orchestrator.registerAgent(mockAgent);
      await orchestrator.shutdown();
      expect(orchestrator.getStatus()).toBe(OrchestratorStatus.SHUTDOWN);
      expect(mockAgent.status).toBe(AgentStatus.SHUTDOWN);
    });

    it('should handle shutdown errors', async () => {
      await orchestrator.registerAgent(mockAgent);
      jest.spyOn(mockAgent, 'shutdown').mockImplementation(() => {
        throw new Error('Shutdown error');
      });
      await expect(orchestrator.shutdown()).rejects.toThrow('Shutdown error');
      expect(orchestrator.getStatus()).toBe(OrchestratorStatus.ERROR);
    });

    it('should handle shutdown errors with multiple agents', async () => {
      const mockAgent2 = new MockAgent('agent2', 'Test Agent 2');
      await orchestrator.registerAgent(mockAgent);
      await orchestrator.registerAgent(mockAgent2);

      // Make first agent fail during shutdown
      jest.spyOn(mockAgent, 'shutdown').mockImplementation(() => {
        throw new Error('Agent 1 shutdown error');
      });

      await expect(orchestrator.shutdown()).rejects.toThrow('Agent 1 shutdown error');
      expect(orchestrator.getStatus()).toBe(OrchestratorStatus.ERROR);
    });
  });

  describe('Agent Registration', () => {
    it('should register new agent successfully', async () => {
      await expect(orchestrator.registerAgent(mockAgent)).resolves.not.toThrow();
      expect(orchestrator.listAgents()).toHaveLength(1);
      expect(orchestrator.getAgent('agent1')).toBe(mockAgent);
    });

    it('should throw error when registering duplicate agent', async () => {
      await orchestrator.registerAgent(mockAgent);
      await expect(orchestrator.registerAgent(mockAgent)).rejects.toThrow(
        'Agent with ID agent1 already exists'
      );
    });
  });

  describe('Agent Unregistration', () => {
    it('should unregister existing agent successfully', async () => {
      await orchestrator.registerAgent(mockAgent);
      await expect(orchestrator.unregisterAgent('agent1')).resolves.not.toThrow();
      expect(orchestrator.listAgents()).toHaveLength(0);
    });

    it('should throw error when unregistering non-existent agent', async () => {
      await expect(orchestrator.unregisterAgent('non-existent')).rejects.toThrow(
        'Agent with ID non-existent not found'
      );
    });
  });

  describe('Tool Registration', () => {
    it('should register new tool successfully', async () => {
      await expect(orchestrator.registerTool(mockTool)).resolves.not.toThrow();
      expect(orchestrator.listTools()).toHaveLength(1);
      expect(orchestrator.getTool('tool1')).toBe(mockTool);
    });

    it('should throw error when registering duplicate tool', async () => {
      await orchestrator.registerTool(mockTool);
      await expect(orchestrator.registerTool(mockTool)).rejects.toThrow(
        'Tool with ID tool1 already exists'
      );
    });
  });

  describe('Tool Unregistration', () => {
    it('should unregister existing tool successfully', async () => {
      await orchestrator.registerTool(mockTool);
      await expect(orchestrator.unregisterTool('tool1')).resolves.not.toThrow();
      expect(orchestrator.listTools()).toHaveLength(0);
    });

    it('should throw error when unregistering non-existent tool', async () => {
      await expect(orchestrator.unregisterTool('non-existent')).rejects.toThrow(
        'Tool with ID non-existent not found'
      );
    });
  });

  describe('Broadcast Messaging', () => {
    let agent1: MockAgent;
    let agent2: MockAgent;

    beforeEach(async () => {
      await orchestrator.initialize();
      agent1 = new MockAgent('agent1', 'Test Agent 1');
      agent2 = new MockAgent('agent2', 'Test Agent 2');
      await orchestrator.registerAgent(agent1);
      await orchestrator.registerAgent(agent2);
    });

    it('should broadcast messages to all agents', async () => {
      const message: IMessage = {
        id: 'broadcast1',
        type: MessageType.CONTROL,
        sender: 'system',
        receiver: 'broadcast',
        payload: { command: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };

      await orchestrator.broadcastMessage(message);
      expect(agent1.messageHandler).toHaveBeenCalledWith(message);
      expect(agent2.messageHandler).toHaveBeenCalledWith(message);
    });

    it('should handle errors during broadcast', async () => {
      const message: IMessage = {
        id: 'broadcast2',
        type: MessageType.CONTROL,
        sender: 'system',
        receiver: 'broadcast',
        payload: { command: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };

      jest.spyOn(agent1, 'handleMessage').mockImplementation(() => {
        throw new Error('Agent 1 error');
      });

      await expect(orchestrator.broadcastMessage(message)).rejects.toThrow('Agent 1 error');
      expect(agent2.messageHandler).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent agent registrations', async () => {
      const agent1 = new MockAgent('agent1', 'Test Agent 1');
      const agent2 = new MockAgent('agent2', 'Test Agent 2');

      await Promise.all([orchestrator.registerAgent(agent1), orchestrator.registerAgent(agent2)]);

      expect(orchestrator.listAgents()).toHaveLength(2);
    });

    it('should handle concurrent tool registrations', async () => {
      const tool1 = new MockTool('tool1', 'Test Tool 1');
      const tool2 = new MockTool('tool2', 'Test Tool 2');

      await Promise.all([orchestrator.registerTool(tool1), orchestrator.registerTool(tool2)]);

      expect(orchestrator.listTools()).toHaveLength(2);
    });

    it('should handle concurrent message processing', async () => {
      await orchestrator.initialize();
      const agent = new MockAgent('agent1', 'Test Agent');
      await orchestrator.registerAgent(agent);

      const messages = Array.from({ length: 5 }, (_, i) => ({
        id: `msg${i}`,
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: `task${i}` },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      }));

      await Promise.all(messages.map(msg => orchestrator.handleMessage(msg)));
      expect(agent.messageHandler).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling in Message Routing', () => {
    let agent: MockAgent;

    beforeEach(async () => {
      await orchestrator.initialize();
      agent = new MockAgent('agent1', 'Test Agent');
      await orchestrator.registerAgent(agent);
    });

    it('should handle invalid message types', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: 'INVALID' as MessageType,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };

      await expect(orchestrator.handleMessage(message)).rejects.toThrow(
        'No handler registered for message type INVALID'
      );
    });

    it('should handle messages to non-existent agents', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'non-existent',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };

      await expect(orchestrator.handleMessage(message)).rejects.toThrow(
        'Agent with ID non-existent not found'
      );
    });

    it('should handle agent message handling errors', async () => {
      jest.spyOn(agent, 'handleMessage').mockImplementation(() => {
        throw new Error('Agent message handling error');
      });

      const message: IMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };

      await expect(orchestrator.handleMessage(message)).rejects.toThrow(
        'Agent message handling error'
      );
    });
  });

  describe('Message Handler Edge Cases', () => {
    let agent: MockAgent;

    beforeEach(async () => {
      await orchestrator.initialize();
      agent = new MockAgent('agent1', 'Test Agent');
      await orchestrator.registerAgent(agent);
    });

    it('should handle message handler execution errors', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };

      // Mock the agent's handleMessage to throw an error
      jest.spyOn(agent, 'handleMessage').mockImplementation(() => {
        throw new Error('Message handler execution error');
      });

      await expect(orchestrator.handleMessage(message)).rejects.toThrow(
        'Message handler execution error'
      );
    });
  });

  describe('Agent Management Edge Cases', () => {
    it('should handle agent initialization errors', async () => {
      const errorAgent = new MockAgent('error-agent', 'Error Agent');
      jest.spyOn(errorAgent, 'initialize').mockImplementation(() => {
        throw new Error('Agent initialization error');
      });

      await expect(orchestrator.registerAgent(errorAgent)).rejects.toThrow(
        'Agent initialization error'
      );
      expect(orchestrator.listAgents()).toHaveLength(0);
    });

    it('should handle agent shutdown errors during unregistration', async () => {
      const errorAgent = new MockAgent('error-agent', 'Error Agent');
      await orchestrator.registerAgent(errorAgent);
      jest.spyOn(errorAgent, 'shutdown').mockImplementation(() => {
        throw new Error('Agent shutdown error');
      });

      await expect(orchestrator.unregisterAgent('error-agent')).rejects.toThrow(
        'Agent shutdown error'
      );
      // Agent should be removed even if shutdown fails
      expect(orchestrator.listAgents()).toHaveLength(0);
    });
  });

  describe('Tool Management Edge Cases', () => {
    it('should handle tool validation errors', async () => {
      const invalidTool = new MockTool('invalid-tool', 'Invalid Tool');
      jest.spyOn(invalidTool, 'validate').mockReturnValue(false);

      await expect(orchestrator.registerTool(invalidTool)).rejects.toThrow(
        'Tool validation failed'
      );
      expect(orchestrator.listTools()).toHaveLength(0);
    });

    it('should handle tool validation errors with exceptions', async () => {
      const invalidTool = new MockTool('invalid-tool', 'Invalid Tool');
      jest.spyOn(invalidTool, 'validate').mockImplementation(() => {
        throw new Error('Custom validation error');
      });

      await expect(orchestrator.registerTool(invalidTool)).rejects.toThrow(
        'Tool validation error: Custom validation error'
      );
      expect(orchestrator.listTools()).toHaveLength(0);
    });

    it('should handle tool execution errors', async () => {
      const errorTool = new MockTool('error-tool', 'Error Tool');
      await orchestrator.registerTool(errorTool);

      jest.spyOn(errorTool, 'execute').mockRejectedValue(new Error('Tool execution error'));

      await expect(errorTool.execute({})).rejects.toThrow('Tool execution error');
    });
  });

  describe('Message Processing Edge Cases', () => {
    let agent: MockAgent;

    beforeEach(async () => {
      await orchestrator.initialize();
      agent = new MockAgent('agent1', 'Test Agent');
      await orchestrator.registerAgent(agent);
    });

    it('should handle message processing timeouts', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false, ttl: 1 },
      };

      // Mock agent's handleMessage to take longer than the timeout
      jest.spyOn(agent, 'handleMessage').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          id: 'resp-msg1',
          type: MessageType.RESULT,
          sender: 'agent1',
          receiver: 'system',
          payload: { success: true },
          timestamp: Date.now(),
          metadata: {},
        };
      });

      await expect(orchestrator.handleMessage(message)).rejects.toThrow(
        'Message handling timed out after 1ms'
      );
    });

    it('should handle message validation errors', async () => {
      const invalidMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: null,
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      } as IMessage;

      await expect(orchestrator.handleMessage(invalidMessage)).rejects.toThrow(
        'Invalid message payload'
      );
    });

    it('should handle missing message fields', async () => {
      const invalidMessage = {
        id: 'msg1',
        // Missing type
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      } as IMessage;

      await expect(orchestrator.handleMessage(invalidMessage)).rejects.toThrow(
        'Message type is required'
      );
    });
  });

  describe('Message Validation Edge Cases', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should handle missing message object', async () => {
      await expect(orchestrator.handleMessage(undefined as any)).rejects.toThrow(
        'Message is required'
      );
    });

    it('should handle missing message ID', async () => {
      const invalidMessage = {
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      } as IMessage;

      await expect(orchestrator.handleMessage(invalidMessage)).rejects.toThrow(
        'Message ID is required'
      );
    });

    it('should handle missing message sender', async () => {
      const invalidMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      } as IMessage;

      await expect(orchestrator.handleMessage(invalidMessage)).rejects.toThrow(
        'Message sender is required'
      );
    });

    it('should handle missing message receiver', async () => {
      const invalidMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      } as IMessage;

      await expect(orchestrator.handleMessage(invalidMessage)).rejects.toThrow(
        'Message receiver is required'
      );
    });

    it('should handle undefined message payload', async () => {
      const invalidMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: undefined,
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      } as IMessage;

      await expect(orchestrator.handleMessage(invalidMessage)).rejects.toThrow(
        'Invalid message payload'
      );
    });
  });

  describe('Message Handler Timeout Edge Cases', () => {
    let agent: MockAgent;

    beforeEach(async () => {
      await orchestrator.initialize();
      agent = new MockAgent('agent1', 'Test Agent');
      await orchestrator.registerAgent(agent);
    });

    it('should handle immediate message processing', async () => {
      const message: IMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false, ttl: 100 },
      };

      // Mock agent's handleMessage to resolve immediately
      jest.spyOn(agent, 'handleMessage').mockResolvedValue({
        id: 'resp-msg1',
        type: MessageType.RESULT,
        sender: 'agent1',
        receiver: 'system',
        payload: { success: true },
        timestamp: Date.now(),
        metadata: {},
      });

      await expect(orchestrator.handleMessage(message)).resolves.not.toThrow();
    });
  });

  describe('Tool Management Additional Cases', () => {
    it('should handle tool validation returning false', async () => {
      const invalidTool = new MockTool('invalid-tool', 'Invalid Tool');
      jest.spyOn(invalidTool, 'validate').mockReturnValue(false);

      await expect(orchestrator.registerTool(invalidTool)).rejects.toThrow(
        'Tool validation failed'
      );
    });

    it('should handle tool validation throwing error', async () => {
      const invalidTool = new MockTool('invalid-tool', 'Invalid Tool');
      jest.spyOn(invalidTool, 'validate').mockImplementation(() => {
        throw new Error('Validation error');
      });

      await expect(orchestrator.registerTool(invalidTool)).rejects.toThrow(
        'Tool validation error: Validation error'
      );
    });

    it('should handle tool validation throwing error without message', async () => {
      const invalidTool = new MockTool('invalid-tool', 'Invalid Tool');
      jest.spyOn(invalidTool, 'validate').mockImplementation(() => {
        throw new Error();
      });

      await expect(orchestrator.registerTool(invalidTool)).rejects.toThrow(
        'Tool validation error: Unknown error'
      );
    });
  });

  describe('Message Validation', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should validate required message fields', async () => {
      const invalidMessage = {
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      } as IMessage;

      await expect(orchestrator.handleMessage(invalidMessage)).rejects.toThrow(
        'Message ID is required'
      );
    });

    it('should validate message payload', async () => {
      const invalidMessage: IMessage = {
        id: 'msg1',
        type: MessageType.TASK,
        sender: 'system',
        receiver: 'agent1',
        payload: null,
        timestamp: Date.now(),
        metadata: { priority: 1, requiresAck: false },
      };

      await expect(orchestrator.handleMessage(invalidMessage)).rejects.toThrow(
        'Invalid message payload'
      );
    });
  });
});
