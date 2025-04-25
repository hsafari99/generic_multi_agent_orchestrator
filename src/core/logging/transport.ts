import * as fs from 'fs';
import * as path from 'path';
import { Transport, LogMessage, LoggerConfig } from './types';

/**
 * Console transport for logging
 */
export class ConsoleTransport implements Transport {
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  public async init(): Promise<void> {
    // No initialization needed for console transport
  }

  public async log(message: LogMessage): Promise<void> {
    if (!this.config.console) return;

    const logMethod = this.getConsoleMethod(message.level);
    logMethod(message.message);

    if (message.context) {
      logMethod('Context:', message.context);
    }

    if (message.stack) {
      logMethod('Stack:', message.stack);
    }
  }

  public async close(): Promise<void> {
    // No cleanup needed for console transport
  }

  private getConsoleMethod(level: string): (...args: any[]) => void {
    switch (level) {
      case 'error':
        return console.error;
      case 'warn':
        return console.warn;
      case 'info':
        return console.info;
      case 'debug':
        return console.debug;
      default:
        return console.log;
    }
  }
}

/**
 * File transport for logging
 */
export class FileTransport implements Transport {
  private config: LoggerConfig;
  private stream: fs.WriteStream | null = null;
  private currentFile: string = '';

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  public async init(): Promise<void> {
    if (!this.config.file.enabled) return;

    // Create log directory if it doesn't exist
    if (!fs.existsSync(this.config.file.directory)) {
      fs.mkdirSync(this.config.file.directory, { recursive: true });
    }

    await this.rotateLogFile();
  }

  public async log(message: LogMessage): Promise<void> {
    if (!this.config.file.enabled || !this.stream) return;

    const logEntry = JSON.stringify(message) + '\n';
    this.stream.write(logEntry);

    // Check if we need to rotate the log file
    const stats = fs.statSync(this.currentFile);
    if (stats.size >= this.config.file.maxSize) {
      await this.rotateLogFile();
    }
  }

  public async close(): Promise<void> {
    if (this.stream) {
      await new Promise<void>(resolve => {
        this.stream!.end(() => resolve());
      });
      this.stream = null;
    }
  }

  private async rotateLogFile(): Promise<void> {
    // Close existing stream if any
    if (this.stream) {
      await this.close();
    }

    // Generate new log file name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentFile = path.join(this.config.file.directory, `log-${timestamp}.json`);

    // Create new stream
    this.stream = fs.createWriteStream(this.currentFile, { flags: 'a' });

    // Clean up old log files
    await this.cleanupOldLogs();
  }

  private async cleanupOldLogs(): Promise<void> {
    const files = fs
      .readdirSync(this.config.file.directory, { withFileTypes: true })
      .filter(file => file.isFile() && file.name.startsWith('log-') && file.name.endsWith('.json'))
      .map(file => ({
        name: file.name,
        path: path.join(this.config.file.directory, file.name),
        time: fs.statSync(path.join(this.config.file.directory, file.name)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    // Remove excess log files
    while (files.length > this.config.file.maxFiles) {
      const file = files.pop();
      if (file) {
        fs.unlinkSync(file.path);
      }
    }
  }
}
