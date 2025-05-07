import { BaseAgent } from '../../agent/base';
import { AgentConfig } from '../../agent/types';
import { IAgent, AgentStatus, ITask, TaskResult, IMessage, MessageType } from '../../interfaces';
import OpenAI from 'openai';

export class TaskDecompositionAgent extends BaseAgent implements IAgent {
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
            content: `You are a task decomposition expert. Your task is to break down user requirements into specific, manageable sub-tasks.

For each input, analyze the core intent and constraints to create a sequence of sub-tasks that:
1. Each sub-task addresses exactly one specific need
2. Sub-tasks are ordered from least dependent to most dependent
3. Dependencies between tasks are clearly specified
4. Each task has a clear status tracking

Format your response as a JSON object with these fields:
{
  "subTasks": [
    {
      "id": "string",
      "description": "string",
      "status": "NOT_STARTED|IN_PROGRESS|COMPLETED|BLOCKED",
      "dependencies": ["task_id"],
      "constraints": {
        "time": ["string"],
        "budget": ["string"],
        "quality": ["string"],
        "quantity": ["string"],
        "format": ["string"],
        "technical": ["string"]
      },
      "priority": "HIGH|MEDIUM|LOW"
    }
  ],
  "summary": "string"
}

Example input: {
  "intent": {
    "coreIntent": "Request video editing services",
    "intentType": "REQUEST",
    "entities": ["video editing", "4K", "MP4", "10 minutes"]
  },
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
    }
  }
}

Example output: {
  "subTasks": [
    {
      "id": "TASK-001",
      "description": "Review and validate video source material",
      "status": "NOT_STARTED",
      "dependencies": [],
      "constraints": {
        "quality": ["4K resolution required"]
      },
      "priority": "HIGH"
    },
    {
      "id": "TASK-002",
      "description": "Create initial video edit timeline",
      "status": "NOT_STARTED",
      "dependencies": ["TASK-001"],
      "constraints": {
        "time": ["Deadline: next Friday"],
        "quantity": ["Duration: under 10 minutes"]
      },
      "priority": "HIGH"
    },
    {
      "id": "TASK-003",
      "description": "Apply 4K resolution processing",
      "status": "NOT_STARTED",
      "dependencies": ["TASK-002"],
      "constraints": {
        "quality": ["4K resolution required"],
        "format": ["MP4 format"]
      },
      "priority": "HIGH"
    },
    {
      "id": "TASK-004",
      "description": "Export final video in MP4 format",
      "status": "NOT_STARTED",
      "dependencies": ["TASK-003"],
      "constraints": {
        "format": ["MP4 format"],
        "time": ["Deadline: next Friday"]
      },
      "priority": "HIGH"
    }
  ],
  "summary": "Video editing project broken down into 4 sequential tasks: source validation, timeline creation, 4K processing, and final export"
}`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              intent: task.data.intent,
              constraints: task.data.constraints,
            }),
          },
        ],
        max_tokens: task.data.maxLength || 800,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      const taskDecomposition = JSON.parse(content);

      return {
        success: true,
        duration: 0,
        data: {
          taskDecomposition,
          originalInput: {
            intent: task.data.intent,
            constraints: task.data.constraints,
          },
          model: this.model,
        },
      };
    } catch (error) {
      console.error('Error decomposing tasks:', error);
      return {
        success: false,
        duration: 0,
        data: { error: 'Failed to decompose tasks' },
      };
    }
  }

  public async handleMessage(message: IMessage): Promise<IMessage> {
    console.log(`\n=== Task Decomposition Agent Processing ===`);
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
      console.log('=== End Task Decomposition Agent Processing ===\n');
      return responseMessage;
    }
    throw new Error(`Unsupported message type: ${message.type}`);
  }

  protected async onInitialize(): Promise<void> {
    // Initialize task decomposition resources
  }

  protected async onStart(): Promise<void> {
    // Start task decomposition services
  }

  protected async onStop(): Promise<void> {
    // Stop task decomposition services
  }

  protected async onShutdown(): Promise<void> {
    // Cleanup task decomposition resources
  }

  protected async onHealthCheck(): Promise<boolean> {
    // Check task decomposition service health
    return true;
  }

  protected async onUpdateCapabilities(): Promise<void> {
    // Update task decomposition capabilities
  }

  protected async onRegister(): Promise<void> {
    // Register with task decomposition service
  }

  protected async onDeregister(): Promise<void> {
    // Deregister from task decomposition service
  }
}
