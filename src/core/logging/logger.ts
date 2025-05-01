import { LogLevel, LoggerConfig, LogMessage, Transport } from './types';
import { LogFormatter } from './formatter';
import { ConsoleTransport, FileTransport } from './transport';

/**
 * Main logger class for the application
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private formatter: LogFormatter;
  private transports: Transport[];

  private constructor(config: LoggerConfig) {
    this.config = config;
    this.formatter = new LogFormatter(config);
    this.transports = [new ConsoleTransport(config), new FileTransport(config)];
  }

  /**
   * Get the singleton instance of the logger
   */
  public static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(
        config || {
          level: LogLevel.INFO,
          console: true,
          file: {
            enabled: false,
            directory: './logs',
            maxSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
          },
          showTimestamp: true,
          showLogLevel: true,
          showStackTrace: true,
        }
      );
    }
    return Logger.instance;
  }

  /**
   * Initialize the logger
   */
  public async init(): Promise<void> {
    await Promise.all(this.transports.map(transport => transport.init()));
  }

  /**
   * Close the logger and cleanup resources
   */
  public async close(): Promise<void> {
    await Promise.all(this.transports.map(transport => transport.close()));
  }

  /**
   * Log a debug message
   */
  public debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   */
  public info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   */
  public warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   */
  public error(message: string | Error, context?: any): void {
    if (message instanceof Error) {
      const errorMessage = this.formatter.formatError(message, context);
      this.log(LogLevel.ERROR, errorMessage.message, errorMessage.context, errorMessage.stack);
    } else {
      this.log(LogLevel.ERROR, message, context);
    }
  }

  /**
   * Log a performance measurement
   */
  public logPerformance(operation: string, startTime: number): void {
    const duration = Date.now() - startTime;
    const message = this.formatter.formatPerformance(operation, duration);
    this.log(LogLevel.INFO, message.message, message.context);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: any, stack?: string): void {
    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack,
    };

    // Send to all transports
    this.transports.forEach(transport => {
      transport.log(logMessage).catch(err => {
        throw err;
      });
    });
  }
}
