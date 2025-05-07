import { BaseAgent } from '../../agent/base';
import { AgentConfig } from '../../agent/types';
import { IAgent, AgentStatus, ITask, TaskResult, IMessage, MessageType } from '../../interfaces';
import OpenAI from 'openai';

export class GPTAgent extends BaseAgent implements IAgent {
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
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant that provides clear and concise responses.',
          },
          {
            role: 'user',
            content: task.data.prompt || task.description,
          },
        ],
        max_tokens: task.data.maxLength || 200,
      });

      return {
        success: true,
        duration: 0,
        data: {
          response: completion.choices[0].message.content,
          model: this.model,
        },
      };
    } catch (error) {
      console.error('Error processing request:', error);
      return {
        success: false,
        duration: 0,
        data: { error: 'Failed to process request' },
      };
    }
  }

  public async handleMessage(message: IMessage): Promise<IMessage> {
    console.log(`Handling message ${message.id} of type ${message.type}`);
    if (message.type === MessageType.TASK) {
      const result = await this.executeTask(message.payload);
      console.log('GPT result:', result);

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

      console.log('Sending GPT result to orchestrator:', responseMessage);
      return responseMessage;
    }
    throw new Error(`Unsupported message type: ${message.type}`);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize GPT-specific resources
  }

  protected async onStart(): Promise<void> {
    // Start GPT-specific services
  }

  protected async onStop(): Promise<void> {
    // Stop GPT-specific services
  }

  protected async onShutdown(): Promise<void> {
    // Cleanup GPT-specific resources
  }

  protected async onHealthCheck(): Promise<boolean> {
    // Check GPT service health
    return true;
  }

  protected async onUpdateCapabilities(): Promise<void> {
    // Update GPT-specific capabilities
  }

  protected async onRegister(): Promise<void> {
    // Register with GPT service
  }

  protected async onDeregister(): Promise<void> {
    // Deregister from GPT service
  }
}
