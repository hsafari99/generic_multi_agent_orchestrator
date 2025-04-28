import { PubSubManager } from '../core/communication/pubsub';
import { IMessage, MessageType } from '../core/interfaces';

jest.mock('../core/logging/logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    }),
  },
}));

describe('PubSubManager', () => {
  let pubsub: PubSubManager;
  let mockMessage: IMessage;
  let mockHandler: jest.Mock;

  beforeEach(() => {
    pubsub = new PubSubManager();
    mockMessage = {
      id: 'msg_1',
      type: MessageType.TASK,
      sender: 'agent1',
      receiver: 'agent2',
      payload: { task: 'test' },
      timestamp: Date.now(),
      metadata: {
        priority: 1,
        requiresAck: true,
      },
    };
    mockHandler = jest.fn().mockResolvedValue(undefined);
  });

  describe('registerHandler', () => {
    it('should register a message handler for an agent', () => {
      pubsub.registerHandler('agent1', mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should overwrite existing handler for the same agent', () => {
      const newHandler = jest.fn().mockResolvedValue(undefined);
      pubsub.registerHandler('agent1', mockHandler);
      pubsub.registerHandler('agent1', newHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should subscribe an agent to a topic', () => {
      pubsub.subscribe('agent1', 'topic1');
      pubsub.registerHandler('agent1', mockHandler);
      return pubsub.publish('topic1', mockMessage).then(() => {
        expect(mockHandler).toHaveBeenCalledWith(mockMessage);
      });
    });

    it('should handle wildcard subscriptions', () => {
      pubsub.subscribe('agent1', 'topic.*');
      pubsub.registerHandler('agent1', mockHandler);
      return pubsub.publish('topic.test', mockMessage).then(() => {
        expect(mockHandler).toHaveBeenCalledWith(mockMessage);
      });
    });

    it('should throw error when subscription limit is exceeded', () => {
      const config = { maxSubscriptionsPerAgent: 1 };
      const limitedPubsub = new PubSubManager(config);
      limitedPubsub.subscribe('agent1', 'topic1');
      expect(() => limitedPubsub.subscribe('agent1', 'topic2')).toThrow(
        'Subscription limit exceeded'
      );
    });

    it('should throw error when topic limit is exceeded', () => {
      const config = { maxTopicsPerAgent: 1 };
      const limitedPubsub = new PubSubManager(config);
      limitedPubsub.subscribe('agent1', 'topic1');
      expect(() => limitedPubsub.subscribe('agent1', 'topic2')).toThrow(
        'Subscription limit exceeded'
      );
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe an agent from a topic', () => {
      pubsub.subscribe('agent1', 'topic1');
      pubsub.registerHandler('agent1', mockHandler);
      pubsub.unsubscribe('agent1', 'topic1');
      return pubsub.publish('topic1', mockMessage).then(() => {
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('should handle unsubscribing from non-existent topic', () => {
      expect(() => pubsub.unsubscribe('agent1', 'non-existent')).not.toThrow();
    });

    it('should handle unsubscribing from non-existent agent', () => {
      expect(() => pubsub.unsubscribe('non-existent', 'topic1')).not.toThrow();
    });
  });

  describe('publish', () => {
    it('should publish message to all subscribers', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      pubsub.subscribe('agent1', 'topic1');
      pubsub.subscribe('agent2', 'topic1');
      pubsub.registerHandler('agent1', handler1);
      pubsub.registerHandler('agent2', handler2);

      await pubsub.publish('topic1', mockMessage);

      expect(handler1).toHaveBeenCalledWith(mockMessage);
      expect(handler2).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle wildcard subscriptions', async () => {
      pubsub.subscribe('agent1', 'topic.*');
      pubsub.registerHandler('agent1', mockHandler);

      await pubsub.publish('topic.test', mockMessage);

      expect(mockHandler).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle missing message handler', async () => {
      pubsub.subscribe('agent1', 'topic1');

      await expect(pubsub.publish('topic1', mockMessage)).rejects.toThrow(
        'No message handler found for agent agent1'
      );
    });

    it('should handle handler errors', async () => {
      const error = new Error('Handler error');
      const errorHandler = jest.fn().mockRejectedValue(error);

      pubsub.subscribe('agent1', 'topic1');
      pubsub.registerHandler('agent1', errorHandler);

      await expect(pubsub.publish('topic1', mockMessage)).rejects.toThrow('Handler error');
    });

    it('should handle no subscribers', async () => {
      await expect(pubsub.publish('topic1', mockMessage)).resolves.not.toThrow();
    });
  });

  describe('wildcard matching', () => {
    it('should match exact topics', () => {
      pubsub.subscribe('agent1', 'topic1');
      pubsub.registerHandler('agent1', mockHandler);
      return pubsub.publish('topic1', mockMessage).then(() => {
        expect(mockHandler).toHaveBeenCalledWith(mockMessage);
      });
    });

    it('should match single wildcard', () => {
      pubsub.subscribe('agent1', 'topic.*');
      pubsub.registerHandler('agent1', mockHandler);
      return pubsub.publish('topic.test', mockMessage).then(() => {
        expect(mockHandler).toHaveBeenCalledWith(mockMessage);
      });
    });

    it('should match multiple wildcards', () => {
      pubsub.subscribe('agent1', '*.test.*');
      pubsub.registerHandler('agent1', mockHandler);
      return pubsub.publish('topic.test.123', mockMessage).then(() => {
        expect(mockHandler).toHaveBeenCalledWith(mockMessage);
      });
    });

    it('should not match invalid patterns', () => {
      pubsub.subscribe('agent1', 'topic.*');
      pubsub.registerHandler('agent1', mockHandler);
      return pubsub.publish('other.test', mockMessage).then(() => {
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });
});
