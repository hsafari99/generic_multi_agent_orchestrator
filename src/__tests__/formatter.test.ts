import { LogFormatter } from '../core/logging/formatter';
import { LogLevel } from '../core/logging/types';

describe('LogFormatter', () => {
  let formatter: LogFormatter;

  beforeEach(() => {
    formatter = new LogFormatter({
      level: LogLevel.INFO,
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

  describe('format', () => {
    it('should format a basic message', () => {
      const message = {
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'Test message',
      };
      const formatted = formatter.format(message);
      expect(formatted).toContain('[2024-01-01T00:00:00.000Z]');
      expect(formatted).toContain('[INFO]');
      expect(formatted).toContain('Test message');
    });

    it('should format an error message with stack trace', () => {
      const message = {
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.ERROR,
        message: 'Error message',
        stack: 'Error stack trace',
      };
      const formatted = formatter.format(message);
      expect(formatted).toContain('Stack: Error stack trace');
    });

    it('should not include stack trace when showStackTrace is false', () => {
      formatter = new LogFormatter({
        level: LogLevel.INFO,
        console: true,
        file: {
          enabled: true,
          directory: './logs',
          maxSize: 1024,
          maxFiles: 2,
        },
        showTimestamp: true,
        showLogLevel: true,
        showStackTrace: false,
      });

      const message = {
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.ERROR,
        message: 'Error message',
        stack: 'Error stack trace',
      };
      const formatted = formatter.format(message);
      expect(formatted).not.toContain('Stack: Error stack trace');
    });

    it('should not include timestamp when showTimestamp is false', () => {
      formatter = new LogFormatter({
        level: LogLevel.INFO,
        console: true,
        file: {
          enabled: true,
          directory: './logs',
          maxSize: 1024,
          maxFiles: 2,
        },
        showTimestamp: false,
        showLogLevel: true,
        showStackTrace: true,
      });

      const message = {
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'Test message',
      };
      const formatted = formatter.format(message);
      expect(formatted).not.toContain('[2024-01-01T00:00:00.000Z]');
    });

    it('should not include log level when showLogLevel is false', () => {
      formatter = new LogFormatter({
        level: LogLevel.INFO,
        console: true,
        file: {
          enabled: true,
          directory: './logs',
          maxSize: 1024,
          maxFiles: 2,
        },
        showTimestamp: true,
        showLogLevel: false,
        showStackTrace: true,
      });

      const message = {
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'Test message',
      };
      const formatted = formatter.format(message);
      expect(formatted).not.toContain('[INFO]');
    });

    it('should handle non-object context', () => {
      const message = {
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'Test message',
        context: 'string context',
      };
      const formatted = formatter.format(message);
      expect(formatted).toContain('Context: string context');
    });

    it('should handle null context', () => {
      const message = {
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'Test message',
        context: null,
      };
      const formatted = formatter.format(message);
      expect(formatted).not.toContain('Context:');
    });
  });

  describe('formatError', () => {
    it('should format an error object', () => {
      const error = new Error('Test error');
      const formatted = formatter.formatError(error);
      expect(formatted.level).toBe(LogLevel.ERROR);
      expect(formatted.message).toBe('Test error');
      expect(formatted.stack).toBe(error.stack);
    });

    it('should include context in formatted error', () => {
      const error = new Error('Test error');
      const context = { key: 'value' };
      const formatted = formatter.formatError(error, context);
      expect(formatted.context).toBe(context);
    });

    it('should handle error without stack trace', () => {
      const error = new Error('Test error');
      error.stack = undefined;
      const formatted = formatter.formatError(error);
      expect(formatted.stack).toBeUndefined();
    });
  });

  describe('formatPerformance', () => {
    it('should format performance message', () => {
      const operation = 'Test operation';
      const duration = 1000;
      const formatted = formatter.formatPerformance(operation, duration);
      expect(formatted.level).toBe(LogLevel.INFO);
      expect(formatted.message).toBe('Performance: Test operation');
      expect(formatted.context).toEqual({
        duration: '1000ms',
        operation: 'Test operation',
      });
    });

    it('should handle zero duration', () => {
      const operation = 'Test operation';
      const duration = 0;
      const formatted = formatter.formatPerformance(operation, duration);
      expect(formatted.context).toEqual({
        duration: '0ms',
        operation: 'Test operation',
      });
    });

    it('should handle negative duration', () => {
      const operation = 'Test operation';
      const duration = -1000;
      const formatted = formatter.formatPerformance(operation, duration);
      expect(formatted.context).toEqual({
        duration: '-1000ms',
        operation: 'Test operation',
      });
    });
  });
});
