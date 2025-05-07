import { BaseAgent } from '../../agent/base';
import { AgentConfig } from '../../agent/types';
import { IAgent, AgentStatus, ITask, TaskResult, IMessage, MessageType } from '../../interfaces';
import OpenAI from 'openai';

export class IntentAnalysisAgent extends BaseAgent implements IAgent {
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
            content: `You are an intent analysis expert. Your task is to analyze the given text and extract the user's core intent.
                        For each input, provide a structured analysis that answers:
                        1. What is the user trying to accomplish? (Core intent)
                        2. What type of intent is it? (Question, Request, or Idea)
                        3. What are the key entities or topics mentioned?
                        4. What is the user's emotional state or tone?

                        Format your response as a JSON object with these fields:
                        {
                        "coreIntent": "string",
                        "intentType": "QUESTION|REQUEST|IDEA",
                        "entities": ["string"],
                        "tone": "string"
                        }

                        Example input: "I'm really frustrated that my computer keeps crashing when I try to save my work"
                        Example output: {
                        "coreIntent": "Resolve computer crashing issue",
                        "intentType": "REQUEST",
                        "entities": ["computer", "work", "saving"],
                        "tone": "frustrated"
                    }`,
          },
          {
            role: 'user',
            content: task.data.text,
          },
        ],
        max_tokens: task.data.maxLength || 200,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      const intentAnalysis = JSON.parse(content);

      return {
        success: true,
        duration: 0,
        data: {
          intentAnalysis,
          originalText: task.data.text,
          model: this.model,
        },
      };
    } catch (error) {
      console.error('Error analyzing intent:', error);
      return {
        success: false,
        duration: 0,
        data: { error: 'Failed to analyze intent' },
      };
    }
  }

  public async handleMessage(message: IMessage): Promise<IMessage> {
    console.log(`\n=== Intent Analysis Agent Processing ===`);
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
      console.log('=== End Intent Analysis Agent Processing ===\n');
      return responseMessage;
    }
    throw new Error(`Unsupported message type: ${message.type}`);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize intent analysis resources
  }

  protected async onStart(): Promise<void> {
    // Start intent analysis services
  }

  protected async onStop(): Promise<void> {
    // Stop intent analysis services
  }

  protected async onShutdown(): Promise<void> {
    // Cleanup intent analysis resources
  }

  protected async onHealthCheck(): Promise<boolean> {
    // Check intent analysis service health
    return true;
  }

  protected async onUpdateCapabilities(): Promise<void> {
    // Update intent analysis capabilities
  }

  protected async onRegister(): Promise<void> {
    // Register with intent analysis service
  }

  protected async onDeregister(): Promise<void> {
    // Deregister from intent analysis service
  }
}
