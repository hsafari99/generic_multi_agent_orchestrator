import { A2AProtocol, A2AMessage } from '../core/protocols/a2a';
import { PostgresClient } from '../core/storage/postgres';
import { RedisClient } from '../core/cache/client';
import { Logger } from '../core/logging/logger';
import { MessageEncryption } from '../core/security/encryption';
import { MessageCompression } from '../core/security/compression';

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
    mockPostgres = new PostgresClient({
      connectionString: 'mock-connection-string',
    }) as jest.Mocked<PostgresClient>;
    mockRedis = {
      getClient: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      }),
    } as unknown as jest.Mocked<RedisClient>;
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
      const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
        type: 'request',
        sender: 'test-agent',
        recipient: 'peer1',
        payload: { action: 'test' },
        metadata: { priority: 'high' },
      };

      // Mock the database queries
      mockPostgres.query
        .mockResolvedValueOnce([]) // createTables
        .mockResolvedValueOnce([]) // loadPeers
        .mockResolvedValueOnce([]); // insert message

      await protocol.initialize();
      await protocol.sendMessage(message);

      // Verify message was stored
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO a2a_messages'),
        expect.arrayContaining([
          expect.any(String), // id
          'request',
          'test-agent',
          'peer1',
          expect.any(Date),
          JSON.stringify({ action: 'test' }),
          JSON.stringify({ priority: 'high' }),
        ])
      );
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
          payload: { action: 'test' },
          metadata: { priority: 'high' },
        },
      ];

      (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(null);
      mockPostgres.query.mockResolvedValueOnce(dbMessage);

      const message = await protocol.receiveMessage(messageId);
      expect(message).toBeDefined();
      expect(message?.id).toBe(messageId);
    });

    it('should handle message send errors', async () => {
      const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
        type: 'request',
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

      (mockRedis.getClient().get as jest.Mock).mockRejectedValueOnce(new Error('Cache error'));
      mockPostgres.query.mockRejectedValueOnce(new Error('Database error'));

      // Set up error event listener
      const errorHandler = jest.fn();
      protocol.on('error', errorHandler);

      await expect(protocol.receiveMessage(messageId)).rejects.toThrow('Cache error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error receiving message', expect.any(Error));
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle different message types', async () => {
      const messageTypes: Array<A2AMessage['type']> = ['request', 'response', 'notification'];

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

        await protocol.initialize();
        await protocol.sendMessage(message);

        expect(mockPostgres.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO a2a_messages'),
          expect.arrayContaining([type])
        );
      }
    });

    describe('encryption', () => {
      let encryptedProtocol: A2AProtocol;
      const encryptionKey = MessageEncryption.generateKey();

      beforeEach(() => {
        encryptedProtocol = new A2AProtocol({
          postgres: mockPostgres,
          redis: mockRedis,
          agentId: 'test-agent',
          checkInterval: 1000,
          encryptionKey,
        });
      });

      it('should encrypt messages when sending', async () => {
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request',
          sender: 'test-agent',
          recipient: 'peer1',
          payload: { action: 'test' },
          metadata: { priority: 'high' },
        };

        mockPostgres.query
          .mockResolvedValueOnce([]) // createTables
          .mockResolvedValueOnce([]) // loadPeers
          .mockResolvedValueOnce([]); // insert message

        await encryptedProtocol.initialize();
        await encryptedProtocol.sendMessage(message);

        // Verify message was encrypted
        expect(mockPostgres.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO a2a_messages'),
          expect.arrayContaining([
            expect.any(String), // id
            'request',
            'test-agent',
            'peer1',
            expect.any(Date),
            expect.stringMatching(
              /{"encryptedData":".*","iv":".*","algorithm":"aes-256-gcm","authTag":".*"}/
            ),
            JSON.stringify({ priority: 'high' }),
          ])
        );
      });

      it('should decrypt messages when receiving', async () => {
        const messageId = 'test-message-id';
        const originalMessage: A2AMessage = {
          id: messageId,
          type: 'request',
          sender: 'test-agent',
          recipient: 'peer1',
          timestamp: Date.now(),
          payload: { action: 'test' },
          metadata: { priority: 'high' },
        };

        const encryption = new MessageEncryption(encryptionKey);
        const encryptedMessage = encryption.encrypt(JSON.stringify(originalMessage));

        (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(encryptedMessage)
        );

        const message = await encryptedProtocol.receiveMessage(messageId);
        expect(message).toEqual(originalMessage);
      });

      it('should handle encryption errors', async () => {
        const messageId = 'test-message-id';
        const invalidMessage = {
          encryptedData: 'invalid',
          iv: 'invalid',
          algorithm: 'aes-256-gcm',
        };

        (mockRedis.getClient().get as jest.Mock).mockResolvedValueOnce(
          JSON.stringify(invalidMessage)
        );

        await expect(encryptedProtocol.receiveMessage(messageId)).rejects.toThrow();
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
            tokensPerInterval: 2,
            interval: 1000,
            maxTokens: 2,
          },
        });
      });

      it('should allow messages within rate limit', async () => {
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request',
          sender: 'test-agent',
          recipient: 'peer1',
          payload: { action: 'test' },
        };

        mockPostgres.query
          .mockResolvedValueOnce([]) // createTables
          .mockResolvedValueOnce([]) // loadPeers
          .mockResolvedValueOnce([]) // first message
          .mockResolvedValueOnce([]); // second message

        await rateLimitedProtocol.initialize();
        await rateLimitedProtocol.sendMessage(message);
        await rateLimitedProtocol.sendMessage(message);

        expect(mockPostgres.query).toHaveBeenCalledTimes(4);
      });

      it('should reject messages exceeding rate limit', async () => {
        const message: Omit<A2AMessage, 'id' | 'timestamp'> = {
          type: 'request',
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
          type: 'request',
          sender: 'test-agent',
          recipient: 'peer1',
          payload: { action: 'test' },
        };

        mockPostgres.query
          .mockResolvedValueOnce([]) // createTables
          .mockResolvedValueOnce([]) // loadPeers
          .mockResolvedValueOnce([]) // first message
          .mockResolvedValueOnce([]) // second message
          .mockResolvedValueOnce([]); // third message after interval

        await rateLimitedProtocol.initialize();
        await rateLimitedProtocol.sendMessage(message);
        await rateLimitedProtocol.sendMessage(message);

        // Wait for rate limit interval
        await new Promise(resolve => setTimeout(resolve, 1000));

        await rateLimitedProtocol.sendMessage(message);
        expect(mockPostgres.query).toHaveBeenCalledTimes(5);
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
          type: 'request',
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
          type: 'request',
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
});
