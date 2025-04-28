import { MessageHistoryTracker } from '../core/storage/message-history';
import { PostgresClient } from '../core/storage/postgres';
import { IMessage, MessageType } from '../core/interfaces';

// Mock PostgresClient
jest.mock('../core/storage/postgres', () => ({
  PostgresClient: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
  })),
}));

describe('MessageHistoryTracker', () => {
  let tracker: MessageHistoryTracker;
  let mockPostgres: jest.Mocked<PostgresClient>;
  let mockMessage: IMessage;

  beforeEach(() => {
    mockPostgres = new PostgresClient({ connectionString: 'test' }) as jest.Mocked<PostgresClient>;
    tracker = new MessageHistoryTracker({ postgres: mockPostgres });
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

  describe('trackMessage', () => {
    it('should track message in history', async () => {
      await tracker.trackMessage(mockMessage);

      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO message_history'),
        expect.arrayContaining([
          mockMessage.id,
          mockMessage.type,
          mockMessage.sender,
          mockMessage.receiver,
        ])
      );
    });
  });

  describe('getMessageHistory', () => {
    it('should get message history with filters', async () => {
      const mockHistory = [mockMessage];
      mockPostgres.query.mockResolvedValueOnce(mockHistory);

      const result = await tracker.getMessageHistory({
        sender: 'test-sender',
        type: MessageType.TASK,
        limit: 10,
      });

      expect(result).toEqual(mockHistory);
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM message_history'),
        ['test-sender', 'task', 10]
      );
    });

    it('should get message history without filters', async () => {
      const mockHistory = [mockMessage];
      mockPostgres.query.mockResolvedValueOnce(mockHistory);

      const result = await tracker.getMessageHistory({});

      expect(result).toEqual(mockHistory);
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM message_history'),
        []
      );
    });
  });

  describe('cleanupOldHistory', () => {
    it('should delete old history entries', async () => {
      await tracker.cleanupOldHistory();

      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM message_history'),
        expect.any(Array)
      );
    });
  });

  describe('getHistoryStats', () => {
    it('should return message statistics', async () => {
      const mockStats = [
        {
          total: 2,
          type: MessageType.TASK,
          sender: 'test-sender',
          receiver: 'test-receiver',
          count: 2,
        },
      ];
      mockPostgres.query.mockResolvedValueOnce(mockStats);

      const stats = await tracker.getHistoryStats();

      expect(stats).toEqual({
        totalMessages: 2,
        messagesByType: { [MessageType.TASK]: 2 },
        messagesBySender: { 'test-sender': 2 },
        messagesByReceiver: { 'test-receiver': 2 },
      });
    });
  });
});
