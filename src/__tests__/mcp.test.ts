import { MCPProtocol, MCPMessageType, MCPToolRegistration } from '../core/protocols/mcp';
import { MessageType } from '../core/interfaces';

describe('MCPProtocol', () => {
  let protocol: MCPProtocol;

  beforeEach(() => {
    protocol = new MCPProtocol();
  });

  describe('createToolRequest', () => {
    it('should create a valid tool request message', () => {
      const toolId = 'test-tool';
      const version = '1.0.0';
      const parameters = { param1: 'value1' };
      const context = { context1: 'value1' };

      const message = protocol.createToolRequest(toolId, version, parameters, context);

      expect(message.type).toBe(MessageType.MCP);
      expect(message.metadata?.protocol).toBe('mcp');
      expect(message.metadata?.version).toBe('1.0');
      expect(message.payload).toEqual({
        type: MCPMessageType.TOOL_REQUEST,
        toolId,
        version,
        parameters,
        context,
      });
    });
  });

  describe('createToolResponse', () => {
    it('should create a valid tool response message', () => {
      const toolId = 'test-tool';
      const version = '1.0.0';
      const result = { output: 'test' };
      const metadata = { duration: 100 };

      const message = protocol.createToolResponse(toolId, version, result, metadata);

      expect(message.type).toBe(MessageType.MCP);
      expect(message.metadata?.protocol).toBe('mcp');
      expect(message.metadata?.version).toBe('1.0');
      expect(message.payload).toEqual({
        type: MCPMessageType.TOOL_RESPONSE,
        toolId,
        version,
        result,
        metadata,
      });
    });
  });

  describe('createToolError', () => {
    it('should create a valid tool error message', () => {
      const toolId = 'test-tool';
      const version = '1.0.0';
      const error = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        details: { reason: 'test' },
      };

      const message = protocol.createToolError(toolId, version, error);

      expect(message.type).toBe(MessageType.MCP);
      expect(message.metadata?.protocol).toBe('mcp');
      expect(message.metadata?.version).toBe('1.0');
      expect(message.payload).toEqual({
        type: MCPMessageType.TOOL_ERROR,
        toolId,
        version,
        error,
      });
    });
  });

  describe('createToolRegistration', () => {
    it('should create a valid tool registration message', () => {
      const tool: MCPToolRegistration = {
        toolId: 'test-tool',
        version: '1.0.0',
        name: 'Test Tool',
        description: 'A test tool',
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'Test parameter',
            required: true,
          },
        ],
        capabilities: ['test'],
        metadata: { category: 'test' },
      };

      const message = protocol.createToolRegistration(tool);

      expect(message.type).toBe(MessageType.MCP);
      expect(message.metadata?.protocol).toBe('mcp');
      expect(message.metadata?.version).toBe('1.0');
      expect(message.payload).toEqual({
        type: MCPMessageType.TOOL_REGISTER,
        ...tool,
      });
    });
  });

  describe('validateMessage', () => {
    it('should validate a valid MCP message', () => {
      const message = protocol.createToolRequest('test-tool', '1.0.0', {});
      expect(protocol.validateMessage(message)).toBe(true);
    });

    it('should reject a message with invalid type', () => {
      const message = protocol.createToolRequest('test-tool', '1.0.0', {});
      message.type = MessageType.TASK;
      expect(protocol.validateMessage(message)).toBe(false);
    });

    it('should reject a message with invalid protocol', () => {
      const message = protocol.createToolRequest('test-tool', '1.0.0', {});
      message.metadata = { protocol: 'invalid' };
      expect(protocol.validateMessage(message)).toBe(false);
    });

    it('should reject a message with invalid MCP type', () => {
      const message = protocol.createToolRequest('test-tool', '1.0.0', {});
      (message.payload as any).type = 'invalid';
      expect(protocol.validateMessage(message)).toBe(false);
    });
  });
});
