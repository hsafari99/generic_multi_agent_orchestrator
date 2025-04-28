import { IMessage } from '../interfaces';
import { Logger } from '../logging/logger';

/**
 * Message routing configuration
 */
export interface MessageRouterConfig {
  maxMessageSize?: number;
  defaultPriority?: number;
  maxPriority?: number;
}

/**
 * Message routing result
 */
export interface RoutingResult {
  success: boolean;
  error?: string;
  code?: string;
}

/**
 * Message router for handling message routing between agents
 */
export class MessageRouter {
  private logger: Logger;
  private config: MessageRouterConfig;
  private routes: Map<string, Set<string>>; // topic -> agentIds
  private agentTopics: Map<string, Set<string>>; // agentId -> topics

  constructor(config: MessageRouterConfig = {}) {
    this.logger = Logger.getInstance();
    this.config = {
      maxMessageSize: 1024 * 1024, // 1MB
      defaultPriority: 0,
      maxPriority: 10,
      ...config,
    };
    this.routes = new Map();
    this.agentTopics = new Map();
  }

  /**
   * Register an agent for a topic
   */
  public registerAgent(agentId: string, topics: string[]): void {
    if (!this.agentTopics.has(agentId)) {
      this.agentTopics.set(agentId, new Set());
    }

    topics.forEach(topic => {
      // Add agent to topic routes
      if (!this.routes.has(topic)) {
        this.routes.set(topic, new Set());
      }
      this.routes.get(topic)?.add(agentId);

      // Add topic to agent's topics
      this.agentTopics.get(agentId)?.add(topic);
    });

    this.logger.info(`Agent ${agentId} registered for topics: ${topics.join(', ')}`);
  }

  /**
   * Unregister an agent from a topic
   */
  public unregisterAgent(agentId: string, topics: string[]): void {
    topics.forEach(topic => {
      // Remove agent from topic routes
      this.routes.get(topic)?.delete(agentId);
      if (this.routes.get(topic)?.size === 0) {
        this.routes.delete(topic);
      }

      // Remove topic from agent's topics
      this.agentTopics.get(agentId)?.delete(topic);
    });

    this.logger.info(`Agent ${agentId} unregistered from topics: ${topics.join(', ')}`);
  }

  /**
   * Route a message to appropriate agents
   */
  public routeMessage(message: IMessage): RoutingResult {
    try {
      // Validate message
      if (!this.validateMessage(message)) {
        return {
          success: false,
          error: 'Invalid message',
          code: 'INVALID_MESSAGE',
        };
      }

      // Get target agents
      const targetAgents = this.getTargetAgents(message);

      if (targetAgents.size === 0) {
        return {
          success: false,
          error: 'No agents found for message routing',
          code: 'NO_AGENTS_FOUND',
        };
      }

      // Route message to each target agent
      targetAgents.forEach(agentId => {
        this.logger.debug(`Routing message ${message.id} to agent ${agentId}`);
        // TODO: Implement actual message delivery
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error routing message: ${error}`);
      return {
        success: false,
        error: 'Message routing failed',
        code: 'ROUTING_ERROR',
      };
    }
  }

  /**
   * Get all agents subscribed to a topic
   */
  private getTargetAgents(message: IMessage): Set<string> {
    const targetAgents = new Set<string>();

    // Handle topic-based routing first
    if (message.metadata?.topic) {
      const topic = message.metadata.topic;
      const agents = this.routes.get(topic);
      if (agents) {
        agents.forEach(agentId => targetAgents.add(agentId));
      }
      return targetAgents;
    }

    // Handle broadcast messages
    if (message.receiver === 'all') {
      this.agentTopics.forEach((_, agentId) => {
        targetAgents.add(agentId);
      });
      return targetAgents;
    }

    // Handle direct routing
    if (message.receiver) {
      targetAgents.add(message.receiver);
    }

    return targetAgents;
  }

  /**
   * Validate a message
   */
  private validateMessage(message: IMessage): boolean {
    // Check required fields
    if (!message.id || !message.type || !message.sender) {
      return false;
    }

    // Check message size
    const messageSize = JSON.stringify(message).length;
    if (messageSize > (this.config.maxMessageSize || 1024 * 1024)) {
      return false;
    }

    // Check message priority
    const priority = message.metadata?.priority ?? this.config.defaultPriority ?? 0;
    if (priority < 0 || priority > (this.config.maxPriority || 10)) {
      return false;
    }

    return true;
  }
}
