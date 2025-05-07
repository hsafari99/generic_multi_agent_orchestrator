/**
 * Base Orchestrator class implementation
 *
 * The Orchestrator is the central component of the system that manages agents,
 * tools, and message routing. It provides the core functionality for:
 * - Agent lifecycle management (registration, initialization, shutdown)
 * - Tool management (registration, access control)
 * - Message handling and routing
 * - System status management
 *
 * @packageDocumentation
 */
import { IAgent, ITool, IMessage, OrchestratorStatus, MessageType } from './interfaces';
import {
  OrchestratorWebSocket,
  OrchestratorWebSocketConfig,
} from './communication/websocket/orchestratorWebSocket';

export class Orchestrator {
  private agents: Map<string, IAgent>;
  private tools: Map<string, ITool>;
  private status: OrchestratorStatus;
  private messageHandlers: Map<MessageType, (message: IMessage) => Promise<IMessage>>;
  private webSocket: OrchestratorWebSocket | null;

  /**
   * Creates a new Orchestrator instance
   */
  constructor() {
    this.agents = new Map();
    this.tools = new Map();
    this.status = OrchestratorStatus.INITIALIZING;
    this.messageHandlers = new Map();
    this.webSocket = null;
  }

  /**
   * Initialize the orchestrator
   *
   * This method:
   * 1. Sets the status to INITIALIZING
   * 2. Sets up message handlers
   * 3. Changes status to RUNNING
   *
   * @throws {Error} If initialization fails
   */
  public async initialize(): Promise<void> {
    try {
      this.status = OrchestratorStatus.INITIALIZING;
      // Initialize message handlers
      this.setupMessageHandlers();
      this.status = OrchestratorStatus.RUNNING;
    } catch (error) {
      this.status = OrchestratorStatus.ERROR;
      throw error;
    }
  }

  /**
   * Initialize WebSocket server
   *
   * @param config - WebSocket server configuration
   */
  public initializeWebSocket(config: OrchestratorWebSocketConfig): void {
    if (this.webSocket) {
      throw new Error('WebSocket server already initialized');
    }
    this.webSocket = new OrchestratorWebSocket(this, config);
    this.webSocket.start();
  }

  /**
   * Shutdown the orchestrator
   *
   * This method:
   * 1. Sets the status to MAINTENANCE
   * 2. Shuts down all registered agents
   * 3. Stops the WebSocket server if initialized
   * 4. Changes status to SHUTDOWN
   *
   * @throws {Error} If shutdown fails
   */
  public async shutdown(): Promise<void> {
    try {
      this.status = OrchestratorStatus.MAINTENANCE;
      // Shutdown all agents
      for (const agent of this.agents.values()) {
        await agent.shutdown();
      }
      // Stop WebSocket server if initialized
      if (this.webSocket) {
        this.webSocket.stop();
        this.webSocket = null;
      }
      this.status = OrchestratorStatus.SHUTDOWN;
    } catch (error) {
      this.status = OrchestratorStatus.ERROR;
      throw error;
    }
  }

  /**
   * Get current orchestrator status
   * @returns The current status of the orchestrator
   */
  public getStatus(): OrchestratorStatus {
    return this.status;
  }

