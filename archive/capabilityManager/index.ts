class CapabilityManager {
    private capabilities: Map<string, Capability>;
    private capabilityDependencies: Map<string, Set<string>>;

    async registerCapability(capability: Capability): Promise<void> {
        // Validate capability
        await this.validateCapability(capability);

        // Register capability
        this.capabilities.set(capability.id, capability);

        // Register dependencies
        if (capability.dependencies) {
            this.capabilityDependencies.set(capability.id, new Set(capability.dependencies));
        }
    }

    async validateAgentCapabilities(agentCapabilities: string[]): Promise<boolean> {
        // Check if all capabilities exist
        const allCapabilitiesExist = agentCapabilities.every(
            capId => this.capabilities.has(capId)
        );

        // Check dependencies
        const allDependenciesMet = await this.checkDependencies(agentCapabilities);

        return allCapabilitiesExist && allDependenciesMet;
    }
}