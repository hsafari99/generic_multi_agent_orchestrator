import { PostgresClient, PostgresConfig } from '../core/storage/postgres';
import { Pool } from 'pg';
import * as fs from 'fs';

// Mock fs
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

interface MockPool {
  connect: jest.Mock;
  on: jest.Mock;
  end: jest.Mock;
}

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    on: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('PostgresClient', () => {
  let client: PostgresClient;
  let mockPool: MockPool;
  const config: PostgresConfig = {
    connectionString: 'postgresql://test:test@localhost:5432/test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = new PostgresClient(config);
    mockPool = (Pool as unknown as jest.Mock).mock.results[0].value;
    (mockPool.connect as jest.Mock).mockImplementation(() => Promise.resolve({
      query: jest.fn(),
      release: jest.fn(),
    }));
  });

  describe('constructor', () => {
    it('should create a pool with default config', () => {
      expect(Pool).toHaveBeenCalledWith({
        connectionString: config.connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
      });
    });

    it('should create a pool with custom config', () => {
      const customConfig: PostgresConfig = {
        connectionString: config.connectionString,
        maxConnections: 10,
        idleTimeoutMillis: 60000,
      };
      new PostgresClient(customConfig);
      expect(Pool).toHaveBeenCalledWith({
        connectionString: customConfig.connectionString,
        max: customConfig.maxConnections,
        idleTimeoutMillis: customConfig.idleTimeoutMillis,
      });
    });
  });

  describe('query', () => {
    it('should execute query and return rows', async () => {
      const mockRows = [{ id: 1, name: 'test' }];
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: mockRows }),
        release: jest.fn(),
      } as unknown as { query: jest.Mock; release: jest.Mock };
      mockPool.connect.mockResolvedValueOnce(mockClient);

      const result = await client.query('SELECT * FROM test');
      expect(result).toEqual(mockRows);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM test', undefined);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should execute query with parameters', async () => {
      const mockRows = [{ id: 1, name: 'test' }];
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: mockRows }),
        release: jest.fn(),
      } as unknown as { query: jest.Mock; release: jest.Mock };
      mockPool.connect.mockResolvedValueOnce(mockClient);

      const params = [1, 'test'];
      const result = await client.query('SELECT * FROM test WHERE id = $1 AND name = $2', params);
      expect(result).toEqual(mockRows);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1 AND name = $2', params);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client on error', async () => {
      const mockError = new Error('Query failed');
      const mockClient = {
        query: jest.fn().mockRejectedValueOnce(mockError),
        release: jest.fn(),
      } as unknown as { query: jest.Mock; release: jest.Mock };
      mockPool.connect.mockResolvedValueOnce(mockClient);

      await expect(client.query('SELECT * FROM test')).rejects.toThrow(mockError);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('executeFile', () => {
    it('should execute SQL file', async () => {
      const mockSql = 'SELECT * FROM test;';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockSql);
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValueOnce(mockClient);

      await client.executeFile('test.sql');
      expect(fs.readFileSync).toHaveBeenCalledWith('test.sql', 'utf8');
      expect(mockClient.query).toHaveBeenCalledWith(mockSql);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client on error', async () => {
      const mockError = new Error('File execution failed');
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw mockError;
      });
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValueOnce(mockClient);

      await expect(client.executeFile('test.sql')).rejects.toThrow(mockError);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should end the pool', async () => {
      await client.shutdown();
      expect(mockPool.end).toHaveBeenCalled();
    });
  });
}); 