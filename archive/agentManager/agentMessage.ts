// For inner agent communication (Pub/Sub)
interface AgentMessage {
    id: string;
    type: MessageType;
    sourceAgentId: string;
    targetAgentId: string;
    content: any;
    metadata: MessageMetadata;
}

// For orchestrator-to-orchestrator communication (Agent-to-Agent)
interface OrchestratorMessage {
    id: string;
    type: OrchestratorMessageType;
    sourceOrchestratorId: string;
    targetOrchestratorId: string;
    content: any;
    metadata: OrchestratorMessageMetadata;
}

enum OrchestratorMessageType {
    AGENT_TRANSFER = 'agent_transfer',
    TOOL_SHARING = 'tool_sharing',
    STATE_SYNC = 'state_sync',
    BROADCAST = 'broadcast'
}