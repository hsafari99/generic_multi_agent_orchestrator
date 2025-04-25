/**
 * AI Orchestrator - Generic Implementation
 *
 * This is the main entry point for the AI Orchestrator application.
 * It exports all core components and interfaces needed for building
 * and managing multi-agent systems.
 *
 * @packageDocumentation
 */

// Core Components
export { Orchestrator } from './core/orchestrator';

// Core Interfaces
export {
  IAgent,
  ITool,
  IMessage,
  ITask,
  AgentStatus,
  MessageType,
  OrchestratorStatus,
  TaskStatus,
  ToolMetadata,
  ParameterDefinition,
  Example,
  MessageMetadata,
  TaskResult,
} from './core/interfaces';

// Configuration
export interface OrchestratorConfig {
  /** Name of the orchestrator instance */
  name: string;
  /** Version of the orchestrator */
  version: string;
  /** List of agent IDs to be managed */
  agents: string[];
}

// Default configuration
const config: OrchestratorConfig = {
  name: 'AI Orchestrator Generic',
  version: '1.0.0',
  agents: [],
};

export default config;
