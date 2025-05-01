import { A2AProtocol, A2AMessage } from '../core/protocols/a2a';
import { PostgresClient } from '../core/storage/postgres';
import { RedisClient } from '../core/cache/client';
import { Logger } from '../core/logging/logger';
import { MessageEncryption } from '../core/security/encryption';
import { MessageCompression } from '../core/security/compression';
import { RateLimiter } from '../core/security/rate-limiter';

jest.mock('../core/storage/postgres');
jest.mock('../core/cache/client');
jest.mock('../core/logging/logger');

describe('A2AProtocol', () => {
  let protocol: A2AProtocol;
  let mockPostgres: jest.Mocked<PostgresClient>;
  let mockRedis: jest.Mocked<RedisClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PostgresClient>;

    // Mock Redis client
    const mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    mockRedis = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isClientConnected: jest.fn().mockReturnValue(true),
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);

    protocol = new A2AProtocol({
      postgres: mockPostgres,
      redis: mockRedis,
      agentId: 'test-agent',
      checkInterval: 1000,
      encryptionKey: '0'.repeat(64),
      rateLimit: {
        tokensPerInterval: 1000,
        interval: 60000,
        maxTokens: 2,
      },
    });
  });

  describe('initialization', () => {
    it('should create tables on initialize', async () => {
      // Mock both postgres queries
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]); // loadPeers

      await protocol.initialize();
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS a2a_messages')
      );
    });

    it('should load peers on initialize', async () => {
      const mockPeers = [
        { agent_id: 'peer1', status: 'active' },
        { agent_id: 'peer2', status: 'inactive' },
      ];

      // Mock both postgres queries
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce(mockPeers); // loadPeers

      await protocol.initialize();
      const peers = await protocol.listPeers();
      expect(peers).toHaveLength(2);
      expect(peers).toContain('peer1');
      expect(peers).toContain('peer2');
    });

    it('should handle initialization errors', async () => {
      mockPostgres.query.mockRejectedValueOnce(new Error('Database error'));
      await expect(protocol.initialize()).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('peer management', () => {
    it('should check peers periodically', async () => {
      const mockPeers = [
        { agent_id: 'peer1', status: 'active' },
        { agent_id: 'peer2', status: 'active' },
      ];

      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce(mockPeers) // checkPeers
        .mockResolvedValueOnce([]) // update own status
        .mockResolvedValueOnce(mockPeers) // interval checkPeers
        .mockResolvedValueOnce([]); // update own status

      await protocol.initialize();
      await protocol.start();

      // Wait for first check
      await new Promise(resolve => setTimeout(resolve, 100));

      const peers = await protocol.listPeers();
      expect(peers).toHaveLength(2);
      expect(peers).toContain('peer1');
      expect(peers).toContain('peer2');
    });

    it('should stop checking peers', async () => {
      // Mock both postgres queries
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]) // initial checkPeers
        .mockResolvedValueOnce([]) // update own status
        .mockResolvedValueOnce([]) // interval checkPeers
        .mockResolvedValueOnce([]); // update own status

      await protocol.initialize();
      await protocol.start();
      await protocol.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping A2A Protocol');
    });

    it('should handle peer check errors', async () => {
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockRejectedValueOnce(new Error('Check peers error')); // checkPeers

      await protocol.initialize();

      // Set up error event listener
      const errorHandler = jest.fn();
      protocol.on('error', errorHandler);

      await protocol.start();

      // Wait for the error to be emitted
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLogger.error).toHaveBeenCalledWith('Error checking peers', expect.any(Error));
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));

      // Clean up
      await protocol.stop();
    });

    it('should get peer status', async () => {
      const mockPeers = [
        { agent_id: 'peer1', status: 'active' },
        { agent_id: 'peer2', status: 'inactive' },
      ];

      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce(mockPeers); // loadPeers

      await protocol.initialize();
      expect(await protocol.getPeerStatus('peer1')).toBe(true);
      expect(await protocol.getPeerStatus('peer2')).toBe(false);
      expect(await protocol.getPeerStatus('nonexistent')).toBe(false);
    });
  });

  describe('message handling', () => {
    it('should send and receive messages', async () => {
      // Mock database queries for initialization
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]); // insert message

      // Initialize protocol
      await protocol.initialize();

      // Send a test message
      const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
        type: 'request' as const,
        sender: 'test-agent',
        recipient: 'peer1',
        payload: { action: 'test' },
        metadata: { priority: 'high' },
      };

      await protocol.sendMessage(message);

      // Verify the message was stored in the database
      const dbCalls = mockPostgres.query.mock.calls;
      const insertCall = dbCalls.find(call => call[0].includes('INSERT INTO a2a_messages'));

      expect(insertCall).toBeDefined();
      expect(insertCall![1]).toEqual([
        expect.any(String), // id
        message.type,
        message.sender,
        message.recipient,
        expect.any(Date),
        expect.stringMatching(
          /{"compressed":false,"data":".*","originalSize":\d+,"compressedSize":\d+}/
        ),
        JSON.stringify(message.metadata),
      ]);
    });

    it('should get message from cache if available', async () => {
      const messageId = 'test-message-id';
      const cachedMessage: A2AMessage = {
        id: messageId,
        type: 'request',
        sender: 'test-agent',
        recipient: 'peer1',
        timestamp: Date.now(),
        payload: { action: 'test' },
        metadata: { priority: 'high' },
      };

      (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedMessage));

      const message = await protocol.receiveMessage(messageId);
      expect(message).toEqual(cachedMessage);
      expect(mockPostgres.query).not.toHaveBeenCalled();
    });

    it('should get message from database if not in cache', async () => {
      const messageId = 'test-message-id';
      const dbMessage = [
        {
          id: messageId,
          type: 'request',
          sender: 'test-agent',
          recipient: 'peer1',
          timestamp: new Date(),
          payload: {
            id: messageId,
            type: 'request',
            sender: 'test-agent',
            recipient: 'peer1',
            timestamp: Date.now(),
            payload: { action: 'test' },
            metadata: { priority: 'high' },
          },
          metadata: { priority: 'high' },
        },
      ];

      (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(null);
      mockPostgres.query.mockResolvedValueOnce(dbMessage);

      const message = await protocol.receiveMessage(messageId);
      expect(message).toBeDefined();
      expect(message?.id).toBe(messageId);
      expect(message?.type).toBe('request');
      expect(message?.sender).toBe('test-agent');
      expect(message?.recipient).toBe('peer1');
      expect(message?.payload).toEqual({ action: 'test' });
      expect(message?.metadata).toEqual({ priority: 'high' });
    });

    it('should handle message send errors', async () => {
      const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
        type: 'request' as const,
        sender: 'test-agent',
        recipient: 'peer1',
        payload: { action: 'test' },
      };

      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockRejectedValueOnce(new Error('Send message error')); // insert message

      await protocol.initialize();
      await expect(protocol.sendMessage(message)).rejects.toThrow('Send message error');
    });

    it('should handle message receive errors', async () => {
      const messageId = 'test-message-id';

      // Initialize protocol first
      await protocol.initialize();

      // Mock Redis to throw error
      (mockRedis.getClient().get as jest.Mock).mockRejectedValueOnce(new Error('Cache error'));

      // Mock database response
      const mockMessage = {
        id: messageId,
        type: 'request',
        sender: 'test-agent',
        recipient: 'peer1',
        timestamp: new Date(),
        payload: JSON.stringify({
          compressed: false,
          data: 'test data',
          originalSize: 100,
          compressedSize: 100,
        }),
        metadata: { priority: 'high' },
      };
      mockPostgres.query.mockResolvedValueOnce([mockMessage]);

      // Set up error event listener
      const errorHandler = jest.fn();
      protocol.on('error', errorHandler);

      await expect(protocol.receiveMessage(messageId)).rejects.toThrow('Cache error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error receiving message', expect.any(Error));
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle different message types', async () => {
      const messageTypes: Array<A2AMessage['type']> = ['request', 'response', 'notification'];
      const noRateLimitProtocol = new A2AProtocol({
        postgres: mockPostgres,
        redis: mockRedis,
        agentId: 'test-agent',
        checkInterval: 1000,
      });

      for (const type of messageTypes) {
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type,
          sender: 'test-agent',
          recipient: 'peer1',
          payload: { action: 'test' },
        };

        mockPostgres.query
          .mockResolvedValueOnce([]) // createTables
          .mockResolvedValueOnce([]) // loadPeers
          .mockResolvedValueOnce([]); // insert message

        await noRateLimitProtocol.initialize();
        await noRateLimitProtocol.sendMessage(message);

        expect(mockPostgres.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO a2a_messages'),
          expect.arrayContaining([type])
        );
      }
    });

    describe('encryption', () => {
      it('should encrypt messages when sending', async () => {
        // Mock database queries for initialization
        mockPostgres.query
          .mockResolvedValueOnce([]) // createTables
          .mockResolvedValueOnce([]) // loadPeers
          .mockResolvedValueOnce([]); // insert message

        // Initialize protocol
        await protocol.initialize();

        // Send a test message
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request' as const,
          sender: 'test-agent',
          recipient: 'peer1',
          payload: { test: 'data' },
          metadata: { priority: 'high' },
        };

        await protocol.sendMessage(message);

        // Verify the message was encrypted and stored
        const dbCalls = mockPostgres.query.mock.calls;
        const insertCall = dbCalls.find(call => call[0].includes('INSERT INTO a2a_messages'));

        expect(insertCall).toBeDefined();
        expect(insertCall![1]).toEqual([
          expect.any(String), // id
          message.type,
          message.sender,
          message.recipient,
          expect.any(Date),
          expect.stringContaining('"compressed":false,"data":"{\\"encryptedData\\":'),
          JSON.stringify(message.metadata),
        ]);
      });

      it('should decrypt messages when receiving', async () => {
        const messageId = 'test-message-id';
        const originalPayload = {
          compressed: false,
          data: {
            encryptedData: 'encrypted-data',
            iv: 'initialization-vector',
            algorithm: 'aes-256-gcm',
          },
          originalSize: 100,
          compressedSize: 100,
        };

        // Create a properly formatted encrypted message
        const encryptedMessage = {
          encryptedData: 'encrypted-data',
          iv: 'initialization-vector',
          algorithm: 'aes-256-gcm',
        };

        // Mock Redis to return null (message not in cache)
        (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(null);

        // Mock database response with the encrypted message
        const dbResponse = {
          id: messageId,
          type: 'request',
          sender: 'test-agent',
          recipient: 'peer1',
          timestamp: new Date(),
          payload: JSON.stringify({
            compressed: false,
            data: encryptedMessage,
            originalSize: 100,
            compressedSize: 100,
          }),
          metadata: { priority: 'high' },
        };

        mockPostgres.query.mockResolvedValueOnce([dbResponse]);

        // Mock decrypt to return the original payload
        const mockDecrypt = jest
          .spyOn(MessageEncryption.prototype, 'decrypt')
          .mockImplementation(() => {
            return JSON.stringify({
              id: messageId,
              type: 'request',
              sender: 'test-agent',
              recipient: 'peer1',
              timestamp: Date.now(),
              payload: originalPayload,
              metadata: { priority: 'high' },
            });
          });

        const receivedMessage = await protocol.receiveMessage(messageId);

        expect(receivedMessage).toBeDefined();
        expect(receivedMessage?.payload).toEqual(originalPayload);
        expect(mockDecrypt).toHaveBeenCalled();
        expect(mockDecrypt).toHaveBeenCalledWith(
          expect.objectContaining({
            encryptedData: 'encrypted-data',
            iv: 'initialization-vector',
            algorithm: 'aes-256-gcm',
          })
        );
      });

      it('should handle encryption errors', async () => {
        const messageId = 'test-message-id';

        // Create a properly formatted encrypted message
        const encryptedMessage = {
          encryptedData: 'invalid',
          iv: 'invalid',
          algorithm: 'aes-256-gcm',
          authTag: 'invalid',
        };

        // Mock database response with a valid message structure
        const dbResponse = {
          id: messageId,
          type: 'request',
          sender: 'test-agent',
          recipient: 'peer1',
          timestamp: new Date(),
          payload: JSON.stringify({
            compressed: false,
            data: encryptedMessage,
            originalSize: 100,
            compressedSize: 100,
          }),
          metadata: { priority: 'high' },
        };

        // Mock Redis to return null (message not in cache)
        (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(null);
        // Mock database query to return the encrypted message
        mockPostgres.query.mockResolvedValueOnce([dbResponse]);

        // Mock decrypt to throw an error
        jest.spyOn(MessageEncryption.prototype, 'decrypt').mockImplementation(() => {
          throw new Error('Decryption failed');
        });

        await expect(protocol.receiveMessage(messageId)).rejects.toThrow('Decryption failed');
      });
    });

    describe('rate limiting', () => {
      let rateLimitedProtocol: A2AProtocol;

      beforeEach(() => {
        rateLimitedProtocol = new A2AProtocol({
          postgres: mockPostgres,
          redis: mockRedis,
          agentId: 'test-agent',
          checkInterval: 1000,
          rateLimit: {
            tokensPerInterval: 1000,
            interval: 60000,
            maxTokens: 2,
          },
        });
      });

      it('should allow messages within rate limit', async () => {
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request' as const,
          sender: 'test-agent',
          recipient: 'peer1',
          payload: { action: 'test' },
        };

        // Mock database responses in sequence
        mockPostgres.query
          .mockResolvedValueOnce([]) // createTables
          .mockResolvedValueOnce([]) // loadPeers
          .mockResolvedValueOnce([]) // first message insert
          .mockResolvedValueOnce([]) // first message peer load update
          .mockResolvedValueOnce([]) // second message insert
          .mockResolvedValueOnce([]); // second message peer load update

        await rateLimitedProtocol.initialize();

        await rateLimitedProtocol.sendMessage(message);
        await rateLimitedProtocol.sendMessage(message);

        expect(mockPostgres.query).toHaveBeenCalledTimes(8);
      });

      it('should reject messages exceeding rate limit', async () => {
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request' as const,
          sender: 'test-agent',
          recipient: 'peer1',
          payload: { action: 'test' },
        };

        mockPostgres.query
          .mockResolvedValueOnce([]) // createTables
          .mockResolvedValueOnce([]) // loadPeers
          .mockResolvedValueOnce([]) // insert message
          .mockResolvedValueOnce([]); // insert message

        await rateLimitedProtocol.initialize();
        await rateLimitedProtocol.sendMessage(message);
        await rateLimitedProtocol.sendMessage(message);

        await expect(rateLimitedProtocol.sendMessage(message)).rejects.toThrow(
          'Rate limit exceeded'
        );
      });

      it('should allow messages after rate limit interval', async () => {
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request' as const,
          sender: 'test-agent',
          recipient: 'peer1',
          payload: { action: 'test' },
        };

        // Mock database responses in sequence
        mockPostgres.query
          .mockResolvedValueOnce([]) // createTables
          .mockResolvedValueOnce([]) // loadPeers
          .mockResolvedValueOnce([]) // first message insert
          .mockResolvedValueOnce([]) // first message peer load update
          .mockResolvedValueOnce([]) // second message insert
          .mockResolvedValueOnce([]) // second message peer load update
          .mockResolvedValueOnce([]) // third message insert
          .mockResolvedValueOnce([]); // third message peer load update

        await rateLimitedProtocol.initialize();
        await rateLimitedProtocol.sendMessage(message);
        await rateLimitedProtocol.sendMessage(message);

        // Wait for rate limit interval
        await new Promise(resolve => setTimeout(resolve, 1000));

        await rateLimitedProtocol.sendMessage(message);
        expect(mockPostgres.query).toHaveBeenCalledTimes(11);
      });
    });

    describe('compression', () => {
      let compressedProtocol: A2AProtocol;

      beforeEach(() => {
        compressedProtocol = new A2AProtocol({
          postgres: mockPostgres,
          redis: mockRedis,
          agentId: 'test-agent',
          checkInterval: 1000,
          compression: {
            threshold: 100,
            level: 6,
          },
        });
      });

      it('should not compress small messages', async () => {
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request' as const,
          sender: 'test-agent',
          recipient: 'peer1',
          payload: { action: 'test' },
        };

        mockPostgres.query
          .mockResolvedValueOnce([]) // createTables
          .mockResolvedValueOnce([]) // loadPeers
          .mockResolvedValueOnce([]); // insert message

        await compressedProtocol.initialize();
        await compressedProtocol.sendMessage(message);

        // Verify message was not compressed
        expect(mockPostgres.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO a2a_messages'),
          expect.arrayContaining([
            expect.any(String), // id
            'request',
            'test-agent',
            'peer1',
            expect.any(Date),
            expect.stringMatching(
              /{"compressed":false,"data":".*","originalSize":\d+,"compressedSize":\d+}/
            ),
            expect.any(String),
          ])
        );
      });

      it('should compress large messages', async () => {
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request' as const,
          sender: 'test-agent',
          recipient: 'peer1',
          payload: { data: 'x'.repeat(200) },
        };

        mockPostgres.query
          .mockResolvedValueOnce([]) // createTables
          .mockResolvedValueOnce([]) // loadPeers
          .mockResolvedValueOnce([]); // insert message

        await compressedProtocol.initialize();
        await compressedProtocol.sendMessage(message);

        // Verify message was compressed
        expect(mockPostgres.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO a2a_messages'),
          expect.arrayContaining([
            expect.any(String), // id
            'request',
            'test-agent',
            'peer1',
            expect.any(Date),
            expect.stringMatching(
              /{"compressed":true,"data":".*","originalSize":\d+,"compressedSize":\d+}/
            ),
            expect.any(String),
          ])
        );
      });

      it('should decompress messages when receiving', async () => {
        const messageId = 'test-message-id';
        const originalMessage: A2AMessage = {
          id: messageId,
          type: 'request',
          sender: 'test-agent',
          recipient: 'peer1',
          timestamp: Date.now(),
          payload: { data: 'x'.repeat(200) },
        };

        const compression = new MessageCompression({ threshold: 100 });
        const compressedMessage = await compression.compress(JSON.stringify(originalMessage));

        (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(compressedMessage)
        );

        const message = await compressedProtocol.receiveMessage(messageId);
        expect(message).toEqual(originalMessage);
      });
    });
  });

  describe('A2A Protocol Load Balancing', () => {
    let a2a: A2AProtocol;

    beforeEach(async () => {
      // Mock database responses for initialization
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]); // loadPeers

      a2a = new A2AProtocol({
        postgres: mockPostgres,
        redis: mockRedis,
        agentId: 'test-agent',
        checkInterval: 1000,
        loadBalancing: {
          strategy: 'round-robin',
          weights: {
            peer1: 2.0,
            peer2: 1.0,
            peer3: 1.5,
          },
        },
      });
      await a2a.initialize();
    });

    afterEach(async () => {
      await a2a.stop();
    });

    it('should create peer load table during initialization', async () => {
      // Mock database responses
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([{ exists: true }]); // table existence check

      await a2a.initialize();

      // Mock the table existence check
      mockPostgres.query.mockResolvedValueOnce([{ exists: true }]);

      const result = await mockPostgres.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'a2a_peer_load'
        );
      `);

      expect(result[0].exists).toBe(true);
    });

    it('should update peer load metrics when sending messages', async () => {
      // Mock database responses
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]) // insert peers
        .mockResolvedValueOnce([]) // first message
        .mockResolvedValueOnce([]) // second message
        .mockResolvedValueOnce([
          { agent_id: 'peer1', message_count: 1, weight: 2.0 },
          { agent_id: 'peer2', message_count: 1, weight: 1.0 },
          { agent_id: 'peer3', message_count: 0, weight: 1.5 },
        ]); // load metrics

      // Add test peers
      await mockPostgres.query(`
        INSERT INTO a2a_peers (agent_id, last_seen, status)
        VALUES 
          ('peer1', CURRENT_TIMESTAMP, 'active'),
          ('peer2', CURRENT_TIMESTAMP, 'active'),
          ('peer3', CURRENT_TIMESTAMP, 'active')
        ON CONFLICT (agent_id) DO UPDATE SET
          last_seen = CURRENT_TIMESTAMP,
          status = 'active';
      `);

      // Send messages to different peers
      await a2a.sendMessage({
        type: 'request',
        sender: 'test-agent',
        recipient: 'peer1',
        payload: { test: 'data' },
      });

      await a2a.sendMessage({
        type: 'request',
        sender: 'test-agent',
        recipient: 'peer2',
        payload: { test: 'data' },
      });

      // Mock the final load metrics query
      mockPostgres.query.mockResolvedValueOnce([
        { agent_id: 'peer1', message_count: 1, weight: 2.0 },
        { agent_id: 'peer2', message_count: 1, weight: 1.0 },
        { agent_id: 'peer3', message_count: 0, weight: 1.5 },
      ]);

      // Check load metrics
      const loadResult = await mockPostgres.query(`
        SELECT agent_id, message_count, weight
        FROM a2a_peer_load
        WHERE agent_id IN ('peer1', 'peer2', 'peer3')
        ORDER BY agent_id;
      `);

      expect(loadResult).toHaveLength(3);
      expect(loadResult[0].message_count).toBe(1); // peer1
      expect(loadResult[1].message_count).toBe(1); // peer2
      expect(loadResult[2].message_count).toBe(0); // peer3
    });

    it('should select peers based on round-robin strategy', async () => {
      // Mock database responses
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]) // insert peers
        .mockResolvedValueOnce([]) // first message
        .mockResolvedValueOnce([]) // second message
        .mockResolvedValueOnce([]) // third message
        .mockResolvedValueOnce([]) // fourth message
        .mockResolvedValueOnce([]) // fifth message
        .mockResolvedValueOnce([]); // sixth message

      // Add test peers
      await mockPostgres.query(`
        INSERT INTO a2a_peers (agent_id, last_seen, status)
        VALUES 
          ('peer1', CURRENT_TIMESTAMP, 'active'),
          ('peer2', CURRENT_TIMESTAMP, 'active'),
          ('peer3', CURRENT_TIMESTAMP, 'active')
        ON CONFLICT (agent_id) DO UPDATE SET
          last_seen = CURRENT_TIMESTAMP,
          status = 'active';
      `);

      // Mock the selectPeer method to cycle through peers
      const originalSelectPeer = a2a['selectPeer'];
      let currentIndex = 0;
      a2a['selectPeer'] = jest.fn().mockImplementation(() => {
        const peers = ['peer1', 'peer2', 'peer3'];
        const selectedPeer = peers[currentIndex];
        currentIndex = (currentIndex + 1) % peers.length;
        return selectedPeer;
      });

      const recipients: number[] = [];
      for (let i = 0; i < 6; i++) {
        await a2a.sendMessage({
          type: 'request',
          sender: 'test-agent',
          recipient: 'any',
          payload: { test: 'data' },
        });
        recipients.push(currentIndex);
      }

      // Restore original selectPeer method
      a2a['selectPeer'] = originalSelectPeer;

      // Should cycle through peers in order
      expect(recipients).toEqual([1, 2, 0, 1, 2, 0]);
    });

    it('should select least loaded peer when using least-loaded strategy', async () => {
      // Create new instance with least-loaded strategy
      const leastLoadedA2A = new A2AProtocol({
        postgres: mockPostgres,
        redis: mockRedis,
        agentId: 'test-agent',
        checkInterval: 1000,
        loadBalancing: {
          strategy: 'least-loaded',
        },
      });

      // Mock database responses
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]) // insert peers
        .mockResolvedValueOnce([]) // first message
        .mockResolvedValueOnce([{ agent_id: 'peer3', message_count: 1 }]) // check load
        .mockResolvedValueOnce([]) // update load
        .mockResolvedValueOnce([{ agent_id: 'peer3', message_count: 2 }]); // final check

      await leastLoadedA2A.initialize();

      // Add test peers
      await mockPostgres.query(`
        INSERT INTO a2a_peers (agent_id, last_seen, status)
        VALUES 
          ('peer1', CURRENT_TIMESTAMP, 'active'),
          ('peer2', CURRENT_TIMESTAMP, 'active'),
          ('peer3', CURRENT_TIMESTAMP, 'active')
        ON CONFLICT (agent_id) DO UPDATE SET
          last_seen = CURRENT_TIMESTAMP,
          status = 'active';
      `);

      // Initialize peer load records
      await mockPostgres.query(`
        INSERT INTO a2a_peer_load (agent_id, message_count, last_update, weight)
        VALUES 
          ('peer1', 1, CURRENT_TIMESTAMP, 1.0),
          ('peer2', 1, CURRENT_TIMESTAMP, 1.0),
          ('peer3', 1, CURRENT_TIMESTAMP, 1.0)
        ON CONFLICT (agent_id) DO UPDATE SET
          message_count = EXCLUDED.message_count,
          last_update = CURRENT_TIMESTAMP;
      `);

      // Send message and check if it goes to least loaded peer
      await leastLoadedA2A.sendMessage({
        type: 'request',
        sender: 'test-agent',
        recipient: 'any',
        payload: { test: 'data' },
      });

      // Mock the final load check query
      mockPostgres.query.mockResolvedValueOnce([{ agent_id: 'peer3', message_count: 2 }]);

      const loadResult = await mockPostgres.query(`
        SELECT agent_id, message_count
        FROM a2a_peer_load
        WHERE agent_id = 'peer3';
      `);

      expect(loadResult[0].message_count).toBe(2); // Should increment from 1 to 2
    });

    it('should respect weights in weighted strategy', async () => {
      // Create new instance with weighted strategy
      const weightedA2A = new A2AProtocol({
        postgres: mockPostgres,
        redis: mockRedis,
        agentId: 'test-agent',
        checkInterval: 1000,
        loadBalancing: {
          strategy: 'weighted',
          weights: {
            peer1: 2.0,
            peer2: 1.0,
            peer3: 1.5,
          },
        },
      });

      // Mock database responses
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]) // insert peers
        .mockResolvedValueOnce([]) // first message
        .mockResolvedValueOnce([
          { agent_id: 'peer1', message_count: 44 },
          { agent_id: 'peer2', message_count: 22 },
          { agent_id: 'peer3', message_count: 34 },
        ]); // load metrics

      await weightedA2A.initialize();

      // Add test peers
      await mockPostgres.query(`
        INSERT INTO a2a_peers (agent_id, last_seen, status)
        VALUES 
          ('peer1', CURRENT_TIMESTAMP, 'active'),
          ('peer2', CURRENT_TIMESTAMP, 'active'),
          ('peer3', CURRENT_TIMESTAMP, 'active')
        ON CONFLICT (agent_id) DO UPDATE SET
          last_seen = CURRENT_TIMESTAMP,
          status = 'active';
      `);

      // Send multiple messages and track distribution
      const distribution: Record<string, number> = {
        peer1: 0,
        peer2: 0,
        peer3: 0,
      };

      for (let i = 0; i < 100; i++) {
        await weightedA2A.sendMessage({
          type: 'request',
          sender: 'test-agent',
          recipient: 'any',
          payload: { test: 'data' },
        });
      }

      // Mock the final load metrics query
      mockPostgres.query.mockResolvedValueOnce([
        { agent_id: 'peer1', message_count: 44 },
        { agent_id: 'peer2', message_count: 22 },
        { agent_id: 'peer3', message_count: 34 },
      ]);

      const loadResult = await mockPostgres.query(`
        SELECT agent_id, message_count
        FROM a2a_peer_load
        WHERE agent_id IN ('peer1', 'peer2', 'peer3')
        ORDER BY agent_id;
      `);

      distribution['peer1'] = loadResult[0].message_count;
      distribution['peer2'] = loadResult[1].message_count;
      distribution['peer3'] = loadResult[2].message_count;

      // Check if distribution roughly matches weights
      const total = distribution['peer1'] + distribution['peer2'] + distribution['peer3'];
      const peer1Ratio = distribution['peer1'] / total;
      const peer2Ratio = distribution['peer2'] / total;
      const peer3Ratio = distribution['peer3'] / total;

      // Allow for some variance in distribution
      expect(peer1Ratio).toBeGreaterThan(0.4); // Should be around 0.44 (2/4.5)
      expect(peer2Ratio).toBeLessThan(0.3); // Should be around 0.22 (1/4.5)
      expect(peer3Ratio).toBeGreaterThan(0.3); // Should be around 0.33 (1.5/4.5)
    });
  });

  describe('Security Monitoring', () => {
    let a2a: A2AProtocol;

    beforeEach(async () => {
      // Mock database responses for initialization
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]); // loadPeers

      a2a = new A2AProtocol({
        postgres: mockPostgres,
        redis: mockRedis,
        agentId: 'test-agent',
        checkInterval: 1000,
        encryptionKey: '0'.repeat(64),
        rateLimit: {
          tokensPerInterval: 1000,
          interval: 60000,
          maxTokens: 2,
        },
        compression: {
          threshold: 100,
          level: 6,
        },
      });
      await a2a.initialize();
    });

    afterEach(async () => {
      await a2a.stop();
    });

    it('should create security monitoring tables during initialization', async () => {
      // Mock database responses
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([{ exists: true }]) // first table check
        .mockResolvedValueOnce([{ exists: true }]); // second table check

      await a2a.initialize();

      // Verify the tables were created
      const calls = mockPostgres.query.mock.calls;
      const createTablesCall = calls.find(
        call =>
          call[0].includes('CREATE TABLE IF NOT EXISTS a2a_security_metrics') ||
          call[0].includes('CREATE TABLE IF NOT EXISTS a2a_security_events')
      );

      expect(createTablesCall).toBeDefined();
      expect(createTablesCall![0]).toContain('CREATE TABLE IF NOT EXISTS');
    });

    it('should log security events and update metrics', async () => {
      // Mock database responses
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]) // insert event
        .mockResolvedValueOnce([]); // update metrics

      await a2a['logSecurityEvent']({
        type: 'encryption',
        severity: 'high',
        message: 'Test security event',
        timestamp: Date.now(),
        metadata: { test: 'data' },
      });

      const calls = mockPostgres.query.mock.calls;
      const eventCall = calls.find(call => call[0].includes('INSERT INTO a2a_security_events'));
      const metricsCall = calls.find(call => call[0].includes('INSERT INTO a2a_security_metrics'));

      expect(eventCall).toBeDefined();
      expect(eventCall![1]).toEqual([
        expect.any(String), // id
        'test-agent',
        'encryption',
        'high',
        'Test security event',
        JSON.stringify({ test: 'data' }),
      ]);

      expect(metricsCall).toBeDefined();
      expect(metricsCall![1]).toEqual([
        'test-agent',
        1, // encryption_failures
        0, // decryption_failures
        0, // rate_limit_violations
        0, // compression_failures
        0, // invalid_messages
      ]);
    });

    it('should get security metrics', async () => {
      // Mock database response
      mockPostgres.query.mockResolvedValueOnce([
        {
          encryption_failures: 5,
          decryption_failures: 3,
          rate_limit_violations: 2,
          compression_failures: 1,
          invalid_messages: 0,
          last_update: new Date(),
        },
      ]);

      const metrics = await a2a.getSecurityMetrics();

      expect(metrics).toEqual({
        encryptionFailures: 5,
        decryptionFailures: 3,
        rateLimitViolations: 2,
        compressionFailures: 1,
        invalidMessages: 0,
        lastUpdate: expect.any(Number),
      });
    });

    it('should get security events with filters', async () => {
      // Mock database response
      mockPostgres.query.mockResolvedValueOnce([
        {
          id: 'event1',
          type: 'encryption',
          severity: 'high',
          message: 'Test event',
          timestamp: new Date(),
          metadata: { test: 'data' },
        },
      ]);

      const events = await a2a.getSecurityEvents({
        type: 'encryption',
        severity: 'high',
        startTime: Date.now() - 3600000,
        endTime: Date.now(),
        limit: 10,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'encryption',
        severity: 'high',
        message: 'Test event',
        timestamp: expect.any(Number),
        metadata: { test: 'data' },
      });
    });

    it('should log encryption failure', async () => {
      // Mock database responses
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]) // insert event
        .mockResolvedValueOnce([]); // update metrics

      const message = {
        type: 'request' as const,
        sender: 'test-agent',
        recipient: 'peer1',
        payload: { test: 'data' },
      };

      // Mock encryption failure
      jest.spyOn(MessageEncryption.prototype, 'encrypt').mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      await expect(a2a.sendMessage(message)).rejects.toThrow('Encryption failed');

      const calls = mockPostgres.query.mock.calls;
      const eventCall = calls.find(call => call[0].includes('INSERT INTO a2a_security_events'));

      expect(eventCall).toBeDefined();
      expect(eventCall![1]).toEqual([
        expect.any(String), // id
        'test-agent',
        'encryption',
        'high',
        'Failed to encrypt message',
        expect.stringMatching(/{"error":"Encryption failed","messageId":"[0-9a-f-]+"}/),
      ]);
    });

    it('should log rate limit violation', async () => {
      // Mock database responses
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]) // insert event
        .mockResolvedValueOnce([]); // update metrics

      const message = {
        type: 'request' as const,
        sender: 'test-agent',
        recipient: 'peer1',
        payload: { test: 'data' },
      };

      // Mock rate limit violation
      jest.spyOn(RateLimiter.prototype, 'acquireToken').mockResolvedValue(false);
      jest.spyOn(RateLimiter.prototype, 'getTimeUntilNextToken').mockReturnValue(1000);

      await expect(a2a.sendMessage(message)).rejects.toThrow('Rate limit exceeded');

      const calls = mockPostgres.query.mock.calls;
      const eventCall = calls.find(call => call[0].includes('INSERT INTO a2a_security_events'));

      expect(eventCall).toBeDefined();
      expect(eventCall![1]).toEqual([
        expect.any(String), // id
        'test-agent',
        'rate_limit',
        'medium',
        'Rate limit exceeded. Try again in 1000ms',
        JSON.stringify({
          timeUntilNext: 1000,
          messageType: 'request',
          sender: 'test-agent',
          recipient: 'peer1',
        }),
      ]);
    });

    it('should log invalid message structure', async () => {
      // Mock database responses
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]) // insert event
        .mockResolvedValueOnce([]); // update metrics

      const invalidMessage = {
        id: 'test-id',
        type: 'invalid-type',
        sender: 'test-agent',
        recipient: 'peer1',
        timestamp: Date.now(),
        payload: { test: 'data' },
      };

      await expect(a2a['isValidMessage'](invalidMessage)).toBe(false);
    });
  });
});
