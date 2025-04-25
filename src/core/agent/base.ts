import { IAgent, AgentConfig, AgentState, AgentStatus, AgentCapabilities } from './types';
import { Logger } from '../logging/logger';

/**
 * Base agent class implementing the IAgent interface
 */
export abstract class BaseAgent implements IAgent {
  protected config: AgentConfig;
  protected state: AgentState;
  protected logger: Logger;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      status: AgentStatus.INITIALIZING,
      activeOperations: 0,
      lastStatusChange: new Date(),
      lastHealthCheck: new Date(),
    };
    this.logger = Logger.getInstance();
  }

  /**
   * Get agent configuration
   */
  public getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Get current agent state
   */
  public getState(): AgentState {
    return this.state;
  }

  /**
   * Initialize the agent
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info(`Initializing agent ${this.config.name}`);
      await this.onInitialize();
      this.updateStatus(AgentStatus.READY);
      this.logger.info(`Agent ${this.config.name} initialized successfully`);
    } catch (error) {
      this.handleError('Initialization failed', error);
      throw error;
    }
  }

  /**
   * Start the agent
   */
  public async start(): Promise<void> {
    if (this.state.status === AgentStatus.ERROR) {
      throw new Error('Cannot start agent in ERROR state');
    }
    if (this.state.status === AgentStatus.SHUTDOWN) {
      throw new Error('Cannot start agent in SHUTDOWN state');
    }
    try {
      this.logger.info(`Starting agent ${this.config.name}`);
      await this.onStart();
      this.startHealthCheck();
      this.logger.info(`Agent ${this.config.name} started successfully`);
    } catch (error) {
      this.handleError('Start failed', error);
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  public async stop(): Promise<void> {
    if (this.state.status === AgentStatus.SHUTDOWN) {
      throw new Error('Cannot stop agent in SHUTDOWN state');
    }
    try {
      this.logger.info(`Stopping agent ${this.config.name}`);
      this.stopHealthCheck();
      await this.onStop();
      this.logger.info(`Agent ${this.config.name} stopped successfully`);
    } catch (error) {
      this.handleError('Stop failed', error);
      throw error;
    }
  }

  /**
   * Shutdown the agent
   */
  public async shutdown(): Promise<void> {
    try {
      this.logger.info(`Shutting down agent ${this.config.name}`);
      this.stopHealthCheck();
      await this.onShutdown();
      this.updateStatus(AgentStatus.SHUTDOWN);
      this.logger.info(`Agent ${this.config.name} shut down successfully`);
    } catch (error) {
      this.handleError('Shutdown failed', error);
      throw error;
    }
  }

  /**
   * Check agent health
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.onHealthCheck();
      this.state.lastHealthCheck = new Date();
      if (!isHealthy) {
        this.updateStatus(AgentStatus.ERROR);
      }
      return isHealthy;
    } catch (error) {
      this.handleError('Health check failed', error);
      return false;
    }
  }

  /**
   * Update agent capabilities
   */
  public async updateCapabilities(capabilities: AgentCapabilities): Promise<void> {
    try {
      this.logger.info(`Updating capabilities for agent ${this.config.name}`);
      await this.onUpdateCapabilities(capabilities);
      this.config.capabilities = capabilities;
      this.logger.info(`Capabilities updated for agent ${this.config.name}`);
    } catch (error) {
      this.handleError('Capability update failed', error);
      throw error;
    }
  }

  /**
   * Register the agent with the orchestrator
   */
  public async register(): Promise<void> {
    if (this.state.status === AgentStatus.SHUTDOWN) {
      throw new Error('Cannot register agent in SHUTDOWN state');
    }
    try {
      this.logger.info(`Registering agent ${this.config.name}`);
      await this.onRegister();
      this.logger.info(`Agent ${this.config.name} registered successfully`);
    } catch (error) {
      this.handleError('Registration failed', error);
      throw error;
    }
  }

  /**
   * Deregister the agent from the orchestrator
   */
  public async deregister(): Promise<void> {
    if (this.state.status === AgentStatus.SHUTDOWN) {
      throw new Error('Cannot deregister agent in SHUTDOWN state');
    }
    try {
      this.logger.info(`Deregistering agent ${this.config.name}`);
      await this.onDeregister();
      this.logger.info(`Agent ${this.config.name} deregistered successfully`);
    } catch (error) {
      this.handleError('Deregistration failed', error);
      throw error;
    }
  }

  /**
   * Update agent status
   */
  protected updateStatus(status: AgentStatus): void {
    this.state.status = status;
    this.state.lastStatusChange = new Date();
    this.logger.info(`Agent ${this.config.name} status updated to ${status}`);
  }

  /**
   * Handle errors
   */
  protected handleError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.state.lastError = errorMessage;
    this.updateStatus(AgentStatus.ERROR);
    this.logger.error(`${message} for agent ${this.config.name}: ${errorMessage}`);
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.healthCheckInterval = setInterval(
      () => this.checkHealth(),
      this.config.healthCheckInterval
    );
  }

  /**
   * Stop health check interval
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  // Abstract methods to be implemented by concrete agents
  protected abstract onInitialize(): Promise<void>;
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract onHealthCheck(): Promise<boolean>;
  protected abstract onUpdateCapabilities(capabilities: AgentCapabilities): Promise<void>;
  protected abstract onRegister(): Promise<void>;
  protected abstract onDeregister(): Promise<void>;
}
