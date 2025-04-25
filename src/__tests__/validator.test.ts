import { MessageValidator, MessageValidationError } from '../core/communication/validator';
import { MessageType, PROTOCOL_VERSION } from '../core/communication/types';

describe('MessageValidator', () => {
  describe('validate', () => {
    it('should validate a valid heartbeat message', () => {
      const message = {
        type: MessageType.HEARTBEAT,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        status: 'ready',
        lastHealthCheck: Date.now(),
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid message format', () => {
      const message = {
        type: MessageType.HEARTBEAT,
        // Missing required fields
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid message format');
    });

    it('should throw on protocol version mismatch', () => {
      const message = {
        type: MessageType.HEARTBEAT,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: '0.9.0', // Different version
        status: 'ready',
        lastHealthCheck: Date.now(),
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Protocol version mismatch');
    });

    it('should validate a valid task assign message', () => {
      const message = {
        type: MessageType.TASK_ASSIGN,
        timestamp: Date.now(),
        sender: 'orchestrator',
        receiver: 'agent1',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        taskId: 'task1',
        taskType: 'test',
        parameters: {},
        priority: 1,
        timeout: 5000,
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid task assign message', () => {
      const message = {
        type: MessageType.TASK_ASSIGN,
        timestamp: Date.now(),
        sender: 'orchestrator',
        receiver: 'agent1',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing required fields
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid task assign message');
    });

    it('should validate a valid tool request message', () => {
      const message = {
        type: MessageType.TOOL_REQUEST,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        toolId: 'tool1',
        toolVersion: '1.0.0',
        parameters: {},
        timeout: 5000,
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid tool request message', () => {
      const message = {
        type: MessageType.TOOL_REQUEST,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing required fields
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid tool request message');
    });

    it('should validate a valid A2A message', () => {
      const message = {
        type: MessageType.A2A_MESSAGE,
        timestamp: Date.now(),
        sender: 'orchestrator1',
        receiver: 'orchestrator2',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        content: {},
        metadata: {},
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid A2A message', () => {
      const message = {
        type: MessageType.A2A_MESSAGE,
        timestamp: Date.now(),
        sender: 'orchestrator1',
        receiver: 'orchestrator2',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing required fields
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid A2A message');
    });

    it('should throw on unsupported message type', () => {
      const message = {
        type: 'unsupported',
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid message type');
    });

    it('should validate a valid status update message', () => {
      const message = {
        type: MessageType.STATUS_UPDATE,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        status: 'ready',
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid status update message', () => {
      const message = {
        type: MessageType.STATUS_UPDATE,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing status
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid status update message');
    });

    it('should validate a valid error message', () => {
      const message = {
        type: MessageType.ERROR,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        error: 'Test error',
        code: 'TEST_ERROR',
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid error message', () => {
      const message = {
        type: MessageType.ERROR,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing error and code
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid error message');
    });

    it('should validate a valid task complete message', () => {
      const message = {
        type: MessageType.TASK_COMPLETE,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        taskId: 'task1',
        result: {},
        duration: 1000,
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid task complete message', () => {
      const message = {
        type: MessageType.TASK_COMPLETE,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing required fields
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid task complete message');
    });

    it('should validate a valid task fail message', () => {
      const message = {
        type: MessageType.TASK_FAIL,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        taskId: 'task1',
        error: 'Task failed',
        code: 'TASK_FAILED',
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid task fail message', () => {
      const message = {
        type: MessageType.TASK_FAIL,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing required fields
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid task fail message');
    });

    it('should validate a valid task progress message', () => {
      const message = {
        type: MessageType.TASK_PROGRESS,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        taskId: 'task1',
        progress: 50,
        status: 'in_progress',
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid task progress message', () => {
      const message = {
        type: MessageType.TASK_PROGRESS,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing required fields
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid task progress message');
    });

    it('should validate a valid tool response message', () => {
      const message = {
        type: MessageType.TOOL_RESPONSE,
        timestamp: Date.now(),
        sender: 'orchestrator',
        receiver: 'agent1',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        toolId: 'tool1',
        result: {},
        duration: 1000,
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid tool response message', () => {
      const message = {
        type: MessageType.TOOL_RESPONSE,
        timestamp: Date.now(),
        sender: 'orchestrator',
        receiver: 'agent1',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing required fields
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid tool response message');
    });

    it('should validate a valid tool error message', () => {
      const message = {
        type: MessageType.TOOL_ERROR,
        timestamp: Date.now(),
        sender: 'orchestrator',
        receiver: 'agent1',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        toolId: 'tool1',
        error: 'Tool error',
        code: 'TOOL_ERROR',
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid tool error message', () => {
      const message = {
        type: MessageType.TOOL_ERROR,
        timestamp: Date.now(),
        sender: 'orchestrator',
        receiver: 'agent1',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing required fields
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid tool error message');
    });

    it('should validate a valid A2A state sync message', () => {
      const message = {
        type: MessageType.A2A_STATE_SYNC,
        timestamp: Date.now(),
        sender: 'orchestrator1',
        receiver: 'orchestrator2',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        state: {},
        stateTimestamp: Date.now(),
      };

      expect(() => MessageValidator.validate(message)).not.toThrow();
    });

    it('should throw on invalid A2A state sync message', () => {
      const message = {
        type: MessageType.A2A_STATE_SYNC,
        timestamp: Date.now(),
        sender: 'orchestrator1',
        receiver: 'orchestrator2',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        // Missing required fields
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid A2A state sync message');
    });

    it('should throw on invalid timestamp', () => {
      const message = {
        type: MessageType.HEARTBEAT,
        timestamp: 'invalid', // Invalid timestamp type
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        status: 'ready',
        lastHealthCheck: Date.now(),
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid timestamp');
    });

    it('should throw on invalid sender', () => {
      const message = {
        type: MessageType.HEARTBEAT,
        timestamp: Date.now(),
        sender: 123, // Invalid sender type
        receiver: 'orchestrator',
        correlationId: '123',
        version: PROTOCOL_VERSION,
        status: 'ready',
        lastHealthCheck: Date.now(),
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid sender');
    });

    it('should throw on invalid receiver', () => {
      const message = {
        type: MessageType.HEARTBEAT,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 123, // Invalid receiver type
        correlationId: '123',
        version: PROTOCOL_VERSION,
        status: 'ready',
        lastHealthCheck: Date.now(),
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid receiver');
    });

    it('should throw on invalid correlation ID', () => {
      const message = {
        type: MessageType.HEARTBEAT,
        timestamp: Date.now(),
        sender: 'agent1',
        receiver: 'orchestrator',
        correlationId: 123, // Invalid correlation ID type
        version: PROTOCOL_VERSION,
        status: 'ready',
        lastHealthCheck: Date.now(),
      };

      expect(() => MessageValidator.validate(message)).toThrow(MessageValidationError);
      expect(() => MessageValidator.validate(message)).toThrow('Invalid correlation ID');
    });
  });
});
