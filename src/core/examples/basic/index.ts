import { Orchestrator } from '../../orchestrator';
import { GPTAgent } from './gpt-agent';
import { TranslationAgent } from './translation-agent';
import { AgentConfig } from '../../agent/types';
import { MessageType } from '../../interfaces';
import * as dotenv from 'dotenv';

interface TranslationTaskData {
  text: string;
  maxLength: number;
  sourceLanguage?: string;
  targetLanguage?: string;
}

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Create the orchestrator
    const orchestrator = new Orchestrator();
    await orchestrator.initialize();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    // Create and register the GPT agent
    const gptAgentConfig: AgentConfig = {
      id: 'gpt-agent',
      name: 'GPT Assistant',
      description: 'An agent that responds to user requests using GPT-4',
      capabilities: {
        tools: ['text-processing', 'conversation', 'code-generation'],
        protocols: ['http'],
        maxConcurrency: 2,
        supportsLongRunningTasks: true,
      },
      maxRetries: 3,
      operationTimeout: 30000,
      healthCheckInterval: 10000,
    };

    const gptAgent = new GPTAgent(gptAgentConfig, {
      model: 'gpt-4',
      apiKey,
    });
    await orchestrator.registerAgent(gptAgent);

    // Create and register the translation agent
    const translationAgentConfig: AgentConfig = {
      id: 'translation-agent',
      name: 'Text Translator',
      description: 'An agent that translates text to English',
      capabilities: {
        tools: ['text-processing', 'translation'],
        protocols: ['http'],
        maxConcurrency: 2,
        supportsLongRunningTasks: true,
      },
      maxRetries: 3,
      operationTimeout: 30000,
      healthCheckInterval: 10000,
    };

    const translationAgent = new TranslationAgent(translationAgentConfig, {
      model: 'gpt-4',
      apiKey,
    });
    await orchestrator.registerAgent(translationAgent);

    // Step 1: User sends Spanish question to orchestrator
    const userQuestion = '¿Cuál es la capital de Japón?';
    console.log('User question (Spanish):', userQuestion);

    // Step 2: Orchestrator sends to translation agent
    const translationTask = {
      id: 'task-001',
      type: 'translation',
      description: 'Translate user question',
      data: {
        text: userQuestion,
        maxLength: 200,
      } as TranslationTaskData,
      metadata: {},
    };

    const translationMessage = {
      id: 'msg-001',
      type: MessageType.TASK,
      sender: 'orchestrator',
      receiver: 'translation-agent',
      payload: translationTask,
      timestamp: Date.now(),
      metadata: {},
    };

    // Step 3: Get translation from translation agent and wait for result
    const translationResponse = await orchestrator.handleMessage(translationMessage);
    console.log('Translation requested');

    // Check if we need language information
    if (
      !translationResponse.payload.success &&
      translationResponse.payload.data.requiresLanguageInfo
    ) {
      console.log('Language information required');

      // Update task with language information
      translationTask.data.sourceLanguage = 'Spanish';
      translationTask.data.targetLanguage = 'English';

      // Send updated task to translation agent
      const updatedTranslationMessage = {
        ...translationMessage,
        id: 'msg-001-update',
        payload: translationTask,
      };

      const updatedTranslationResponse =
        await orchestrator.handleMessage(updatedTranslationMessage);
      console.log('Received translation:', updatedTranslationResponse.payload.data.translation);
      console.log(
        'Translation details:',
        `from ${updatedTranslationResponse.payload.data.sourceLanguage} to ${updatedTranslationResponse.payload.data.targetLanguage}`
      );

      // Step 4: Orchestrator sends translated question to GPT agent
      const gptTask = {
        id: 'task-002',
        type: 'text-processing',
        description: 'Answer the translated question',
        data: {
          prompt: updatedTranslationResponse.payload.data.translation,
          maxLength: 200,
        },
        metadata: {},
      };

      const gptMessage = {
        id: 'msg-002',
        type: MessageType.TASK,
        sender: 'orchestrator',
        receiver: 'gpt-agent',
        payload: gptTask,
        timestamp: Date.now(),
        metadata: {},
      };

      // Step 5: Get answer from GPT agent and show to user
      const gptResponse = await orchestrator.handleMessage(gptMessage);
      console.log('Final answer:', gptResponse.payload.data.response);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main().catch(console.error);
