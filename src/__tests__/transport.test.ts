import { ConsoleTransport, FileTransport } from '../core/logging/transport';
import { LogLevel } from '../core/logging/types';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

describe('ConsoleTransport', () => {
  let transport: ConsoleTransport;
  const mockConfig = {
    level: LogLevel.INFO,
    console: true,
    file: {
      enabled: false,
      directory: './logs',
      maxSize: 1024,
      maxFiles: 2,
    },
    showTimestamp: true,
    showLogLevel: true,
    showStackTrace: true,
  };

  beforeEach(() => {
    transport = new ConsoleTransport(mockConfig);
    jest.clearAllMocks();
    console.debug = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  describe('init', () => {
    it('should initialize without errors', async () => {
      await expect(transport.init()).resolves.not.toThrow();
    });
  });

  describe('log', () => {
    it('should log debug messages', async () => {
      await transport.log({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.DEBUG,
        message: 'Debug message',
      });
      expect(console.debug).toHaveBeenCalled();
    });

    it('should log info messages', async () => {
      await transport.log({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'Info message',
      });
      expect(console.info).toHaveBeenCalled();
    });

    it('should log warning messages', async () => {
      await transport.log({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.WARN,
        message: 'Warning message',
      });
      expect(console.warn).toHaveBeenCalled();
    });

    it('should log error messages', async () => {
      await transport.log({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.ERROR,
        message: 'Error message',
      });
      expect(console.error).toHaveBeenCalled();
    });

    it('should not log when console is disabled', async () => {
      transport = new ConsoleTransport({ ...mockConfig, console: false });
      await transport.log({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'Info message',
      });
      expect(console.info).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close without errors', async () => {
      await expect(transport.close()).resolves.not.toThrow();
    });
  });
});

describe('FileTransport', () => {
  let transport: FileTransport;
  const mockConfig = {
    level: LogLevel.INFO,
    console: false,
    file: {
      enabled: true,
      directory: './logs',
      maxSize: 1024,
      maxFiles: 2,
    },
    showTimestamp: true,
    showLogLevel: true,
    showStackTrace: true,
  };
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPath = path as jest.Mocked<typeof path>;
  let mockWrite: jest.Mock;
  let mockEnd: jest.Mock;
  let mockStream: any;

  beforeEach(() => {
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
      return {
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
    });
    mockFs.readdirSync.mockReturnValue([
      { name: 'log-1.json', isFile: () => true } as fs.Dirent,
      { name: 'log-2.json', isFile: () => true } as fs.Dirent,
      { name: 'log-3.json', isFile: () => true } as fs.Dirent,
    ]);
    mockPath.join.mockImplementation((...args) => args.join('/'));
    transport = new FileTransport(mockConfig);
  });

  describe('init', () => {
    it('should create log directory if it does not exist', async () => {
      await transport.init();
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('./logs', { recursive: true });
    });

    it('should create initial log file', async () => {
      await transport.init();
      expect(mockFs.createWriteStream).toHaveBeenCalled();
    });
  });

  describe('log', () => {
    it('should write log message to file', async () => {
      await transport.init();
      await transport.log({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'Info message',
      });
      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('Info message'));
    });

    it('should not write when file logging is disabled', async () => {
      transport = new FileTransport({
        ...mockConfig,
        file: { ...mockConfig.file, enabled: false },
      });
      await transport.init();
      await transport.log({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'Info message',
      });
      expect(mockWrite).not.toHaveBeenCalled();
    });

    it('should clean up old log files', async () => {
      await transport.init();
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close the write stream', async () => {
      await transport.init();
      await transport.close();
      expect(mockEnd).toHaveBeenCalled();
    });

    it('should handle close when stream is null', async () => {
      await transport.close();
      expect(mockEnd).not.toHaveBeenCalled();
    });
  });
});
