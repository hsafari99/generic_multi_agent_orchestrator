import {
  WebSocketServerManager,
  WebSocketServerEvent,
} from '../core/communication/websocket/server';
import { MessageType, PROTOCOL_VERSION, HeartbeatMessage } from '../core/communication/types';
import { AgentStatus } from '../core/agent/types';
import { WebSocket, WebSocketServer } from 'ws';

jest.mock('ws', () => {
  const mockWebSocket = {
    on: jest.fn(),
    send: jest.fn(),
    ping: jest.fn(),
    terminate: jest.fn(),
  };

  const mockWebSocketServer = {
    on: jest.fn(),
    close: jest.fn(),
  };

  return {
    WebSocket: jest.fn().mockImplementation(() => mockWebSocket),
    WebSocketServer: jest.fn().mockImplementation(() => mockWebSocketServer),
  };
});

jest.mock('../core/logging/logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    }),
  },
}));

describe('WebSocketServerManager', () => {
  let server: WebSocketServerManager;
  let mockWebSocket: WebSocket;
  let mockWebSocketServer: WebSocketServer;

  beforeEach(() => {
    jest.useFakeTimers();
    server = new WebSocketServerManager({
      port: 8080,
      heartbeatInterval: 1000,
    });

    mockWebSocket = new WebSocket('ws://localhost:8080');
    mockWebSocketServer = new WebSocketServer();

    // Mock the connection ID generation
    jest.spyOn(server as any, 'generateConnectionId').mockReturnValue('conn_1');

    // Start the server and simulate connection
    server.start();
    const connectionHandler = (mockWebSocketServer.on as jest.Mock).mock.calls.find(
      call => call[0] === 'connection'
    )[1];
    connectionHandler(mockWebSocket);

    // Manually add the connection to the server's connections map
    server['connections'].set('conn_1', {
      id: 'conn_1',
      ws: mockWebSocket,
      isAlive: true,
      lastHeartbeat: Date.now(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    server.stop();
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start the server and emit connection event', () => {
      const onConnection = jest.fn();
      server.on(WebSocketServerEvent.CONNECTION, onConnection);

      server.start();
      const connectionHandler = (mockWebSocketServer.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockWebSocket);

      expect(onConnection).toHaveBeenCalled();
    });

    it('should start with custom path if provided', () => {
      const customServer = new WebSocketServerManager({
        port: 8080,
        path: '/custom',
        heartbeatInterval: 1000,
      });
      customServer.start();
      expect(WebSocketServer).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 8080,
          path: '/custom',
        })
      );
    });
  });

  describe('stop', () => {
    it('should stop the server and clear heartbeat interval', () => {
      server.start();
      server.stop();
      expect(mockWebSocketServer.close).toHaveBeenCalled();
    });

    it('should handle multiple stop calls gracefully', () => {
      server.start();
      server.stop();
      server.stop();
      expect(mockWebSocketServer.close).toHaveBeenCalledTimes(2);
    });
  });

  describe('send', () => {
    it('should send a message to a specific connection', () => {
      const message = {
        type: MessageType.HEARTBEAT as const,
        timestamp: Date.now(),
        sender: 'test',
        receiver: 'server',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        status: AgentStatus.READY,
        lastHealthCheck: Date.now(),
      } as HeartbeatMessage;

      server.send('conn_1', message);
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should throw error if connection not found', () => {
      server.start();
      expect(() => {
        server.send('non_existent', {} as any);
      }).toThrow('Connection non_existent not found');
    });

    it('should handle send errors gracefully', () => {
      const message = {} as any;
      (mockWebSocket.send as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Send failed');
      });
      expect(() => server.send('conn_1', message)).toThrow('Send failed');
    });
  });

  describe('broadcast', () => {
    it('should send a message to all connections', () => {
      const message = {
        type: MessageType.HEARTBEAT as const,
        timestamp: Date.now(),
        sender: 'test',
        receiver: 'all',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        status: AgentStatus.READY,
        lastHealthCheck: Date.now(),
      } as HeartbeatMessage;

      server.broadcast(message);
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should handle broadcast errors gracefully', () => {
      const message = {} as any;
      (mockWebSocket.send as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Broadcast failed');
      });
      server.broadcast(message);
      // Should not throw, just log error
    });
  });

  describe('message handling', () => {
    it('should validate and emit valid messages', () => {
      const onMessage = jest.fn();
      server.on(WebSocketServerEvent.MESSAGE, onMessage);

      const message = {
        type: MessageType.HEARTBEAT as const,
        timestamp: Date.now(),
        sender: 'test',
        receiver: 'server',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        status: AgentStatus.READY,
        lastHealthCheck: Date.now(),
      } as HeartbeatMessage;

      // Call handleMessage directly with the connection ID and message
      (server as any).handleMessage('conn_1', JSON.stringify(message));
      expect(onMessage).toHaveBeenCalledWith('conn_1', message);
    });

    it('should handle invalid messages', () => {
      const messageHandler = (mockWebSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      )[1];

      messageHandler('invalid json');
      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'));
    });

    it('should handle malformed JSON', () => {
      const messageHandler = (mockWebSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      )[1];

      messageHandler('{invalid json');
      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'));
    });
  });

  describe('connection handling', () => {
    it('should handle connection close', () => {
      const onClose = jest.fn();
      server.on(WebSocketServerEvent.CLOSE, onClose);

      // Call handleClose directly with the connection ID
      (server as any).handleClose('conn_1');
      expect(onClose).toHaveBeenCalledWith('conn_1');
      expect(server['connections'].has('conn_1')).toBe(false);
    });

    it('should handle connection errors', () => {
      const onError = jest.fn();
      server.on(WebSocketServerEvent.ERROR, onError);

      // Call handleConnectionError directly with the connection ID and error
      const error = new Error('Connection error');
      (server as any).handleConnectionError('conn_1', error);
      expect(onError).toHaveBeenCalledWith('conn_1', error);
    });

    it('should handle server errors', () => {
      const onError = jest.fn();
      server.on(WebSocketServerEvent.ERROR, onError);

      // Call handleError directly with the error
      const error = new Error('Server error');
      (server as any).handleError(error);
      expect(onError).toHaveBeenCalledWith(null, error);
    });
  });

  describe('heartbeat', () => {
    it('should terminate inactive connections', () => {
      // Simulate connection becoming inactive
      const connection = server['connections'].get('conn_1');
      expect(connection).toBeDefined();
      (connection as any).isAlive = false;

      // Wait for heartbeat interval
      jest.advanceTimersByTime(1000);

      expect(mockWebSocket.terminate).toHaveBeenCalled();
    });

    it('should update connection status on pong', () => {
      const onHeartbeat = jest.fn();
      server.on(WebSocketServerEvent.HEARTBEAT, onHeartbeat);

      // Call handlePong directly with the connection ID
      (server as any).handlePong('conn_1');

      // Verify the connection was updated
      const updatedConnection = server['connections'].get('conn_1');
      expect(updatedConnection?.isAlive).toBe(true);
      expect(onHeartbeat).toHaveBeenCalledWith('conn_1');
    });

    it('should ping all connections on heartbeat interval', () => {
      jest.advanceTimersByTime(1000);
      expect(mockWebSocket.ping).toHaveBeenCalled();
    });

    it('should handle custom heartbeat interval', () => {
      const customServer = new WebSocketServerManager({
        port: 8080,
        heartbeatInterval: 5000,
      });
      customServer.start();
      jest.advanceTimersByTime(5000);
      expect(mockWebSocket.ping).toHaveBeenCalled();
    });
  });
});
