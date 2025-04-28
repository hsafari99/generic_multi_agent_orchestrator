import { MessageQueue } from '../core/communication/queue';
import { IMessage, MessageType } from '../core/interfaces';
import Redis from 'ioredis-mock';

// Mock logger
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

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return new Redis();
  });
});

describe('MessageQueue', () => {
  let queue: MessageQueue;
  let mockMessage: IMessage;

  beforeEach(async () => {
    // Create a fresh Redis instance for each test
    const redis = new Redis();
    await redis.flushall();

    queue = new MessageQueue({
      redisUrl: 'redis://localhost:6379',
      maxRetries: 2,
      retryDelay: 100,
      deadLetterQueue: 'dead-letter',
      maxQueueSize: 100,
      messageTTL: 3600,
    });

    mockMessage = {
      id: 'test-msg-1',
      type: MessageType.TASK,
      sender: 'test-sender',
      receiver: 'test-receiver',
      payload: { test: 'data' },
      timestamp: Date.now(),
      metadata: {
        priority: 1,
        requiresAck: true,
      },
    };
  });

  afterEach(async () => {
    await queue.shutdown();
  });

  describe('Basic Queue Operations', () => {
    it('should enqueue and dequeue messages', async () => {
      // Enqueue
      await queue.enqueue(mockMessage);
      const stats = await queue.getStats();
      expect(stats.queueSize).toBe(1);
      expect(stats.processingCount).toBe(0);
      expect(stats.deadLetterCount).toBe(0);

      // Dequeue
      const dequeued = await queue.dequeue();
      expect(dequeued).not.toBeNull();
      expect(dequeued?.message).toEqual(mockMessage);
      expect(dequeued?.retries).toBe(0);
      expect(dequeued?.status).toBe('processing');

      // Verify stats after dequeue
      const statsAfterDequeue = await queue.getStats();
      expect(statsAfterDequeue.queueSize).toBe(0);
      expect(statsAfterDequeue.processingCount).toBe(1);
      expect(statsAfterDequeue.deadLetterCount).toBe(0);
    });

    it('should handle message acknowledgment', async () => {
      await queue.enqueue(mockMessage);
      const dequeued = await queue.dequeue();
      expect(dequeued).not.toBeNull();

      await queue.acknowledge(mockMessage.id);

      const stats = await queue.getStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.processingCount).toBe(0);
      expect(stats.deadLetterCount).toBe(0);
    });

    it('should return null when queue is empty', async () => {
      const result = await queue.dequeue();
      expect(result).toBeNull();
    });

    it('should not return message that is being processed', async () => {
      await queue.enqueue(mockMessage);
      const first = await queue.dequeue();
      expect(first).not.toBeNull();
      const second = await queue.dequeue();
      expect(second).toBeNull();
    });

    it('should return messages in priority order', async () => {
      const msg1 = { ...mockMessage, id: 'msg1' };
      const msg2 = { ...mockMessage, id: 'msg2' };
      await queue.enqueue(msg1, 1);
      await queue.enqueue(msg2, 2);
      const first = await queue.dequeue();
      expect(first?.message.id).toBe('msg2'); // Higher priority first
    });
  });

  describe('Message Failure Handling', () => {
    it('should retry failed messages when under max retries', async () => {
      await queue.enqueue(mockMessage);
      const firstDequeue = await queue.dequeue();
      expect(firstDequeue).not.toBeNull();
      expect(firstDequeue?.retries).toBe(0);

      // First failure
      await queue.handleFailure(mockMessage.id);

      const statsAfterFirstFailure = await queue.getStats();
      expect(statsAfterFirstFailure.queueSize).toBe(1);
      expect(statsAfterFirstFailure.processingCount).toBe(0);
      expect(statsAfterFirstFailure.deadLetterCount).toBe(0);

      // Second dequeue
      const secondDequeue = await queue.dequeue();
      expect(secondDequeue).not.toBeNull();
      expect(secondDequeue?.retries).toBe(1);
      expect(secondDequeue?.status).toBe('processing');
    });

    it('should move message to dead letter queue after max retries', async () => {
      const config = { maxRetries: 1 };
      const limitedQueue = new MessageQueue(config);

      // First attempt
      await limitedQueue.enqueue(mockMessage);
      const firstDequeue = await limitedQueue.dequeue();
      expect(firstDequeue).not.toBeNull();
      expect(firstDequeue?.retries).toBe(0);

      await limitedQueue.handleFailure(mockMessage.id);

      // Second attempt (should move to dead letter)
      const secondDequeue = await limitedQueue.dequeue();
      expect(secondDequeue).not.toBeNull();
      expect(secondDequeue?.retries).toBe(1);

      await limitedQueue.handleFailure(mockMessage.id);

      const stats = await limitedQueue.getStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.processingCount).toBe(0);
      expect(stats.deadLetterCount).toBe(1);

      // Verify message is not in main queue
      const thirdDequeue = await limitedQueue.dequeue();
      expect(thirdDequeue).toBeNull();
    });

    it('should handle failure for non-existent message', async () => {
      await expect(queue.handleFailure('non-existent')).resolves.not.toThrow();
    });

    it('should track retry count correctly', async () => {
      const config = { maxRetries: 3 };
      const retryQueue = new MessageQueue(config);

      await retryQueue.enqueue(mockMessage);

      // First attempt
      const firstDequeue = await retryQueue.dequeue();
      expect(firstDequeue?.retries).toBe(0);
      await retryQueue.handleFailure(mockMessage.id);

      // Second attempt
      const secondDequeue = await retryQueue.dequeue();
      expect(secondDequeue?.retries).toBe(1);
      await retryQueue.handleFailure(mockMessage.id);

      // Third attempt
      const thirdDequeue = await retryQueue.dequeue();
      expect(thirdDequeue?.retries).toBe(2);
      await retryQueue.handleFailure(mockMessage.id);

      // Fourth attempt (should move to dead letter)
      const fourthDequeue = await retryQueue.dequeue();
      expect(fourthDequeue?.retries).toBe(3);
      await retryQueue.handleFailure(mockMessage.id);

      const stats = await retryQueue.getStats();
      expect(stats.deadLetterCount).toBe(1);
    });

    it('should maintain message state during retries', async () => {
      await queue.enqueue(mockMessage);

      // First attempt
      const firstDequeue = await queue.dequeue();
      expect(firstDequeue?.status).toBe('processing');
      await queue.handleFailure(mockMessage.id);

      // Check state after failure
      const secondDequeue = await queue.dequeue();
      expect(secondDequeue?.status).toBe('processing');
      expect(secondDequeue?.retries).toBe(1);

      // Acknowledge to verify state is maintained
      await queue.acknowledge(mockMessage.id);
      const stats = await queue.getStats();
      expect(stats.processingCount).toBe(0);
    });
  });

  describe('Queue Limits and Edge Cases', () => {
    it('should respect max queue size', async () => {
      const config = { maxQueueSize: 1 };
      const limitedQueue = new MessageQueue(config);

      await limitedQueue.enqueue(mockMessage);
      await expect(limitedQueue.enqueue(mockMessage)).rejects.toThrow('Queue is full');
    });

    it('should handle message TTL', async () => {
      const config = { messageTTL: 1 }; // 1 second TTL
      const ttlQueue = new MessageQueue(config);

      await ttlQueue.enqueue(mockMessage);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const dequeued = await ttlQueue.dequeue();
      expect(dequeued).toBeNull();
    });

    it('should handle non-existent messages', async () => {
      await expect(queue.acknowledge('non-existent')).resolves.not.toThrow();
      await expect(queue.handleFailure('non-existent')).resolves.not.toThrow();
    });

    it('should handle queue cleanup', async () => {
      await queue.enqueue(mockMessage);
      await queue.clear();

      const stats = await queue.getStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.processingCount).toBe(0);
      expect(stats.deadLetterCount).toBe(0);
    });

    it('should handle queue size limits', async () => {
      const config = { maxQueueSize: 1 };
      const limitedQueue = new MessageQueue(config);

      await limitedQueue.enqueue(mockMessage);
      await expect(limitedQueue.enqueue(mockMessage)).rejects.toThrow('Queue is full');
    });

    it('should handle message already being processed', async () => {
      await queue.enqueue(mockMessage);
      const firstDequeue = await queue.dequeue();
      expect(firstDequeue).not.toBeNull();

      // Try to dequeue the same message again
      const secondDequeue = await queue.dequeue();
      expect(secondDequeue).toBeNull();
    });

    it('should handle message not found in Redis during dequeue', async () => {
      await queue.enqueue(mockMessage);
      await queue.handleFailure(mockMessage.id);
      const dequeued = await queue.dequeue();
      expect(dequeued).not.toBeNull();
      expect(dequeued?.retries).toBe(1);
      expect(dequeued?.status).toBe('processing');
    });

    it('should handle message not found in Redis during failure', async () => {
      await queue.enqueue(mockMessage);
      await queue.handleFailure(mockMessage.id);
      const stats = await queue.getStats();
      expect(stats.processingCount).toBe(0);
    });

    it('should handle message exceeding max retries', async () => {
      const config = { maxRetries: 1 };
      const limitedQueue = new MessageQueue(config);

      await limitedQueue.enqueue(mockMessage);
      const firstDequeue = await limitedQueue.dequeue();
      expect(firstDequeue).not.toBeNull();

      await limitedQueue.handleFailure(mockMessage.id);
      const secondDequeue = await limitedQueue.dequeue();
      expect(secondDequeue).not.toBeNull();

      await limitedQueue.handleFailure(mockMessage.id);

      const stats = await limitedQueue.getStats();
      expect(stats.deadLetterCount).toBe(1);
      expect(stats.queueSize).toBe(0);
      expect(stats.processingCount).toBe(0);
    });

    it('should handle message retry with priority preservation', async () => {
      await queue.enqueue(mockMessage, 2);
      const firstDequeue = await queue.dequeue();
      expect(firstDequeue).not.toBeNull();

      await queue.handleFailure(mockMessage.id);

      const secondDequeue = await queue.dequeue();
      expect(secondDequeue).not.toBeNull();
      expect(secondDequeue?.message.id).toBe(mockMessage.id);
    });

    it('should handle Redis operation errors during message retry', async () => {
      const mockRedis = new Redis();
      mockRedis.zcard = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const badQueue = new MessageQueue();
      badQueue['redis'] = mockRedis;

      await expect(badQueue.enqueue(mockMessage)).rejects.toThrow('Connection failed');
    });

    it('should handle Redis operation errors during message acknowledgment', async () => {
      const mockRedis = new Redis();
      mockRedis.zrem = jest.fn().mockRejectedValue(new Error('Operation failed'));

      const badQueue = new MessageQueue();
      badQueue['redis'] = mockRedis;

      await badQueue.enqueue(mockMessage);
      const dequeued = await badQueue.dequeue();
      expect(dequeued).not.toBeNull();

      await expect(badQueue.acknowledge(mockMessage.id)).rejects.toThrow('Operation failed');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple enqueues', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
      }));

      // Enqueue all messages concurrently
      await Promise.all(messages.map(msg => queue.enqueue(msg)));

      const stats = await queue.getStats();
      expect(stats.queueSize).toBe(10);
      expect(stats.processingCount).toBe(0);
      expect(stats.deadLetterCount).toBe(0);
    });

    it('should handle multiple dequeues', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
      }));

      // Enqueue all messages
      await Promise.all(messages.map(msg => queue.enqueue(msg)));

      // Dequeue all messages concurrently
      const dequeued = await Promise.all(Array.from({ length: 10 }, () => queue.dequeue()));

      expect(dequeued.filter(Boolean)).toHaveLength(10);

      const stats = await queue.getStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.processingCount).toBe(10);
      expect(stats.deadLetterCount).toBe(0);
    });

    it('should handle concurrent enqueue and dequeue', async () => {
      const enqueuePromises = Array.from({ length: 5 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
      })).map(msg => queue.enqueue(msg));

      const dequeuePromises = Array.from({ length: 5 }, () => queue.dequeue());

      // Run enqueue and dequeue operations concurrently
      await Promise.all([...enqueuePromises, ...dequeuePromises]);

      const stats = await queue.getStats();
      expect(stats.queueSize + stats.processingCount).toBe(5);
      expect(stats.deadLetterCount).toBe(0);
    });

    it('should handle race conditions in retry mechanism', async () => {
      const config = { maxRetries: 2 };
      const retryQueue = new MessageQueue(config);

      await retryQueue.enqueue(mockMessage);
      const firstDequeue = await retryQueue.dequeue();
      expect(firstDequeue).not.toBeNull();

      // Simulate concurrent failure handling
      await Promise.all([
        retryQueue.handleFailure(mockMessage.id),
        retryQueue.handleFailure(mockMessage.id),
      ]);

      const stats = await retryQueue.getStats();
      expect(stats.queueSize).toBe(1);
      expect(stats.processingCount).toBe(0);
      expect(stats.deadLetterCount).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle Redis connection errors', async () => {
      const mockRedis = new Redis();
      mockRedis.zcard = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const badQueue = new MessageQueue({
        redisUrl: 'redis://invalid:6379',
      });
      badQueue['redis'] = mockRedis;

      await expect(badQueue.enqueue(mockMessage)).rejects.toThrow('Connection failed');
    });

    it('should handle Redis operation errors during dequeue', async () => {
      const mockRedis = new Redis();
      mockRedis.zpopmax = jest.fn().mockRejectedValue(new Error('Operation failed'));

      const badQueue = new MessageQueue();
      badQueue['redis'] = mockRedis;

      await expect(badQueue.dequeue()).rejects.toThrow('Operation failed');
    });

    it('should handle Redis operation errors during acknowledge', async () => {
      const mockRedis = new Redis();
      mockRedis.del = jest.fn().mockRejectedValue(new Error('Operation failed'));

      const badQueue = new MessageQueue();
      badQueue['redis'] = mockRedis;

      await expect(badQueue.acknowledge('test-id')).rejects.toThrow('Operation failed');
    });

    it('should handle Redis operation errors during failure handling', async () => {
      const mockRedis = new Redis();
      mockRedis.get = jest.fn().mockRejectedValue(new Error('Operation failed'));

      const badQueue = new MessageQueue();
      badQueue['redis'] = mockRedis;

      await expect(badQueue.handleFailure('test-id')).rejects.toThrow('Operation failed');
    });

    it('should handle Redis operation errors during stats retrieval', async () => {
      const mockRedis = new Redis();
      mockRedis.zcard = jest.fn().mockRejectedValue(new Error('Operation failed'));

      const badQueue = new MessageQueue();
      badQueue['redis'] = mockRedis;

      await expect(badQueue.getStats()).rejects.toThrow('Operation failed');
    });

    it('should handle Redis operation errors during queue cleanup', async () => {
      const mockRedis = new Redis();
      mockRedis.del = jest.fn().mockRejectedValue(new Error('Operation failed'));

      const badQueue = new MessageQueue();
      badQueue['redis'] = mockRedis;

      await expect(badQueue.clear()).rejects.toThrow('Operation failed');
    });

    it('should handle Redis operation errors during shutdown', async () => {
      const mockRedis = new Redis();
      mockRedis.quit = jest.fn().mockRejectedValue(new Error('Operation failed'));

      const badQueue = new MessageQueue();
      badQueue['redis'] = mockRedis;

      await expect(badQueue.shutdown()).rejects.toThrow('Operation failed');
    });

    it('should handle message priority changes during retry', async () => {
      await queue.enqueue(mockMessage, 1);
      const firstDequeue = await queue.dequeue();
      expect(firstDequeue).not.toBeNull();

      await queue.handleFailure(mockMessage.id);

      // Re-enqueue with different priority
      await queue.enqueue(mockMessage, 2);

      const secondDequeue = await queue.dequeue();
      expect(secondDequeue).not.toBeNull();
      expect(secondDequeue?.message.id).toBe(mockMessage.id);
    });

    it('should handle queue cleanup during processing', async () => {
      await queue.enqueue(mockMessage);
      const dequeued = await queue.dequeue();
      expect(dequeued).not.toBeNull();

      await queue.clear();

      const stats = await queue.getStats();
      expect(stats.queueSize).toBe(0);
      expect(stats.processingCount).toBe(0);
      expect(stats.deadLetterCount).toBe(0);
    });

    it('should handle multiple dead letter queues', async () => {
      const config = {
        maxRetries: 1,
        deadLetterQueue: 'custom-dead-letter',
      };
      const customQueue = new MessageQueue(config);

      await customQueue.enqueue(mockMessage);
      const dequeued = await customQueue.dequeue();
      expect(dequeued).not.toBeNull();

      await customQueue.handleFailure(mockMessage.id);
      const secondDequeue = await customQueue.dequeue();
      expect(secondDequeue).not.toBeNull();

      await customQueue.handleFailure(mockMessage.id);

      const stats = await customQueue.getStats();
      expect(stats.deadLetterCount).toBe(1);
    });

    it('should handle message retry with custom delay', async () => {
      const config = {
        retryDelay: 1000,
      };
      const delayedQueue = new MessageQueue(config);

      await delayedQueue.enqueue(mockMessage);
      const firstDequeue = await delayedQueue.dequeue();
      expect(firstDequeue).not.toBeNull();

      await delayedQueue.handleFailure(mockMessage.id);

      // Message should be available for retry immediately
      const retryDequeue = await delayedQueue.dequeue();
      expect(retryDequeue).not.toBeNull();
      expect(retryDequeue?.retries).toBe(1);
      expect(retryDequeue?.nextAttempt).toBeGreaterThan(Date.now());
    });
  });
});
