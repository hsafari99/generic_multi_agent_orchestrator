import {
  OrchestratorWebSocket,
  OrchestratorWebSocketConfig,
} from '../core/communication/websocket/orchestratorWebSocket';
import {
  WebSocketServerManager,
  WebSocketServerEvent,
} from '../core/communication/websocket/server';
import { IOrchestrator } from '../core/interfaces';
import { IMessage, MessageType } from '../core/interfaces';
import { PROTOCOL_VERSION } from '../core/communication/types';

jest.mock('../core/communication/websocket/server', () => {
  const mockWebSocketServer = {
    on: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    send: jest.fn(),
    broadcast: jest.fn(),
  };

  return {
    WebSocketServerManager: jest.fn().mockImplementation(() => mockWebSocketServer),
    WebSocketServerEvent: {
      CONNECTION: 'connection',
      MESSAGE: 'message',
      CLOSE: 'close',
      ERROR: 'error',
      HEARTBEAT: 'heartbeat',
    },
  };
});

jest.mock('../core/logging/logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

describe('OrchestratorWebSocket', () => {
  let orchestratorWebSocket: OrchestratorWebSocket;
  let mockOrchestrator: IOrchestrator;
  let mockWebSocketServer: WebSocketServerManager;
  let config: OrchestratorWebSocketConfig;

  beforeEach(() => {
    mockOrchestrator = {
      handleMessage: jest.fn(),
    };

    config = {
      port: 8080,
      path: '/ws',
      heartbeatInterval: 30000,
      maxConnections: 100,
    };

    orchestratorWebSocket = new OrchestratorWebSocket(mockOrchestrator, config);
    mockWebSocketServer = new WebSocketServerManager(config);

    // Set up mock event handlers
    const mockHandlers: { [key: string]: (...args: any[]) => void } = {};
    (mockWebSocketServer.on as jest.Mock).mockImplementation((event, handler) => {
      mockHandlers[event] = handler;
    });

    // Store handlers in the mock for later retrieval
    (mockWebSocketServer.on as jest.Mock).mock.calls = Object.entries(mockHandlers).map(
      ([event, handler]) => [event, handler]
    );

    // Start the WebSocket server to register all event handlers
    orchestratorWebSocket.start();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start the WebSocket server and set up event handlers', () => {
      orchestratorWebSocket.start();

      expect(mockWebSocketServer.start).toHaveBeenCalled();
      expect(mockWebSocketServer.on).toHaveBeenCalledWith(
        WebSocketServerEvent.CONNECTION,
        expect.any(Function)
      );
      expect(mockWebSocketServer.on).toHaveBeenCalledWith(
        WebSocketServerEvent.MESSAGE,
        expect.any(Function)
      );
      expect(mockWebSocketServer.on).toHaveBeenCalledWith(
        WebSocketServerEvent.CLOSE,
        expect.any(Function)
      );
      expect(mockWebSocketServer.on).toHaveBeenCalledWith(
        WebSocketServerEvent.ERROR,
        expect.any(Function)
      );
      expect(mockWebSocketServer.on).toHaveBeenCalledWith(
        WebSocketServerEvent.HEARTBEAT,
        expect.any(Function)
      );
    });
  });

  describe('stop', () => {
    it('should stop the WebSocket server', () => {
      orchestratorWebSocket.stop();

      expect(mockWebSocketServer.stop).toHaveBeenCalled();
    });
  });

  describe('handleConnection', () => {
    it('should handle new connections', () => {
      const connectionId = 'conn_1';
      const connectionHandler = (mockWebSocketServer.on as jest.Mock).mock.calls.find(
        call => call[0] === WebSocketServerEvent.CONNECTION
      )[1];

      connectionHandler(connectionId);
      // Verify connection handling (add expectations based on your logging implementation)
    });
  });

  describe('handleMessage', () => {
    it('should handle valid messages', async () => {
      const connectionId = 'conn_1';
      const message: IMessage = {
        id: 'msg_1',
        type: MessageType.TASK,
        sender: 'client',
        receiver: 'server',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: {
          priority: 1,
          requiresAck: true,
        },
      };

      const messageHandler = (mockWebSocketServer.on as jest.Mock).mock.calls.find(
        call => call[0] === WebSocketServerEvent.MESSAGE
      )[1];

      await messageHandler(connectionId, message);

      expect(mockOrchestrator.handleMessage).toHaveBeenCalledWith({
        ...message,
        metadata: {
          ...message.metadata,
          connectionId,
        },
      });
    });

    it('should handle message handling errors', async () => {
      const connectionId = 'conn_1';
      const message: IMessage = {
        id: 'msg_1',
        type: MessageType.TASK,
        sender: 'client',
        receiver: 'server',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: {
          priority: 1,
          requiresAck: true,
        },
      };

      const error = new Error('Message handling failed');
      (mockOrchestrator.handleMessage as jest.Mock).mockRejectedValueOnce(error);

      const messageHandler = (mockWebSocketServer.on as jest.Mock).mock.calls.find(
        call => call[0] === WebSocketServerEvent.MESSAGE
      )[1];

      await messageHandler(connectionId, message);

      expect(mockWebSocketServer.send).toHaveBeenCalledWith(
        connectionId,
        expect.objectContaining({
          type: 'error',
          sender: 'server',
          receiver: connectionId,
          correlationId: message.id,
          version: PROTOCOL_VERSION,
          error: 'Message handling failed',
          code: 'MESSAGE_HANDLING_ERROR',
        })
      );
    });
  });

  describe('handleClose', () => {
    it('should handle connection close', () => {
      const connectionId = 'conn_1';
      const closeHandler = (mockWebSocketServer.on as jest.Mock).mock.calls.find(
        call => call[0] === WebSocketServerEvent.CLOSE
      )[1];

      closeHandler(connectionId);
      // Verify close handling (add expectations based on your logging implementation)
    });
  });

  describe('handleError', () => {
    it('should handle connection errors', () => {
      const connectionId = 'conn_1';
      const error = new Error('Connection error');
      const errorHandler = (mockWebSocketServer.on as jest.Mock).mock.calls.find(
        call => call[0] === WebSocketServerEvent.ERROR
      )[1];

      errorHandler(connectionId, error);
      // Verify error handling (add expectations based on your logging implementation)
    });

    it('should handle server errors', () => {
      const error = new Error('Server error');
      const errorHandler = (mockWebSocketServer.on as jest.Mock).mock.calls.find(
        call => call[0] === WebSocketServerEvent.ERROR
      )[1];

      errorHandler(null, error);
      // Verify error handling (add expectations based on your logging implementation)
    });
  });

  describe('handleHeartbeat', () => {
    it('should handle heartbeat events', () => {
      const connectionId = 'conn_1';
      const heartbeatHandler = (mockWebSocketServer.on as jest.Mock).mock.calls.find(
        call => call[0] === WebSocketServerEvent.HEARTBEAT
      )[1];

      heartbeatHandler(connectionId);
      // Verify heartbeat handling (add expectations based on your logging implementation)
    });
  });

  describe('send', () => {
    it('should send messages to specific connections', () => {
      const connectionId = 'conn_1';
      const message: IMessage = {
        id: 'msg_1',
        type: MessageType.TASK,
        sender: 'server',
        receiver: 'client',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: {
          priority: 1,
          requiresAck: true,
        },
      };

      orchestratorWebSocket.send(connectionId, message);

      expect(mockWebSocketServer.send).toHaveBeenCalledWith(
        connectionId,
        expect.objectContaining({
          type: 'error',
          sender: 'server',
          receiver: connectionId,
          correlationId: message.id,
          version: PROTOCOL_VERSION,
          error: 'Message conversion error',
          code: 'MESSAGE_CONVERSION_ERROR',
        })
      );
    });
  });

  describe('broadcast', () => {
    it('should broadcast messages to all connections', () => {
      const message: IMessage = {
        id: 'msg_1',
        type: MessageType.TASK,
        sender: 'server',
        receiver: 'all',
        payload: { task: 'test' },
        timestamp: Date.now(),
        metadata: {
          priority: 1,
          requiresAck: true,
        },
      };

      orchestratorWebSocket.broadcast(message);

      expect(mockWebSocketServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          sender: 'server',
          receiver: 'all',
          correlationId: message.id,
          version: PROTOCOL_VERSION,
          error: 'Message conversion error',
          code: 'MESSAGE_CONVERSION_ERROR',
        })
      );
    });
  });
});
