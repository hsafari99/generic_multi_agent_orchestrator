import { Logger } from '../core/logging/logger';
import { LogLevel } from '../core/logging/types';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

describe('Logger', () => {
  let logger: Logger;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPath = path as jest.Mocked<typeof path>;
  let mockWrite: jest.Mock;
  let mockEnd: jest.Mock;
  let mockStream: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock console methods
    console.debug = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Mock fs methods
    mockWrite = jest.fn();
    mockEnd = jest.fn(cb => cb && cb());
    mockStream = {
      write: mockWrite,
      end: mockEnd,
    };
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.createWriteStream.mockReturnValue(mockStream);
    mockFs.statSync.mockImplementation((path: fs.PathLike) => {
      const pathStr = path.toString();
      const stats = {
        size: pathStr.includes('log-1.json') ? 2048 : 0,
        mtime: new Date('2024-01-01'),
        isFile: () => true,
        isDirectory: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSymbolicLink: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        dev: 0,
        ino: 0,
        mode: 0,
        nlink: 0,
        uid: 0,
        gid: 0,
        rdev: 0,
        blksize: 0,
        blocks: 0,
        atime: new Date('2024-01-01'),
        ctime: new Date('2024-01-01'),
        birthtime: new Date('2024-01-01'),
      } as fs.Stats;
      return stats;
    });
    mockFs.readdirSync.mockReturnValue([
      { name: 'log-1.json', isFile: () => true } as fs.Dirent,
      { name: 'log-2.json', isFile: () => true } as fs.Dirent,
      { name: 'log-3.json', isFile: () => true } as fs.Dirent,
    ]);

    // Mock path methods
    mockPath.join.mockImplementation((...args) => args.join('/'));

    // Create logger instance
    logger = Logger.getInstance({
      level: LogLevel.DEBUG,
      console: true,
      file: {
        enabled: true,
        directory: './logs',
        maxSize: 1024,
        maxFiles: 2,
      },
      showTimestamp: true,
      showLogLevel: true,
      showStackTrace: true,
    });
  });

  describe('initialization', () => {
    it("should create log directory if it doesn't exist", async () => {
      await logger.init();
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('./logs', { recursive: true });
    });

    it('should create a new log file on initialization', async () => {
      await logger.init();
      expect(mockFs.createWriteStream).toHaveBeenCalled();
    });
  });

  describe('logging levels', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message');
      expect(console.debug).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('Info message');
      expect(console.info).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Error message');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('error logging', () => {
    it('should log error objects with stack traces', async () => {
      await logger.init();
      const error = new Error('Test error');
      logger.error(error);
      expect(console.error).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    });

    it('should log error messages with context', async () => {
      await logger.init();
      logger.error('Error message', { context: 'test' });
      expect(console.error).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('Error message'));
    });
  });

  describe('performance logging', () => {
    it('should log performance measurements', async () => {
      await logger.init();
      const startTime = Date.now() - 1000; // 1 second ago
      logger.logPerformance('Test operation', startTime);
      expect(console.info).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining('Performance: Test operation')
      );
    });
  });

  describe('file rotation', () => {
    it('should clean up old log files', async () => {
      await logger.init();
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should close all transports on cleanup', async () => {
      await logger.init();
      await logger.close();
      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
