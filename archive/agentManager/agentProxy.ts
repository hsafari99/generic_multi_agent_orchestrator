class AgentProxy {
    private agent: Agent;
    private orchestrator: Orchestrator;

    constructor(agent: Agent, orchestrator: Orchestrator) {
        this.agent = agent;
        this.orchestrator = orchestrator;
    }

    // All messages must go through orchestrator
    async sendMessage(message: AgentMessage): Promise<void> {
        // Add orchestrator metadata
        const orchestratorMessage = {
            ...message,
            orchestratorId: this.orchestrator.id,
            timestamp: Date.now()
        };

        // Send through orchestrator
        await this.orchestrator.handleAgentMessage(orchestratorMessage);
    }

    // Messages are received through orchestrator
    async receiveMessage(message: AgentMessage): Promise<void> {
        await this.agent.handleMessage(message);
    }
}