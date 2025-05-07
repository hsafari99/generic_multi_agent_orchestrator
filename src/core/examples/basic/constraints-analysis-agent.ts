import { BaseAgent } from '../../agent/base';
import { AgentConfig } from '../../agent/types';
import { IAgent, AgentStatus, ITask, TaskResult, IMessage, MessageType } from '../../interfaces';
import OpenAI from 'openai';

export class ConstraintsAnalysisAgent extends BaseAgent implements IAgent {
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
            content: `You are a constraints analysis expert. Your task is to analyze the given text and extract any specific constraints, criteria, or preferences.

For each input, identify and categorize constraints in these categories:
1. Time (deadlines, durations, schedules)
2. Budget (costs, price ranges, financial limits)
3. Quality (standards, requirements, specifications)
4. Quantity (amounts, numbers, ranges)
5. Format (file types, dimensions, structures)
6. Location (places, distances, regions)
7. Technical (system requirements, compatibility)
8. Preferences (likes, dislikes, priorities)

Format your response as a JSON object with these fields:
{
  "constraints": {
    "time": {
      "details": ["string"],
      "priority": "HIGH|MEDIUM|LOW"
    },
    "budget": {
      "details": ["string"],
      "priority": "HIGH|MEDIUM|LOW"
    },
    "quality": {
      "details": ["string"],
      "priority": "HIGH|MEDIUM|LOW"
    },
    "quantity": {
      "details": ["string"],
      "priority": "HIGH|MEDIUM|LOW"
    },
    "format": {
      "details": ["string"],
      "priority": "HIGH|MEDIUM|LOW"
    },
    "location": {
      "details": ["string"],
      "priority": "HIGH|MEDIUM|LOW"
    },
    "technical": {
      "details": ["string"],
      "priority": "HIGH|MEDIUM|LOW"
    },
    "preferences": {
      "details": ["string"],
      "priority": "HIGH|MEDIUM|LOW"
    }
  },
  "summary": "string"
}

Example input: "I need a 4K video edited by next Friday, budget around $500, must be in MP4 format and under 10 minutes"
Example output: {
  "constraints": {
    "time": {
      "details": ["Deadline: next Friday"],
      "priority": "HIGH"
    },
    "budget": {
      "details": ["Budget limit: $500"],
      "priority": "HIGH"
    },
    "quality": {
      "details": ["4K resolution required"],
      "priority": "HIGH"
    },
    "quantity": {
      "details": ["Duration: under 10 minutes"],
      "priority": "MEDIUM"
    },
    "format": {
      "details": ["File format: MP4"],
      "priority": "MEDIUM"
    },
    "location": {
      "details": [],
      "priority": "LOW"
    },
    "technical": {
      "details": [],
      "priority": "LOW"
    },
    "preferences": {
      "details": [],
      "priority": "LOW"
    }
  },
  "summary": "Video editing project with specific time, budget, quality, duration, and format requirements"
}`,
          },
          {
            role: 'user',
            content: task.data.text,
          },
        ],
        max_tokens: task.data.maxLength || 400,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      const constraintsAnalysis = JSON.parse(content);

      return {
        success: true,
        duration: 0,
        data: {
          constraintsAnalysis,
          originalText: task.data.text,
          model: this.model,
        },
      };
    } catch (error) {
      console.error('Error analyzing constraints:', error);
      return {
        success: false,
        duration: 0,
        data: { error: 'Failed to analyze constraints' },
      };
    }
  }

  public async handleMessage(message: IMessage): Promise<IMessage> {
    console.log(`\n=== Constraints Analysis Agent Processing ===`);
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
      console.log('=== End Constraints Analysis Agent Processing ===\n');
      return responseMessage;
    }
    throw new Error(`Unsupported message type: ${message.type}`);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize constraints analysis resources
  }

  protected async onStart(): Promise<void> {
    // Start constraints analysis services
  }

  protected async onStop(): Promise<void> {
    // Stop constraints analysis services
  }

  protected async onShutdown(): Promise<void> {
    // Cleanup constraints analysis resources
  }

  protected async onHealthCheck(): Promise<boolean> {
    // Check constraints analysis service health
    return true;
  }

  protected async onUpdateCapabilities(): Promise<void> {
    // Update constraints analysis capabilities
  }

  protected async onRegister(): Promise<void> {
    // Register with constraints analysis service
  }

  protected async onDeregister(): Promise<void> {
    // Deregister from constraints analysis service
  }
}
