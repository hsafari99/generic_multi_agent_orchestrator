import { Logger } from '../logging/logger';
import { IMessage } from '../interfaces';

/**
 * PubSub configuration
 */
export interface PubSubConfig {
  maxSubscriptionsPerAgent?: number;
  maxTopicsPerAgent?: number;
  wildcardEnabled?: boolean;
  deliveryTimeout?: number;
}

/**
 * Subscription information
 */
export interface Subscription {
  agentId: string;
  topic: string;
  isWildcard: boolean;
  lastDelivery: number;
  deliveryCount: number;
  failedDeliveries: number;
}

/**
 * PubSub manager for handling message publishing and subscriptions
 */
export class PubSubManager {
  private logger: Logger;
  private config: PubSubConfig;
  private subscriptions: Map<string, Set<Subscription>>; // topic -> subscriptions
  private agentSubscriptions: Map<string, Set<Subscription>>; // agentId -> subscriptions
  private messageHandlers: Map<string, (message: IMessage) => Promise<void>>; // agentId -> handler

  constructor(config: PubSubConfig = {}) {
    this.logger = Logger.getInstance();
    this.config = {
      maxSubscriptionsPerAgent: 100,
      maxTopicsPerAgent: 50,
      wildcardEnabled: true,
      deliveryTimeout: 5000,
      ...config,
    };
    this.subscriptions = new Map();
    this.agentSubscriptions = new Map();
    this.messageHandlers = new Map();
  }

  /**
   * Register a message handler for an agent
   */
  public registerHandler(agentId: string, handler: (message: IMessage) => Promise<void>): void {
    this.messageHandlers.set(agentId, handler);
    this.logger.info(`Message handler registered for agent ${agentId}`);
  }

  /**
   * Subscribe an agent to a topic
   */
  public subscribe(agentId: string, topic: string): void {
    // Validate subscription limits
    if (!this.validateSubscriptionLimits(agentId)) {
      throw new Error('Subscription limit exceeded');
    }

    // Create subscription
    const subscription: Subscription = {
      agentId,
      topic,
      isWildcard: topic.includes('*'),
      lastDelivery: 0,
      deliveryCount: 0,
      failedDeliveries: 0,
    };

    // Add to topic subscriptions
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)?.add(subscription);

    // Add to agent subscriptions
    if (!this.agentSubscriptions.has(agentId)) {
      this.agentSubscriptions.set(agentId, new Set());
    }
    this.agentSubscriptions.get(agentId)?.add(subscription);

    this.logger.info(`Agent ${agentId} subscribed to topic ${topic}`);
  }

  /**
   * Unsubscribe an agent from a topic
   */
  public unsubscribe(agentId: string, topic: string): void {
    // Remove from topic subscriptions
    const topicSubs = this.subscriptions.get(topic);
    if (topicSubs) {
      for (const sub of topicSubs) {
        if (sub.agentId === agentId) {
          topicSubs.delete(sub);
          break;
        }
      }
      if (topicSubs.size === 0) {
        this.subscriptions.delete(topic);
      }
    }

    // Remove from agent subscriptions
    const agentSubs = this.agentSubscriptions.get(agentId);
    if (agentSubs) {
      for (const sub of agentSubs) {
        if (sub.topic === topic) {
          agentSubs.delete(sub);
          break;
        }
      }
      if (agentSubs.size === 0) {
        this.agentSubscriptions.delete(agentId);
      }
    }

    this.logger.info(`Agent ${agentId} unsubscribed from topic ${topic}`);
  }

  /**
   * Publish a message to a topic
   */
  public async publish(topic: string, message: IMessage): Promise<void> {
    const subscribers = this.getSubscribers(topic);
    if (subscribers.size === 0) {
      this.logger.warn(`No subscribers found for topic ${topic}`);
      return;
    }

    // Deliver message to each subscriber
    const deliveryPromises = Array.from(subscribers).map(async subscription => {
      try {
        const handler = this.messageHandlers.get(subscription.agentId);
        if (!handler) {
          throw new Error(`No message handler found for agent ${subscription.agentId}`);
        }

        // Update subscription stats
        subscription.lastDelivery = Date.now();
        subscription.deliveryCount++;

        // Deliver message
        await handler(message);
      } catch (error) {
        subscription.failedDeliveries++;
        this.logger.error(`Failed to deliver message to agent ${subscription.agentId}: ${error}`);
        throw error;
      }
    });

    // Wait for all deliveries to complete
    await Promise.all(deliveryPromises);
  }

  /**
   * Get all subscribers for a topic (including wildcard matches)
   */
  private getSubscribers(topic: string): Set<Subscription> {
    const subscribers = new Set<Subscription>();

    // Add direct subscribers
    const directSubs = this.subscriptions.get(topic);
    if (directSubs) {
      directSubs.forEach(sub => subscribers.add(sub));
    }

    // Add wildcard subscribers if enabled
    if (this.config.wildcardEnabled) {
      this.subscriptions.forEach((subs, subTopic) => {
        if (this.isWildcardMatch(topic, subTopic)) {
          subs.forEach(sub => subscribers.add(sub));
        }
      });
    }

    return subscribers;
  }

  /**
   * Check if a topic matches a wildcard pattern
   */
  private isWildcardMatch(topic: string, pattern: string): boolean {
    if (!pattern.includes('*')) {
      return topic === pattern;
    }

    const regexPattern = pattern
      .split('*')
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  }

  /**
   * Validate subscription limits
   */
  private validateSubscriptionLimits(agentId: string): boolean {
    const agentSubs = this.agentSubscriptions.get(agentId);
    if (!agentSubs) {
      return true;
    }

    // Check subscription count
    if (agentSubs.size >= (this.config.maxSubscriptionsPerAgent || 100)) {
      return false;
    }

    // Check unique topics count
    const uniqueTopics = new Set(Array.from(agentSubs).map((sub: Subscription) => sub.topic));
    if (uniqueTopics.size >= (this.config.maxTopicsPerAgent || 50)) {
      return false;
    }

    return true;
  }
}
