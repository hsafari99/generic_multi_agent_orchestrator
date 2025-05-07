import { BaseAgent } from '../../agent/base';
import { AgentConfig } from '../../agent/types';
import { IAgent, AgentStatus, ITask, TaskResult, IMessage, MessageType } from '../../interfaces';
import OpenAI from 'openai';

export class TranslationAgent extends BaseAgent implements IAgent {
  private model: string;
  private apiKey: string;
  private openai: OpenAI;
  public id: string;
  public name: string;
  public capabilities: string[];
  public status: AgentStatus;
  public tools: any[] = [];

  constructor(config: AgentConfig, options: { model: string; apiKey: string }) {
    super(config);
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.openai = new OpenAI({ apiKey: this.apiKey });
    this.id = config.id;
    this.name = config.name;
    this.capabilities = config.capabilities.tools;
    this.status = AgentStatus.INITIALIZING;
  }

  public async executeTask(task: ITask): Promise<TaskResult> {
    console.log(`Executing task ${task.id} of type ${task.type}`);

    // Check if source and target languages are provided
    if (!task.data.sourceLanguage || !task.data.targetLanguage) {
      return {
        success: false,
        duration: 0,
        data: {
          error: 'Missing language information',
          requiresLanguageInfo: true,
          message: 'Please provide source and target languages',
        },
      };
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the given text from ${task.data.sourceLanguage} to ${task.data.targetLanguage}.`,
          },
          {
            role: 'user',
            content: task.data.text,
          },
        ],
        max_tokens: task.data.maxLength || 200,
      });

      return {
        success: true,
        duration: 0,
        data: {
          translation: completion.choices[0].message.content,
          sourceLanguage: task.data.sourceLanguage,
          targetLanguage: task.data.targetLanguage,
          model: this.model,
        },
      };
    } catch (error) {
      console.error('Error translating text:', error);
      return {
        success: false,
        duration: 0,
        data: { error: 'Failed to translate text' },
      };
    }
  }

  public async handleMessage(message: IMessage): Promise<IMessage> {
    console.log(`Handling message ${message.id} of type ${message.type}`);
    if (message.type === MessageType.TASK) {
      const result = await this.executeTask(message.payload);
      console.log('Translation result:', result);

      // Create response message
      const responseMessage: IMessage = {
        id: `resp-${message.id}`,
        type: MessageType.RESULT,
        sender: this.id,
        receiver: 'orchestrator',
        payload: result,
        timestamp: Date.now(),
        metadata: {},
      };

      console.log('Sending translation result to orchestrator:', responseMessage);
      return responseMessage;
    }
    throw new Error(`Unsupported message type: ${message.type}`);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize translation-specific resources
  }

  protected async onStart(): Promise<void> {
    // Start translation services
  }

  protected async onStop(): Promise<void> {
    // Stop translation services
  }

  protected async onShutdown(): Promise<void> {
    // Cleanup translation resources
  }

  protected async onHealthCheck(): Promise<boolean> {
    // Check translation service health
    return true;
  }

  protected async onUpdateCapabilities(): Promise<void> {
    // Update translation capabilities
  }

  protected async onRegister(): Promise<void> {
    // Register with translation service
  }

  protected async onDeregister(): Promise<void> {
    // Deregister from translation service
  }
}