  /**
   * Register a new agent
   *
   * @param agent - The agent to register
   * @throws {Error} If an agent with the same ID already exists
   * @throws {Error} If agent initialization fails
   */
  public async registerAgent(agent: IAgent): Promise<void> {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID ${agent.id} already exists`);
    }
    await agent.initialize();
    this.agents.set(agent.id, agent);
  }

  /**
   * Unregister an agent
   *
   * @param agentId - The ID of the agent to unregister
   * @throws {Error} If the agent is not found
   * @throws {Error} If agent shutdown fails
   */
  public async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    try {
      await agent.shutdown();
    } finally {
      // Always remove the agent, even if shutdown fails
      this.agents.delete(agentId);
    }
  }

  /**
   * Get an agent by ID
   *
   * @param agentId - The ID of the agent to get
   * @returns The agent instance
   * @throws {Error} If the agent is not found
   */
  public getAgent(agentId: string): IAgent {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    return agent;
  }

  /**
   * List all registered agents
   *
   * @returns Array of all registered agents
   */
  public listAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Register a new tool
   *
   * @param tool - The tool to register
   * @throws {Error} If a tool with the same ID already exists
   * @throws {Error} If tool validation fails
   */
  public async registerTool(tool: ITool): Promise<void> {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool with ID ${tool.id} already exists`);
    }

    // Validate tool before registration
    try {
      if (!tool.validate({})) {
        throw new Error('Tool validation failed');
      }
    } catch (error: any) {
      throw new Error(`Tool validation error: ${error.message || 'Unknown error'}`);
    }

    this.tools.set(tool.id, tool);
  }

  /**
   * Unregister a tool
   *
   * @param toolId - The ID of the tool to unregister
   * @throws {Error} If the tool is not found
   */
  public async unregisterTool(toolId: string): Promise<void> {
    if (!this.tools.has(toolId)) {
      throw new Error(`Tool with ID ${toolId} not found`);
    }
    this.tools.delete(toolId);
  }

  /**
   * Get a tool by ID
   *
   * @param toolId - The ID of the tool to get
   * @returns The tool instance
   * @throws {Error} If the tool is not found
   */
  public getTool(toolId: string): ITool {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool with ID ${toolId} not found`);
    }
    return tool;
  }

  /**
   * List all registered tools
   *
   * @returns Array of all registered tools
   */
  public listTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Handle an incoming message
   *
   * @param message - The message to handle
   * @returns The response message from the agent
   * @throws {Error} If message validation fails
   * @throws {Error} If message handling fails
   */
  public async handleMessage(message: IMessage): Promise<IMessage> {
    this.validateMessage(message);

    const handler = this.messageHandlers.get(message.type);
    if (!handler) {
      throw new Error(`No handler registered for message type ${message.type}`);
    }

    return await this.handleMessageWithTimeout(handler, message);
  }

  /**
   * Validate a message
   *
   * @param message - The message to validate
   * @throws {Error} If message validation fails
   */
  private validateMessage(message: IMessage): void {
    if (!message) {
      throw new Error('Message is required');
    }
    if (!message.id) {
      throw new Error('Message ID is required');
    }
    if (!message.type) {
      throw new Error('Message type is required');
    }
    if (!message.sender) {
      throw new Error('Message sender is required');
    }
    if (!message.receiver) {
      throw new Error('Message receiver is required');
    }
    if (message.payload === null || message.payload === undefined) {
      throw new Error('Invalid message payload');
    }
  }

  private async handleMessageWithTimeout(
    handler: (message: IMessage) => Promise<IMessage>,
    message: IMessage
  ): Promise<IMessage> {
    const timeout = message.metadata?.ttl || 30000; // Use message TTL or default to 30 seconds
    const timeoutPromise = new Promise<IMessage>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Message handling timed out after ${timeout}ms`));
      }, timeout);
    });

    return Promise.race([handler(message), timeoutPromise]);
  }

  /**
   * Broadcast a message to all agents
   *
   * @param message - The message to broadcast
   * @throws {Error} If message handling fails for any agent
   */
  public async broadcastMessage(message: IMessage): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.handleMessage(message);
    }
  }

  /**
   * Setup message handlers
   *
   * This method registers handlers for different message types:
   * - TASK: Handle task messages
   * - RESULT: Handle result messages
   * - STATUS: Handle status messages
   * - ERROR: Handle error messages
   * - CONTROL: Handle control messages
   */
  private setupMessageHandlers(): void {
    this.messageHandlers.set(MessageType.TASK, this.handleTaskMessage.bind(this));
    this.messageHandlers.set(MessageType.RESULT, this.handleResultMessage.bind(this));
    this.messageHandlers.set(MessageType.STATUS, this.handleStatusMessage.bind(this));
    this.messageHandlers.set(MessageType.ERROR, this.handleErrorMessage.bind(this));
    this.messageHandlers.set(MessageType.CONTROL, this.handleControlMessage.bind(this));
  }

  /**
   * Handle task messages
   *
   * @param message - The task message to handle
   * @returns The response message from the agent
   * @throws {Error} If the target agent is not found
   * @throws {Error} If message handling fails
   */
  private async handleTaskMessage(message: IMessage): Promise<IMessage> {
    const agent = this.getAgent(message.receiver);
    const response = await agent.handleMessage(message);
    return response;
  }

  /**
   * Handle result messages
   *
   * @param message - The result message to handle
   */
  private async handleResultMessage(message: IMessage): Promise<IMessage> {
    console.log('Handling result message:', message);
    return message;
  }

  /**
   * Handle status messages
   *
   * @param message - The status message to handle
   */
  private async handleStatusMessage(message: IMessage): Promise<IMessage> {
    console.log('Handling status message:', message);
    return message;
  }

  /**
   * Handle error messages
   *
   * @param message - The error message to handle
   */
  private async handleErrorMessage(message: IMessage): Promise<IMessage> {
    console.log('Handling error message:', message);
    return message;
  }

  /**
   * Handle control messages
   *
   * @param message - The control message to handle
   */
  private async handleControlMessage(message: IMessage): Promise<IMessage> {
    console.log('Handling control message:', message);
    return message;
  }
}
