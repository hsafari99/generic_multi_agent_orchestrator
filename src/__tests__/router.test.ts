import { MessageRouter } from '../core/communication/router';
import { IMessage, MessageType } from '../core/interfaces';

jest.mock('../core/logging/logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

describe('MessageRouter', () => {
  let router: MessageRouter;
  let mockMessage: IMessage;

  beforeEach(() => {
    router = new MessageRouter();
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
  });

  describe('registerAgent', () => {
    it('should register an agent for topics', () => {
      router.registerAgent('agent1', ['topic1', 'topic2']);
      router.registerAgent('agent2', ['topic1']);

      const result = router.routeMessage({
        ...mockMessage,
        receiver: 'all',
        metadata: { ...mockMessage.metadata, topic: 'topic1' },
      });

      expect(result.success).toBe(true);
    });

    it('should handle duplicate registrations', () => {
      router.registerAgent('agent1', ['topic1']);
      router.registerAgent('agent1', ['topic1']);

      const result = router.routeMessage({
        ...mockMessage,
        receiver: 'all',
        metadata: { ...mockMessage.metadata, topic: 'topic1' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister an agent from topics', () => {
      router.registerAgent('agent1', ['topic1', 'topic2']);
      router.unregisterAgent('agent1', ['topic1']);

      const result = router.routeMessage({
        ...mockMessage,
        receiver: 'all',
        metadata: { ...mockMessage.metadata, topic: 'topic1' },
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('NO_AGENTS_FOUND');
    });

    it('should handle unregistering from non-existent topics', () => {
      router.registerAgent('agent1', ['topic1']);
      router.unregisterAgent('agent1', ['non-existent']);

      const result = router.routeMessage({
        ...mockMessage,
        receiver: 'all',
        metadata: { ...mockMessage.metadata, topic: 'topic1' },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('routeMessage', () => {
    it('should route broadcast messages to all agents', () => {
      router.registerAgent('agent1', ['topic1']);
      router.registerAgent('agent2', ['topic2']);

      const result = router.routeMessage({
        ...mockMessage,
        receiver: 'all',
      });

      expect(result.success).toBe(true);
    });

    it('should route topic-based messages to subscribed agents', () => {
      router.registerAgent('agent1', ['topic1']);
      router.registerAgent('agent2', ['topic2']);

      const result = router.routeMessage({
        ...mockMessage,
        receiver: 'all',
        metadata: { ...mockMessage.metadata, topic: 'topic1' },
      });

      expect(result.success).toBe(true);
    });

    it('should route direct messages to specific agent', () => {
      router.registerAgent('agent1', ['topic1']);

      const result = router.routeMessage({
        ...mockMessage,
        receiver: 'agent1',
      });

      expect(result.success).toBe(true);
    });

    it('should validate message size', () => {
      const largeMessage = {
        ...mockMessage,
        payload: { data: 'x'.repeat(2 * 1024 * 1024) }, // 2MB
      };

      const result = router.routeMessage(largeMessage);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_MESSAGE');
    });

    it('should validate message priority', () => {
      const invalidPriorityMessage = {
        ...mockMessage,
        metadata: { ...mockMessage.metadata, priority: 20 },
      };

      const result = router.routeMessage(invalidPriorityMessage);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_MESSAGE');
    });

    it('should handle missing required fields', () => {
      const invalidMessage = {
        ...mockMessage,
        id: undefined,
      };

      const result = router.routeMessage(invalidMessage as unknown as IMessage);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_MESSAGE');
    });
  });
});
