import { Orchestrator } from '../../src/core/orchestrator';
import { Agent } from '../../src/core/agent';
import { AgentConfig } from '../../src/core/agent/types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
    try {
        // Create agent configuration
        const agentConfig: AgentConfig = {
            id: 'gpt4-agent-001',
            name: 'GPT-4 Agent',
            description: 'An agent powered by GPT-4',
            capabilities: {
                tools: ['text-processing', 'code-generation'],
                protocols: ['http'],
                maxConcurrency: 2,
                supportsLongRunningTasks: true
            },
            maxRetries: 3,
            operationTimeout: 30000,
            healthCheckInterval: 10000
        };

        // Create the agent
        const agent = new Agent(agentConfig, {
            model: 'gpt-4',
            apiKey: process.env.OPENAI_API_KEY
        });

        // Create the orchestrator
        const orchestrator = new Orchestrator({
            maxConcurrentTasks: 5,
            taskTimeout: 60000
        });

        // Register the agent with the orchestrator
        await orchestrator.registerAgent(agent);

        // Example task
        const task = {
            id: 'task-001',
            type: 'text-processing',
            input: 'Write a function to calculate fibonacci numbers',
            priority: 'high'
        };

        // Submit task to orchestrator
        const result = await orchestrator.submitTask(task);
        console.log('Task result:', result);

    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the example
main().catch(console.error); 