import { Message, MessageType, BaseMessage, ErrorCode, PROTOCOL_VERSION } from './types';

/**
 * Message validation error
 */
export class MessageValidationError extends Error {
  constructor(
    message: string,
    public code: ErrorCode
  ) {
    super(message);
    this.name = 'MessageValidationError';
  }
}

/**
 * Message validator
 */
export class MessageValidator {
  /**
   * Validate a message
   */
  public static validate(message: unknown): Message {
    if (!this.isBaseMessage(message)) {
      throw new MessageValidationError('Invalid message format', ErrorCode.INVALID_MESSAGE);
    }

    // Check protocol version
    if (message.version !== PROTOCOL_VERSION) {
      throw new MessageValidationError(
        `Protocol version mismatch. Expected ${PROTOCOL_VERSION}, got ${message.version}`,
        ErrorCode.VERSION_MISMATCH
      );
    }

    // Validate required fields
    this.validateRequiredFields(message);

    // Validate message type specific fields
    this.validateMessageType(message);

    return message as Message;
  }

  /**
   * Check if object is a base message
   */
  private static isBaseMessage(obj: unknown): obj is BaseMessage {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      'timestamp' in obj &&
      'sender' in obj &&
      'receiver' in obj &&
      'correlationId' in obj &&
      'version' in obj
    );
  }

  /**
   * Validate required fields
   */
  private static validateRequiredFields(message: BaseMessage): void {
    if (!message.type || !Object.values(MessageType).includes(message.type)) {
      throw new MessageValidationError('Invalid message type', ErrorCode.INVALID_MESSAGE);
    }

    if (!message.timestamp || typeof message.timestamp !== 'number') {
      throw new MessageValidationError('Invalid timestamp', ErrorCode.INVALID_MESSAGE);
    }

    if (!message.sender || typeof message.sender !== 'string') {
      throw new MessageValidationError('Invalid sender', ErrorCode.INVALID_MESSAGE);
    }

    if (!message.receiver || typeof message.receiver !== 'string') {
      throw new MessageValidationError('Invalid receiver', ErrorCode.INVALID_MESSAGE);
    }

    if (!message.correlationId || typeof message.correlationId !== 'string') {
      throw new MessageValidationError('Invalid correlation ID', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate message type specific fields
   */
  private static validateMessageType(message: BaseMessage): void {
    switch (message.type) {
      case MessageType.HEARTBEAT:
        this.validateHeartbeatMessage(message);
        break;
      case MessageType.STATUS_UPDATE:
        this.validateStatusUpdateMessage(message);
        break;
      case MessageType.ERROR:
        this.validateErrorMessage(message);
        break;
      case MessageType.TASK_ASSIGN:
        this.validateTaskAssignMessage(message);
        break;
      case MessageType.TASK_COMPLETE:
        this.validateTaskCompleteMessage(message);
        break;
      case MessageType.TASK_FAIL:
        this.validateTaskFailMessage(message);
        break;
      case MessageType.TASK_PROGRESS:
        this.validateTaskProgressMessage(message);
        break;
      case MessageType.TOOL_REQUEST:
        this.validateToolRequestMessage(message);
        break;
      case MessageType.TOOL_RESPONSE:
        this.validateToolResponseMessage(message);
        break;
      case MessageType.TOOL_ERROR:
        this.validateToolErrorMessage(message);
        break;
      case MessageType.A2A_MESSAGE:
        this.validateA2AMessage(message);
        break;
      case MessageType.A2A_STATE_SYNC:
        this.validateA2AStateSyncMessage(message);
        break;
      default:
        throw new MessageValidationError(
          `Unsupported message type: ${message.type}`,
          ErrorCode.INVALID_MESSAGE
        );
    }
  }

  /**
   * Validate heartbeat message
   */
  private static validateHeartbeatMessage(message: BaseMessage): void {
    const heartbeat = message as any;
    if (!heartbeat.status || !heartbeat.lastHealthCheck) {
      throw new MessageValidationError('Invalid heartbeat message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate status update message
   */
  private static validateStatusUpdateMessage(message: BaseMessage): void {
    const statusUpdate = message as any;
    if (!statusUpdate.status) {
      throw new MessageValidationError('Invalid status update message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate error message
   */
  private static validateErrorMessage(message: BaseMessage): void {
    const error = message as any;
    if (!error.error || !error.code) {
      throw new MessageValidationError('Invalid error message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate task assign message
   */
  private static validateTaskAssignMessage(message: BaseMessage): void {
    const taskAssign = message as any;
    if (
      !taskAssign.taskId ||
      !taskAssign.taskType ||
      !taskAssign.parameters ||
      !taskAssign.priority ||
      !taskAssign.timeout
    ) {
      throw new MessageValidationError('Invalid task assign message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate task complete message
   */
  private static validateTaskCompleteMessage(message: BaseMessage): void {
    const taskComplete = message as any;
    if (!taskComplete.taskId || !taskComplete.result || !taskComplete.duration) {
      throw new MessageValidationError('Invalid task complete message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate task fail message
   */
  private static validateTaskFailMessage(message: BaseMessage): void {
    const taskFail = message as any;
    if (!taskFail.taskId || !taskFail.error || !taskFail.code) {
      throw new MessageValidationError('Invalid task fail message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate task progress message
   */
  private static validateTaskProgressMessage(message: BaseMessage): void {
    const taskProgress = message as any;
    if (!taskProgress.taskId || !taskProgress.progress || !taskProgress.status) {
      throw new MessageValidationError('Invalid task progress message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate tool request message
   */
  private static validateToolRequestMessage(message: BaseMessage): void {
    const toolRequest = message as any;
    if (
      !toolRequest.toolId ||
      !toolRequest.version ||
      !toolRequest.parameters ||
      !toolRequest.timeout
    ) {
      throw new MessageValidationError('Invalid tool request message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate tool response message
   */
  private static validateToolResponseMessage(message: BaseMessage): void {
    const toolResponse = message as any;
    if (!toolResponse.toolId || !toolResponse.result || !toolResponse.duration) {
      throw new MessageValidationError('Invalid tool response message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate tool error message
   */
  private static validateToolErrorMessage(message: BaseMessage): void {
    const toolError = message as any;
    if (!toolError.toolId || !toolError.error || !toolError.code) {
      throw new MessageValidationError('Invalid tool error message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate A2A message
   */
  private static validateA2AMessage(message: BaseMessage): void {
    const a2aMessage = message as any;
    if (!a2aMessage.content || !a2aMessage.metadata) {
      throw new MessageValidationError('Invalid A2A message', ErrorCode.INVALID_MESSAGE);
    }
  }

  /**
   * Validate A2A state sync message
   */
  private static validateA2AStateSyncMessage(message: BaseMessage): void {
    const stateSync = message as any;
    if (!stateSync.state || !stateSync.timestamp) {
      throw new MessageValidationError('Invalid A2A state sync message', ErrorCode.INVALID_MESSAGE);
    }
  }
}
