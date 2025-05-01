import { A2AProtocol, A2AMessage } from '../core/protocols/a2a';
import { PostgresClient } from '../core/storage/postgres';
import { RedisClient } from '../core/cache/client';
import { MessageEncryption } from '../core/security/encryption';
import dotenv from 'dotenv';
import { RateLimiter } from '../core/security/rate-limiter';

// Load environment variables from .env file
dotenv.config();

// Check if we're in a CI environment
const isCI = process.env.CI === 'true';

describe('A2AProtocol Integration', () => {
  let protocol1: A2AProtocol;
  let protocol2: A2AProtocol;
  let postgres: PostgresClient;
  let redis: RedisClient;
  let encryptionKey: string;

  beforeAll(async () => {
    // Initialize real database and cache connections
    postgres = new PostgresClient({
      connectionString:
        process.env.DATABASE_URL || 'postgresql://test_user:test_password@localhost:5432/test_db',
      maxConnections: 20,
      idleTimeoutMillis: 30000,
    });

    try {
      redis = RedisClient.getInstance({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        connection: {
          maxRetries: 3,
          retryDelay: 1000,
          connectTimeout: 5000,
        },
        cache: {
          defaultTTL: 3600,
          maxKeys: 10000,
          keyPrefix: 'a2a:',
        },
      });

      // Connect to Redis
      await redis.connect();
    } catch (error) {
      if (isCI) {
        // In CI, create a mock Redis client
        redis = {
          connect: jest.fn().mockResolvedValue(undefined),
          disconnect: jest.fn().mockResolvedValue(undefined),
          isClientConnected: jest.fn().mockReturnValue(true),
          getClient: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1),
          }),
        } as unknown as RedisClient;
      } else {
        // In local environment, throw the error
        throw error;
      }
    }

    // Create two protocol instances for testing communication
    encryptionKey = MessageEncryption.generateKey();

    protocol1 = new A2AProtocol({
      postgres,
      redis,
      agentId: 'agent1',
      checkInterval: 1000,
      encryptionKey,
      rateLimit: {
        tokensPerInterval: 1000,
        interval: 60000,
        maxTokens: 10,
      },
      loadBalancing: {
        strategy: 'round-robin',
      },
      compression: {
        threshold: 1024,
        level: 6,
      },
    });

    protocol2 = new A2AProtocol({
      postgres,
      redis,
      agentId: 'agent2',
      checkInterval: 1000,
      encryptionKey,
      rateLimit: {
        tokensPerInterval: 1000,
        interval: 60000,
        maxTokens: 10,
      },
      compression: {
        threshold: 1024,
        level: 6,
      },
    });

    // Initialize protocols
    await protocol1.initialize();
    await protocol2.initialize();

    // Create required tables and initial data
    await postgres.query(`
      CREATE TABLE IF NOT EXISTS a2a_peers (
        agent_id VARCHAR(255) PRIMARY KEY,
        last_seen TIMESTAMP,
        status VARCHAR(50)
      );
      
      CREATE TABLE IF NOT EXISTS a2a_peer_load (
        agent_id VARCHAR(255) PRIMARY KEY REFERENCES a2a_peers(agent_id),
        message_count INTEGER DEFAULT 0,
        last_update TIMESTAMP,
        weight FLOAT DEFAULT 1.0
      );
    `);
  });

  afterAll(async () => {
    try {
      // Stop all protocols first
      if (protocol1) {
        await protocol1.stop();
      }
      if (protocol2) {
        await protocol2.stop();
      }

      // Wait for any pending operations to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Then close database connections
      if (postgres) {
        await postgres.shutdown();
      }
      if (redis) {
        await redis.getClient().quit();
      }
    } catch (error) {
      // Error during cleanup
    }
  });

  beforeEach(async () => {
    // Clear database and cache before each test
    await postgres.query(
      'TRUNCATE a2a_messages, a2a_peers, a2a_peer_load, a2a_security_events, a2a_security_metrics CASCADE'
    );
    await redis.getClient().flushAll();

    // Re-insert required peer data
    await postgres.query(`
      INSERT INTO a2a_peers (agent_id, last_seen, status)
      VALUES 
        ('agent1', CURRENT_TIMESTAMP, 'active'),
        ('agent2', CURRENT_TIMESTAMP, 'active')
      ON CONFLICT (agent_id) DO UPDATE SET
        last_seen = CURRENT_TIMESTAMP,
        status = 'active';
    `);
  });

  describe('End-to-End Communication', () => {
    it('should establish peer connection and exchange messages', async () => {
      try {
        // Start both protocols
        await protocol1.start();
        await protocol2.start();

        // Wait for peer discovery
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify peers are discovered
        const peers1 = await protocol1.listPeers();
        const peers2 = await protocol2.listPeers();

        expect(peers1).toContain('agent2');
        expect(peers2).toContain('agent1');

        // Send message from agent1 to agent2
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request' as const,
          sender: 'agent1',
          recipient: 'agent2',
          payload: { action: 'test' },
          metadata: { priority: 'high' },
        };

        const sentMessage = (await protocol1.sendMessage(message)) as unknown as A2AMessage;

        expect(sentMessage).toBeDefined();
        expect(sentMessage.id).toBeDefined();

        // Wait longer for message processing and database operations
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get the message ID from the database
        const result = await postgres.query<{ id: string }[]>(
          'SELECT id FROM a2a_messages WHERE sender = $1 AND recipient = $2 ORDER BY timestamp DESC LIMIT 1',
          [message.sender, message.recipient]
        );

        expect(result).toHaveLength(1);
        const messageId = result[0].id;

        // Verify message was received by agent2
        const receivedMessages = await protocol2.receiveMessage(messageId);

        expect(receivedMessages).toBeDefined();
        expect(receivedMessages?.payload).toEqual({ action: 'test' });
      } finally {
        // Stop protocols before test ends
        await protocol1.stop();
        await protocol2.stop();
        // Wait for background operations to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }, 10000); // Increase timeout to 10 seconds

    it('should handle message encryption and compression', async () => {
      try {
        // Start both protocols
        await protocol1.start();
        await protocol2.start();

        // Send a large message that should be compressed
        const largeMessage: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request' as const,
          sender: 'agent1',
          recipient: 'agent2',
          payload: { data: 'x'.repeat(1000) },
        };

        const sentMessage = (await protocol1.sendMessage(largeMessage)) as unknown as A2AMessage;

        expect(sentMessage).toBeDefined();
        expect(sentMessage.id).toBeDefined();

        // Wait for message processing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify message was received and decrypted
        const receivedMessages = await protocol2.receiveMessage(sentMessage.id);

        expect(receivedMessages).toBeDefined();
        expect(receivedMessages?.payload).toEqual({ data: 'x'.repeat(1000) });
      } finally {
        // Stop protocols before test ends
        await protocol1.stop();
        await protocol2.stop();
        // Wait for background operations to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    });

    it('should handle rate limiting across multiple agents', async () => {
      // Start both protocols
      await protocol1.start();
      await protocol2.start();

      // Send multiple messages quickly
      const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
        type: 'request' as const,
        sender: 'agent1',
        recipient: 'agent2',
        payload: { action: 'test' },
      };

      // Send 10 messages (within rate limit)
      for (let i = 0; i < 10; i++) {
        await protocol1.sendMessage(message);
      }

      // Mock rate limiter to reject the next request
      jest.spyOn(RateLimiter.prototype, 'acquireToken').mockResolvedValueOnce(false);
      jest.spyOn(RateLimiter.prototype, 'getTimeUntilNextToken').mockReturnValueOnce(1000);

      // Try to send one more (should fail)
      await expect(protocol1.sendMessage(message)).rejects.toThrow('Rate limit exceeded');

      // Wait for rate limit reset
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should be able to send again
      await expect(protocol1.sendMessage(message)).resolves.not.toThrow();
    });

    it('should handle load balancing with multiple peers', async () => {
      // Create a third agent with same encryption key
      const protocol3 = new A2AProtocol({
        postgres,
        redis,
        agentId: 'agent3',
        checkInterval: 1000,
        encryptionKey,
        loadBalancing: {
          strategy: 'round-robin',
        },
        compression: {
          threshold: 1024,
          level: 6,
        },
      });

      try {
        // Start all protocols in parallel
        await Promise.all([protocol3.initialize(), protocol1.start(), protocol2.start()]);
        await protocol3.start();

        // Register all peers in the database with proper status
        await postgres.query(`
          INSERT INTO a2a_peers (agent_id, last_seen, status)
          VALUES 
            ('agent1', CURRENT_TIMESTAMP, 'active'),
            ('agent2', CURRENT_TIMESTAMP, 'active'),
            ('agent3', CURRENT_TIMESTAMP, 'active')
          ON CONFLICT (agent_id) DO UPDATE SET
            last_seen = CURRENT_TIMESTAMP,
            status = 'active';
        `);

        // Initialize peer load records for all peers
        await postgres.query(`
          INSERT INTO a2a_peer_load (agent_id, message_count, last_update, weight)
          VALUES 
            ('agent1', 0, CURRENT_TIMESTAMP, 1.0),
            ('agent2', 0, CURRENT_TIMESTAMP, 1.0),
            ('agent3', 0, CURRENT_TIMESTAMP, 1.0)
          ON CONFLICT (agent_id) DO UPDATE SET
            message_count = 0,
            last_update = CURRENT_TIMESTAMP;
        `);

        // Wait for peer discovery
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Send multiple messages
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request' as const,
          sender: 'agent1',
          recipient: 'any',
          payload: { action: 'test' },
        };

        const sentRecipients = new Set<string>();
        for (let i = 0; i < 6; i++) {
          const sentMessage = await protocol1.sendMessage(message);
          sentRecipients.add(sentMessage.recipient);
        }

        // Should have used both peers
        expect(sentRecipients.size).toBe(2);
        expect(sentRecipients).toContain('agent2');
        expect(sentRecipients).toContain('agent3');
      } finally {
        // Stop all protocols in parallel
        await Promise.all([protocol1.stop(), protocol2.stop(), protocol3.stop()]);
      }
    }, 10000); // Increase timeout to 10 seconds

    it('should handle security events and metrics', async () => {
      // Start both protocols
      await protocol1.start();
      await protocol2.start();

      // Send a message with invalid encryption
      const invalidMessage: Omit<A2AMessage, 'id' | 'timestamp'> = {
        type: 'request' as const,
        sender: 'agent1',
        recipient: 'agent2',
        payload: { action: 'test' },
      };

      // Temporarily modify encryption key to cause failure
      const originalEncryption = protocol1['encryption'];
      // Use a properly formatted but invalid key (all zeros)
      protocol1['encryption'] = new MessageEncryption('0'.repeat(64));

      // Mock the encryption to throw an error
      jest.spyOn(MessageEncryption.prototype, 'encrypt').mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      await expect(protocol1.sendMessage(invalidMessage)).rejects.toThrow('Encryption failed');

      // Restore original encryption
      protocol1['encryption'] = originalEncryption;

      // Verify security event was logged
      const events = await protocol1.getSecurityEvents({
        type: 'encryption',
        limit: 1,
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('encryption');
      expect(events[0].severity).toBe('high');

      // Verify metrics were updated
      const metrics = await protocol1.getSecurityMetrics();
      expect(metrics.encryptionFailures).toBe(1);
    });
  });
});
