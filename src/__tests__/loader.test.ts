import { ConfigLoader, ConfigValidationError } from '../core/config/loader';
import { OrchestratorConfig } from '../core/config/types';
import * as fs from 'fs';

jest.mock('fs');

describe('ConfigLoader', () => {
  let configLoader: ConfigLoader;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    configLoader = new ConfigLoader();
    jest.clearAllMocks();
    process.env = {};
  });

  describe('loadFromFile', () => {
    it('should load configuration from a file', () => {
      const mockConfig = {
        system: {
          name: 'Test Orchestrator',
          version: '2.0.0',
        },
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      configLoader.loadFromFile('config.json');
      const config = configLoader.getConfig();

      expect(config.system.name).toBe('Test Orchestrator');
      expect(config.system.version).toBe('2.0.0');
    });

    it('should throw error when file reading fails', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => configLoader.loadFromFile('nonexistent.json')).toThrow(
        'Failed to load config from file'
      );
    });

    it('should handle invalid JSON in config file', () => {
      mockFs.readFileSync.mockReturnValue('invalid json');

      expect(() => configLoader.loadFromFile('invalid.json')).toThrow(
        'Failed to parse config file'
      );
    });

    it('should handle empty config file', () => {
      mockFs.readFileSync.mockReturnValue('{}');

      configLoader.loadFromFile('empty.json');
      const config = configLoader.getConfig();

      // Should use default values
      expect(config.system.name).toBe('AI Orchestrator');
      expect(config.system.version).toBe('1.0.0');
    });

    it('should handle partial config file', () => {
      const partialConfig = {
        system: {
          name: 'Partial Config',
        },
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(partialConfig));

      configLoader.loadFromFile('partial.json');
      const config = configLoader.getConfig();

      expect(config.system.name).toBe('Partial Config');
      // Should use default values for missing fields
      expect(config.system.version).toBe('1.0.0');
    });
  });

  describe('loadFromEnv', () => {
    it('should load system configuration from environment variables', () => {
      process.env.ORCHESTRATOR_NAME = 'Env Orchestrator';
      process.env.ORCHESTRATOR_VERSION = '3.0.0';
      process.env.ORCHESTRATOR_MAX_CONCURRENCY = '20';

      configLoader.loadFromEnv();
      const config = configLoader.getConfig();

      expect(config.system.name).toBe('Env Orchestrator');
      expect(config.system.version).toBe('3.0.0');
      expect(config.system.maxConcurrency).toBe(20);
    });

    it('should load agent configuration from environment variables', () => {
      process.env.ORCHESTRATOR_AGENT_TIMEOUT = '10000';
      process.env.ORCHESTRATOR_MAX_AGENTS = '50';
      process.env.ORCHESTRATOR_AGENT_RECOVERY_ENABLED = 'true';

      configLoader.loadFromEnv();
      const config = configLoader.getConfig();

      expect(config.agents.defaultTimeout).toBe(10000);
      expect(config.agents.maxAgents).toBe(50);
      expect(config.agents.recovery.enabled).toBe(true);
    });

    it('should load messaging configuration from environment variables', () => {
      process.env.ORCHESTRATOR_MAX_MESSAGE_SIZE = '2048576';
      process.env.ORCHESTRATOR_QUEUE_SIZE = '2000';

      configLoader.loadFromEnv();
      const config = configLoader.getConfig();

      expect(config.messaging.maxMessageSize).toBe(2048576);
      expect(config.messaging.queue.maxSize).toBe(2000);
    });

    it('should load tool configuration from environment variables', () => {
      process.env.ORCHESTRATOR_TOOL_MAX_CONCURRENT = '10';
      process.env.ORCHESTRATOR_TOOL_TIMEOUT = '15000';
      process.env.ORCHESTRATOR_TOOL_VALIDATE = 'false';

      configLoader.loadFromEnv();
      const config = configLoader.getConfig();

      expect(config.tools.maxConcurrentExecutions).toBe(10);
      expect(config.tools.defaultTimeout).toBe(15000);
      expect(config.tools.validateInputs).toBe(false);
    });

    it('should load logging configuration from environment variables', () => {
      process.env.ORCHESTRATOR_LOG_LEVEL = 'debug';
      process.env.ORCHESTRATOR_LOG_CONSOLE = 'false';
      process.env.ORCHESTRATOR_LOG_FILE = 'true';

      configLoader.loadFromEnv();
      const config = configLoader.getConfig();

      expect(config.logging.level).toBe('debug');
      expect(config.logging.console).toBe(false);
      expect(config.logging.file.enabled).toBe(true);
    });

    it('should handle invalid environment variable values', () => {
      process.env.ORCHESTRATOR_MAX_CONCURRENCY = 'invalid';
      process.env.ORCHESTRATOR_AGENT_TIMEOUT = 'invalid';
      process.env.ORCHESTRATOR_MAX_AGENTS = 'invalid';

      configLoader.loadFromEnv();
      const config = configLoader.getConfig();

      // Should use default values when environment variables are invalid
      expect(config.system.maxConcurrency).toBe(10);
      expect(config.agents.defaultTimeout).toBe(5000);
      expect(config.agents.maxAgents).toBe(100);
    });

    it('should handle missing environment variables', () => {
      configLoader.loadFromEnv();
      const config = configLoader.getConfig();

      // Should use default values when environment variables are missing
      expect(config.system.name).toBe('AI Orchestrator');
      expect(config.system.version).toBe('1.0.0');
      expect(config.system.maxConcurrency).toBe(10);
    });

    it('should handle empty string environment variables', () => {
      process.env.ORCHESTRATOR_NAME = '';
      process.env.ORCHESTRATOR_VERSION = '';
      process.env.ORCHESTRATOR_MAX_CONCURRENCY = '';

      configLoader.loadFromEnv();
      const config = configLoader.getConfig();

      // Should use default values when environment variables are empty strings
      expect(config.system.name).toBe('AI Orchestrator');
      expect(config.system.version).toBe('1.0.0');
      expect(config.system.maxConcurrency).toBe(10);
    });

    it('should handle boolean environment variables correctly', () => {
      process.env.ORCHESTRATOR_AGENT_RECOVERY_ENABLED = 'true';
      process.env.ORCHESTRATOR_TOOL_VALIDATE = 'false';
      process.env.ORCHESTRATOR_LOG_CONSOLE = 'true';

      configLoader.loadFromEnv();
      const config = configLoader.getConfig();

      expect(config.agents.recovery.enabled).toBe(true);
      expect(config.tools.validateInputs).toBe(false);
      expect(config.logging.console).toBe(true);
    });

    it('should handle invalid boolean environment variables', () => {
      process.env.ORCHESTRATOR_AGENT_RECOVERY_ENABLED = 'invalid';
      process.env.ORCHESTRATOR_TOOL_VALIDATE = 'invalid';
      process.env.ORCHESTRATOR_LOG_CONSOLE = 'invalid';

      configLoader.loadFromEnv();
      const config = configLoader.getConfig();

      // Should use default values for invalid boolean values
      expect(config.agents.recovery.enabled).toBe(true);
      expect(config.tools.validateInputs).toBe(true);
      expect(config.logging.console).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration with runtime values', () => {
      const updates: Partial<OrchestratorConfig> = {
        system: {
          name: 'Updated Orchestrator',
          version: '1.0.0',
          environment: 'development',
          maxConcurrency: 30,
          operationTimeout: 30000,
          dataDir: './data',
        },
        agents: {
          defaultTimeout: 5000,
          maxAgents: 200,
          recovery: {
            enabled: true,
            maxRetries: 3,
            retryDelay: 1000,
          },
          healthCheck: {
            enabled: true,
            interval: 30000,
            timeout: 5000,
          },
        },
      };

      configLoader.updateConfig(updates);
      const config = configLoader.getConfig();

      expect(config.system.name).toBe('Updated Orchestrator');
      expect(config.system.maxConcurrency).toBe(30);
      expect(config.agents.maxAgents).toBe(200);
    });

    it('should handle partial updates', () => {
      const updates: Partial<OrchestratorConfig> = {
        system: {
          name: 'Partial Update',
          version: '1.0.0',
          environment: 'development',
          maxConcurrency: 10,
          operationTimeout: 30000,
          dataDir: './data',
        },
      };

      configLoader.updateConfig(updates);
      const config = configLoader.getConfig();

      expect(config.system.name).toBe('Partial Update');
      // Other values should remain unchanged
      expect(config.system.version).toBe('1.0.0');
      expect(config.system.maxConcurrency).toBe(10);
    });

    it('should handle deep nested updates', () => {
      const updates: Partial<OrchestratorConfig> = {
        agents: {
          recovery: {
            enabled: false,
            maxRetries: 5,
            retryDelay: 1000,
          },
          defaultTimeout: 5000,
          maxAgents: 100,
          healthCheck: {
            enabled: true,
            interval: 30000,
            timeout: 5000,
          },
        },
      };

      configLoader.updateConfig(updates);
      const config = configLoader.getConfig();

      expect(config.agents.recovery.enabled).toBe(false);
      expect(config.agents.recovery.maxRetries).toBe(5);
      // Other nested values should remain unchanged
      expect(config.agents.recovery.retryDelay).toBe(1000);
    });

    it('should handle null updates', () => {
      const updates: Partial<OrchestratorConfig> = {
        system: null as any,
      };

      configLoader.updateConfig(updates);
      const config = configLoader.getConfig();

      // Should not affect existing config
      expect(config.system.name).toBe('AI Orchestrator');
      expect(config.system.version).toBe('1.0.0');
    });

    it('should handle undefined updates', () => {
      const updates: Partial<OrchestratorConfig> = {
        system: undefined as any,
      };

      configLoader.updateConfig(updates);
      const config = configLoader.getConfig();

      // Should not affect existing config
      expect(config.system.name).toBe('AI Orchestrator');
      expect(config.system.version).toBe('1.0.0');
    });
  });

  describe('validate', () => {
    it('should validate system configuration', () => {
      configLoader.updateConfig({
        system: {
          name: 'Test',
          version: '1.0.0',
          environment: 'development',
          maxConcurrency: 0,
          operationTimeout: 30000,
          dataDir: './data',
        },
      });

      expect(() => configLoader.validate()).toThrow(ConfigValidationError);
      expect(() => configLoader.validate()).toThrow('maxConcurrency must be greater than 0');
    });

    it('should validate agent configuration', () => {
      configLoader.updateConfig({
        agents: {
          defaultTimeout: 5000,
          maxAgents: -1,
          recovery: {
            enabled: true,
            maxRetries: 3,
            retryDelay: 1000,
          },
          healthCheck: {
            enabled: true,
            interval: 30000,
            timeout: 5000,
          },
        },
      });

      expect(() => configLoader.validate()).toThrow(ConfigValidationError);
      expect(() => configLoader.validate()).toThrow('maxAgents must be greater than 0');
    });

    it('should validate messaging configuration', () => {
      configLoader.updateConfig({
        messaging: {
          maxMessageSize: 0,
          retentionPeriod: 24 * 60 * 60 * 1000,
          queue: {
            maxSize: 1000,
            persistent: true,
          },
          rateLimit: {
            enabled: true,
            maxRequests: 1000,
            windowMs: 60000,
          },
        },
      });

      expect(() => configLoader.validate()).toThrow(ConfigValidationError);
      expect(() => configLoader.validate()).toThrow('maxMessageSize must be greater than 0');
    });

    it('should validate tool configuration', () => {
      configLoader.updateConfig({
        tools: {
          maxConcurrentExecutions: 0,
          defaultTimeout: 10000,
          validateInputs: true,
          cacheResults: true,
          retry: {
            enabled: true,
            maxRetries: 3,
            retryDelay: 1000,
          },
        },
      });

      expect(() => configLoader.validate()).toThrow(ConfigValidationError);
      expect(() => configLoader.validate()).toThrow(
        'maxConcurrentExecutions must be greater than 0'
      );
    });

    it('should validate logging configuration', () => {
      configLoader.updateConfig({
        logging: {
          level: 'invalid' as any,
          console: true,
          file: {
            enabled: true,
            directory: './logs',
            maxSize: 10 * 1024 * 1024,
            maxFiles: 5,
          },
        },
      });

      expect(() => configLoader.validate()).toThrow(ConfigValidationError);
      expect(() => configLoader.validate()).toThrow(
        'Log level must be one of: debug, info, warn, error'
      );
    });

    it('should validate required fields', () => {
      configLoader.updateConfig({
        system: {
          name: '',
          version: '',
          environment: '',
          maxConcurrency: 10,
          operationTimeout: 30000,
          dataDir: './data',
        },
      });

      expect(() => configLoader.validate()).toThrow(ConfigValidationError);
      expect(() => configLoader.validate()).toThrow('System name is required');
    });

    it('should validate nested required fields', () => {
      configLoader.updateConfig({
        agents: {
          defaultTimeout: 5000,
          maxAgents: 100,
          recovery: {
            enabled: true,
            maxRetries: 3,
            retryDelay: 0,
          },
          healthCheck: {
            enabled: true,
            interval: 30000,
            timeout: 5000,
          },
        },
      });

      expect(() => configLoader.validate()).toThrow(ConfigValidationError);
      expect(() => configLoader.validate()).toThrow('retryDelay must be greater than 0');
    });

    it('should validate rate limit configuration', () => {
      configLoader.updateConfig({
        messaging: {
          maxMessageSize: 1024 * 1024,
          retentionPeriod: 24 * 60 * 60 * 1000,
          queue: {
            maxSize: 1000,
            persistent: true,
          },
          rateLimit: {
            enabled: true,
            maxRequests: 0,
            windowMs: 60000,
          },
        },
      });

      expect(() => configLoader.validate()).toThrow(ConfigValidationError);
      expect(() => configLoader.validate()).toThrow('maxRequests must be greater than 0');
    });

    it('should validate file logging configuration', () => {
      configLoader.updateConfig({
        logging: {
          level: 'info',
          console: true,
          file: {
            enabled: true,
            directory: '',
            maxSize: 0,
            maxFiles: 0,
          },
        },
      });

      expect(() => configLoader.validate()).toThrow(ConfigValidationError);
      expect(() => configLoader.validate()).toThrow(
        'Log directory is required when file logging is enabled'
      );
    });
  });
});
