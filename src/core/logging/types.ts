/**
 * Log levels supported by the logging system
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Configuration for the logging system
 */
export interface LoggerConfig {
  /** Minimum log level to record */
  level: LogLevel;
  /** Whether to enable console logging */
  console: boolean;
  /** File logging settings */
  file: {
    /** Whether to enable file logging */
    enabled: boolean;
    /** Directory for log files */
    directory: string;
    /** Maximum size of each log file in bytes */
    maxSize: number;
    /** Maximum number of log files to keep */
    maxFiles: number;
  };
  /** Whether to include timestamps in log messages */
  showTimestamp: boolean;
  /** Whether to include log level in messages */
  showLogLevel: boolean;
  /** Whether to include stack traces for errors */
  showStackTrace: boolean;
}

/**
 * Log message format
 */
export interface LogMessage {
  /** Timestamp of the log entry */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Main message */
  message: string;
  /** Additional context/parameters */
  context?: any;
  /** Stack trace for errors */
  stack?: string;
}

/**
 * Transport interface for logging
 */
export interface Transport {
  /** Initialize the transport */
  init(): Promise<void>;
  /** Log a message */
  log(message: LogMessage): Promise<void>;
  /** Close the transport */
  close(): Promise<void>;
}
