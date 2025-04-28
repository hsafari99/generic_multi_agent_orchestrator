import { IMessage, MessageType } from '../interfaces';
import { Logger } from '../logging/logger';

export enum MCPMessageType {
  TOOL_REQUEST = 'tool_request',
  TOOL_RESPONSE = 'tool_response',
  TOOL_ERROR = 'tool_error',
  TOOL_REGISTER = 'tool_register',
  TOOL_UNREGISTER = 'tool_unregister',
  TOOL_LIST = 'tool_list',
  TOOL_DESCRIBE = 'tool_describe',
}

export interface MCPToolRequest {
  toolId: string;
  version: string;
  parameters: Record<string, any>;
  context?: Record<string, any>;
}

export interface MCPToolResponse {
  toolId: string;
  version: string;
  result: any;
  metadata?: Record<string, any>;
}

export interface MCPToolError {
  toolId: string;
  version: string;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface MCPToolRegistration {
  toolId: string;
  version: string;
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
  capabilities: string[];
  metadata?: Record<string, any>;
}

export class MCPProtocol {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  createToolRequest(
    toolId: string,
    version: string,
    parameters: Record<string, any>,
    context?: Record<string, any>
  ): IMessage {
    return {
      id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: MessageType.MCP,
      sender: 'system',
      receiver: 'tool-manager',
      payload: {
        type: MCPMessageType.TOOL_REQUEST,
        toolId,
        version,
        parameters,
        context,
      },
      timestamp: Date.now(),
      metadata: {
        protocol: 'mcp',
        version: '1.0',
      },
    };
  }

  createToolResponse(
    toolId: string,
    version: string,
    result: any,
    metadata?: Record<string, any>
  ): IMessage {
    return {
      id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: MessageType.MCP,
      sender: 'tool-manager',
      receiver: 'system',
      payload: {
        type: MCPMessageType.TOOL_RESPONSE,
        toolId,
        version,
        result,
        metadata,
      },
      timestamp: Date.now(),
      metadata: {
        protocol: 'mcp',
        version: '1.0',
      },
    };
  }

  createToolError(
    toolId: string,
    version: string,
    error: { code: string; message: string; details?: any }
  ): IMessage {
    return {
      id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: MessageType.MCP,
      sender: 'tool-manager',
      receiver: 'system',
      payload: {
        type: MCPMessageType.TOOL_ERROR,
        toolId,
        version,
        error,
      },
      timestamp: Date.now(),
      metadata: {
        protocol: 'mcp',
        version: '1.0',
      },
    };
  }

  createToolRegistration(tool: MCPToolRegistration): IMessage {
    return {
      id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: MessageType.MCP,
      sender: 'system',
      receiver: 'tool-manager',
      payload: {
        type: MCPMessageType.TOOL_REGISTER,
        ...tool,
      },
      timestamp: Date.now(),
      metadata: {
        protocol: 'mcp',
        version: '1.0',
      },
    };
  }

  createToolUnregister(toolId: string, version: string): IMessage {
    return {
      id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: MessageType.MCP,
      sender: 'system',
      receiver: 'tool-manager',
      payload: {
        type: MCPMessageType.TOOL_UNREGISTER,
        toolId,
        version,
      },
      timestamp: Date.now(),
      metadata: {
        protocol: 'mcp',
        version: '1.0',
      },
    };
  }

  createToolList(): IMessage {
    return {
      id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: MessageType.MCP,
      sender: 'system',
      receiver: 'tool-manager',
      payload: {
        type: MCPMessageType.TOOL_LIST,
      },
      timestamp: Date.now(),
      metadata: {
        protocol: 'mcp',
        version: '1.0',
      },
    };
  }

  createToolDescribe(toolId: string, version: string): IMessage {
    return {
      id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: MessageType.MCP,
      sender: 'system',
      receiver: 'tool-manager',
      payload: {
        type: MCPMessageType.TOOL_DESCRIBE,
        toolId,
        version,
      },
      timestamp: Date.now(),
      metadata: {
        protocol: 'mcp',
        version: '1.0',
      },
    };
  }

  validateMessage(message: IMessage): boolean {
    if (message.type !== MessageType.MCP) {
      this.logger.error('Invalid message type for MCP protocol', { message });
      return false;
    }

    if (!message.metadata?.protocol || message.metadata.protocol !== 'mcp') {
      this.logger.error('Invalid protocol in message metadata', { message });
      return false;
    }

    const payload = message.payload as any;
    if (!payload.type || !Object.values(MCPMessageType).includes(payload.type)) {
      this.logger.error('Invalid MCP message type', { message });
      return false;
    }

    return true;
  }
}
