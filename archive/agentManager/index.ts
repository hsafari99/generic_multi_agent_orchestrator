class AgentManager {
    private agents: Map<string, AgentProxy>;
    private capabilityIndex: Map<string, Set<string>>; // capabilityId -> Set<agentId>

    async registerAgent(agent: AgentProxy): Promise<void> {
        // Register agent
        this.agents.set(agent.id, agent);

        // Index agent by capabilities
        for (const capability of agent.capabilities) {
            if (!this.capabilityIndex.has(capability.id)) {
                this.capabilityIndex.set(capability.id, new Set());
            }
            this.capabilityIndex.get(capability.id)!.add(agent.id);
        }
    }

    async getAgentsByCapability(capabilityId: string): Promise<AgentProxy[]> {
        const agentIds = this.capabilityIndex.get(capabilityId) || new Set();
        return Array.from(agentIds).map(id => this.agents.get(id)!);
    }

    async getAllAgents(): Promise<AgentProxy[]> {
        return Array.from(this.agents.values());
    }
}