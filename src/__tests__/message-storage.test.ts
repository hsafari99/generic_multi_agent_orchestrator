import { MessageStorage } from '../core/storage/message-storage';
import { IMessage, MessageType } from '../core/interfaces';
import { PostgresClient } from '../core/storage/postgres';

// Mock PostgresClient
jest.mock('../core/storage/postgres', () => ({
  PostgresClient: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    shutdown: jest.fn(),
  })),
}));

describe('MessageStorage', () => {
  let storage: MessageStorage;
  let mockMessage: IMessage;
  let mockPostgres: jest.Mocked<PostgresClient>;

  beforeEach(() => {
    mockPostgres = new PostgresClient({ connectionString: 'test' }) as jest.Mocked<PostgresClient>;
    // Ensure the mock passes instanceof check
    Object.setPrototypeOf(mockPostgres, PostgresClient.prototype);
    storage = new MessageStorage({ postgres: mockPostgres });
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeMessage', () => {
    it('should store message and metadata', async () => {
      await storage.storeMessage(mockMessage);

      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.arrayContaining([mockMessage.id, mockMessage.type, mockMessage.sender])
      );
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO message_metadata'),
        expect.arrayContaining([mockMessage.id, mockMessage.metadata?.priority])
      );
    });

    it('should store message without metadata', async () => {
      const messageWithoutMetadata = { ...mockMessage, metadata: {} };
      await storage.storeMessage(messageWithoutMetadata);

      expect(mockPostgres.query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        expect.arrayContaining([messageWithoutMetadata.id])
      );
    });
  });

  describe('getMessage', () => {
    it('should return message when found', async () => {
      mockPostgres.query.mockResolvedValueOnce([mockMessage]);

      const result = await storage.getMessage(mockMessage.id);

      expect(result).toEqual(mockMessage);
      expect(mockPostgres.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [
        mockMessage.id,
      ]);
    });

    it('should return null when message not found', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await storage.getMessage('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateMessageStatus', () => {
    it('should update message status', async () => {
      await storage.updateMessageStatus(mockMessage.id, 'processing');

      expect(mockPostgres.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE messages'), [
        'processing',
        mockMessage.id,
      ]);
    });
  });

  describe('incrementRetries', () => {
    it('should increment retry count and update timestamps', async () => {
      await storage.incrementRetries(mockMessage.id);

      expect(mockPostgres.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE messages'), [
        mockMessage.id,
      ]);
    });
  });

  describe('moveToDeadLetter', () => {
    it('should move message to dead letter queue', async () => {
      const error = new Error('Test error');
      await storage.moveToDeadLetter(mockMessage.id, error);

      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dead_letter_queue'),
        [mockMessage.id, error.message, error.name]
      );
      expect(mockPostgres.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE messages'), [
        'dead-letter',
        mockMessage.id,
      ]);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        queueSize: 5,
        processingCount: 2,
        deadLetterCount: 1,
      };
      mockPostgres.query.mockResolvedValueOnce([mockStats]);

      const result = await storage.getQueueStats();

      expect(result).toEqual(mockStats);
      expect(mockPostgres.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
    });
  });

  describe('shutdown', () => {
    it('should shutdown postgres client', async () => {
      await storage.shutdown();
      expect(mockPostgres.shutdown).toHaveBeenCalled();
    });
  });
});
