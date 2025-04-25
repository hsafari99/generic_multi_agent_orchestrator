import { WebSocketServerManager, WebSocketServerEvent } from './server';
import { IOrchestrator, IMessage } from '../../interfaces';
import { Logger } from '../../logging/logger';
import { ErrorMessage, PROTOCOL_VERSION, MessageType } from '../types';

/**
 * WebSocket server configuration for the orchestrator
 */
export interface OrchestratorWebSocketConfig {
  port: number;
  path?: string;
  heartbeatInterval?: number;
  maxConnections?: number;
}

/**
 * WebSocket server integration for the orchestrator
 */
export class OrchestratorWebSocket {
  private server: WebSocketServerManager;
  private orchestrator: IOrchestrator;
  private logger: Logger;

  constructor(orchestrator: IOrchestrator, config: OrchestratorWebSocketConfig) {
    this.orchestrator = orchestrator;
    this.logger = Logger.getInstance();
    this.server = new WebSocketServerManager(config);
  }

  /**
   * Start the WebSocket server
   */
  public start(): void {
    this.server.start();

    // Set up event handlers
    this.server.on(WebSocketServerEvent.CONNECTION, this.handleConnection.bind(this));
    this.server.on(WebSocketServerEvent.MESSAGE, this.handleMessage.bind(this));
    this.server.on(WebSocketServerEvent.CLOSE, this.handleClose.bind(this));
    this.server.on(WebSocketServerEvent.ERROR, this.handleError.bind(this));
    this.server.on(WebSocketServerEvent.HEARTBEAT, this.handleHeartbeat.bind(this));

    this.logger.info('WebSocket server started');
  }

  /**
   * Stop the WebSocket server
   */
  public stop(): void {
    this.server.stop();
    this.logger.info('WebSocket server stopped');
  }

  /**
   * Handle new connection
   */
  private handleConnection(connectionId: string): void {
    this.logger.info(`New WebSocket connection: ${connectionId}`);
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(connectionId: string, message: IMessage): Promise<void> {
    try {
      // Add connection ID to message metadata
      message.metadata = {
        ...message.metadata,
        connectionId,
      };

      // Handle message through orchestrator
      await this.orchestrator.handleMessage(message);
    } catch (error) {
      this.logger.error(`Error handling message from ${connectionId}: ${error}`);
      const errorMessage: ErrorMessage = {
        type: MessageType.ERROR,
        timestamp: Date.now(),
        sender: 'server',
        receiver: connectionId,
        correlationId: message.id,
        version: PROTOCOL_VERSION,
        error: 'Message handling failed',
        code: 'MESSAGE_HANDLING_ERROR',
      };
      this.server.send(connectionId, errorMessage);
    }
  }

  /**
   * Handle connection close
   */
  private handleClose(connectionId: string): void {
    this.logger.info(`WebSocket connection closed: ${connectionId}`);
  }

  /**
   * Handle connection error
   */
  private handleError(connectionId: string | null, error: Error): void {
    if (connectionId) {
      this.logger.error(`WebSocket connection error for ${connectionId}: ${error}`);
    } else {
      this.logger.error(`WebSocket server error: ${error}`);
    }
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(connectionId: string): void {
    this.logger.debug(`WebSocket heartbeat from ${connectionId}`);
  }

  /**
   * Send a message to a specific connection
   */
  public send(connectionId: string, message: IMessage): void {
    const wsMessage: ErrorMessage = {
      type: MessageType.ERROR,
      timestamp: message.timestamp,
      sender: 'server',
      receiver: connectionId,
      correlationId: message.id,
      version: PROTOCOL_VERSION,
      error: 'Message conversion error',
      code: 'MESSAGE_CONVERSION_ERROR',
    };
    this.server.send(connectionId, wsMessage);
  }

  /**
   * Broadcast a message to all connections
   */
  public broadcast(message: IMessage): void {
    const wsMessage: ErrorMessage = {
      type: MessageType.ERROR,
      timestamp: message.timestamp,
      sender: message.sender,
      receiver: message.receiver,
      correlationId: message.id,
      version: PROTOCOL_VERSION,
      error: 'Message conversion error',
      code: 'MESSAGE_CONVERSION_ERROR',
    };
    this.server.broadcast(wsMessage);
  }
}
