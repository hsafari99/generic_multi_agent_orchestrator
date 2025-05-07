import { BaseAgent } from '../../agent/base';
import { AgentConfig } from '../../agent/types';
import { IAgent, AgentStatus, ITask, TaskResult, IMessage, MessageType } from '../../interfaces';
import OpenAI from 'openai';

export class TextNormalizationAgent extends BaseAgent implements IAgent {
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
            content: `You are a text normalization expert. Your task is to:
                        1. Remove filler words and unnecessary phrases
                        2. Fix grammar issues and standardize casing
                        3. Replace synonyms with standard terms
                        4. Maintain the original meaning while making the text more concise
                        5. Return only the normalized text without explanations

                        Example input: "um, like, i think that the weather is, you know, kinda nice today"
                        Example output: "The weather is nice today"`,
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
          normalizedText: completion.choices[0].message.content,
          originalText: task.data.text,
          model: this.model,
        },
      };
    } catch (error) {
      console.error('Error normalizing text:', error);
      return {
        success: false,
        duration: 0,
        data: { error: 'Failed to normalize text' },
      };
    }
  }

  public async handleMessage(message: IMessage): Promise<IMessage> {
    console.log(`\n=== Text Normalization Agent Processing ===`);
    console.log(`Agent: ${this.name} (${this.id})`);
    console.log(`Received message ID: ${message.id}`);
    console.log(`Message type: ${message.type}`);
    console.log(`From: ${message.sender}`);

    if (message.type === MessageType.TASK) {
      const task = message.payload as ITask;
      console.log(`\nProcessing task:`);
      console.log(`- Task ID: ${task.id}`);
      console.log(`- Task type: ${task.type}`);
      console.log(`- Description: ${task.description}`);

      const result = await this.executeTask(task);
      console.log(`\nTask completed:`);
      console.log(`- Success: ${result.success}`);
      console.log(`- Duration: ${result.duration}ms`);
      console.log(`- Result: ${JSON.stringify(result.data, null, 2)}`);

      const responseMessage: IMessage = {
        id: `resp-${message.id}`,
        type: MessageType.RESULT,
        sender: this.id,
        receiver: message.sender,
        payload: result,
        timestamp: Date.now(),
        metadata: {},
      };

      console.log(`\nSending response to: ${responseMessage.receiver}`);
      console.log('=== End Text Normalization Agent Processing ===\n');
      return responseMessage;
    }
    throw new Error(`Unsupported message type: ${message.type}`);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize normalization-specific resources
  }

  protected async onStart(): Promise<void> {
    // Start normalization services
  }

  protected async onStop(): Promise<void> {
    // Stop normalization services
  }

  protected async onShutdown(): Promise<void> {
    // Cleanup normalization resources
  }

  protected async onHealthCheck(): Promise<boolean> {
    // Check normalization service health
    return true;
  }

  protected async onUpdateCapabilities(): Promise<void> {
    // Update normalization capabilities
  }

  protected async onRegister(): Promise<void> {
    // Register with normalization service
  }

  protected async onDeregister(): Promise<void> {
    // Deregister from normalization service
  }
}
