import { LogMessage, LoggerConfig, LogLevel } from './types';

/**
 * Formats a log message according to the configuration
 */
export class LogFormatter {
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  /**
   * Format a log message
   */
  public format(message: LogMessage): string {
    const parts: string[] = [];

    // Add timestamp if enabled
    if (this.config.showTimestamp) {
      parts.push(`[${message.timestamp}]`);
    }

    // Add log level if enabled
    if (this.config.showLogLevel) {
      parts.push(`[${message.level.toUpperCase()}]`);
    }

    // Add main message
    parts.push(message.message);

    // Add context if present
    if (message.context) {
      const contextStr =
        typeof message.context === 'object'
          ? JSON.stringify(message.context, null, 2)
          : String(message.context);
      parts.push(`\nContext: ${contextStr}`);
    }

    // Add stack trace for errors if enabled
    if (message.level === 'error' && message.stack && this.config.showStackTrace) {
      parts.push(`\nStack: ${message.stack}`);
    }

    return parts.join(' ');
  }

  /**
   * Format an error message with stack trace
   */
  public formatError(error: Error, context?: any): LogMessage {
    return {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message: error.message,
      context,
      stack: error.stack,
    };
  }

  /**
   * Format a performance log message
   */
  public formatPerformance(operation: string, duration: number): LogMessage {
    return {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: `Performance: ${operation}`,
      context: {
        duration: `${duration}ms`,
        operation,
      },
    };
  }
}
