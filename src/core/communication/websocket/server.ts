import { WebSocketServer, WebSocket } from 'ws';
import { Logger } from '../../logging/logger';
import { Message, MessageType } from '../types';
import { MessageValidator } from '../validator';
import { EventEmitter } from 'events';

/**
 * WebSocket server configuration
 */
export interface WebSocketServerConfig {
  port: number;
  path?: string;
  heartbeatInterval?: number;
  maxConnections?: number;
}

/**
 * WebSocket connection
 */
export interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  lastHeartbeat: number;
}

/**
 * WebSocket server events
 */
export enum WebSocketServerEvent {
  CONNECTION = 'connection',
  MESSAGE = 'message',
  CLOSE = 'close',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

/**
 * WebSocket server
 */
export class WebSocketServerManager extends EventEmitter {
  private server!: WebSocketServer;
  private connections: Map<string, WebSocketConnection>;
  private logger: Logger;
  private heartbeatInterval: NodeJS.Timeout | undefined;

  constructor(private config: WebSocketServerConfig) {
    super();
    this.connections = new Map();
    this.logger = Logger.getInstance();
  }

  /**
   * Start the WebSocket server
   */
  public start(): void {
    this.server = new WebSocketServer({
      port: this.config.port,
      path: this.config.path,
    });

    this.server.on('connection', this.handleConnection.bind(this));
    this.server.on('error', this.handleError.bind(this));

    this.startHeartbeat();

    this.logger.info(
      `WebSocket server started on port ${this.config.port}${
        this.config.path ? ` with path ${this.config.path}` : ''
      }`
    );
  }

  /**
   * Stop the WebSocket server
   */
  public stop(): void {
    this.stopHeartbeat();
    this.server.close();
    this.logger.info('WebSocket server stopped');
  }

  /**
   * Send a message to a specific connection
   */
  public send(connectionId: string, message: Message): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error(`Failed to send message to ${connectionId}: ${error}`);
      throw error;
    }
  }

  /**
   * Broadcast a message to all connections
   */
  public broadcast(message: Message): void {
    this.connections.forEach(connection => {
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        this.logger.error(`Failed to broadcast message to ${connection.id}: ${error}`);
      }
    });
  }

  /**
   * Handle new connection
   */
  private handleConnection(ws: WebSocket): void {
    const connectionId = this.generateConnectionId();
    const connection: WebSocketConnection = {
      id: connectionId,
      ws,
      isAlive: true,
      lastHeartbeat: Date.now(),
    };

    this.connections.set(connectionId, connection);

    ws.on('message', (data: string) => this.handleMessage(connectionId, data));
    ws.on('close', () => this.handleClose(connectionId));
    ws.on('error', (error: Error) => this.handleConnectionError(connectionId, error));
    ws.on('pong', () => this.handlePong(connectionId));

    this.emit(WebSocketServerEvent.CONNECTION, connectionId);
    this.logger.info(`New connection established: ${connectionId}`);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(connectionId: string, data: string): void {
    try {
      const message = JSON.parse(data);
      MessageValidator.validate(message);
      this.emit(WebSocketServerEvent.MESSAGE, connectionId, message);
    } catch (error) {
      this.logger.error(`Invalid message from ${connectionId}: ${error}`);
      this.send(connectionId, {
        type: MessageType.ERROR,
        timestamp: Date.now(),
        sender: 'server',
        receiver: connectionId,
        correlationId: 'error',
        version: '1.0.0',
        error: 'Invalid message format',
        code: 'INVALID_MESSAGE',
      });
    }
  }

  /**
   * Handle connection close
   */
  private handleClose(connectionId: string): void {
    this.connections.delete(connectionId);
    this.emit(WebSocketServerEvent.CLOSE, connectionId);
    this.logger.info(`Connection closed: ${connectionId}`);
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(connectionId: string, error: Error): void {
    this.logger.error(`Connection error for ${connectionId}: ${error}`);
    this.emit(WebSocketServerEvent.ERROR, connectionId, error);
  }

  private handleError(error: Error): void {
    this.logger.error(`WebSocket server error: ${error}`);
    this.emit(WebSocketServerEvent.ERROR, null, error);
  }

  /**
   * Handle pong response
   * @param connectionId - The ID of the connection that sent the pong
   */
  private handlePong(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isAlive = true;
      connection.lastHeartbeat = Date.now();
      this.emit(WebSocketServerEvent.HEARTBEAT, connectionId);
    }
  }

  private startHeartbeat(): void {
    const interval = this.config.heartbeatInterval || 30000;
    this.heartbeatInterval = setInterval(() => {
      this.connections.forEach(connection => {
        if (!connection.isAlive) {
          this.logger.warn(`Connection ${connection.id} timed out`);
          return connection.ws.terminate();
        }

        connection.isAlive = false;
        connection.ws.ping();
      });
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
