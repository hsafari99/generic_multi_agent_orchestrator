class ToolRegistry {
    private tools: Map<string, Tool>;
    private permissions: Map<string, Set<string>>; // agentId -> Set<toolId>

    // Model
    interface Tool {
        id: string;
        name: string;
        version: string;
        capabilities: string[];
        parameters: ToolParameters;
        execute: (params: any) => Promise<any>;
    }

    // Controller
    async registerTool(tool: Tool): Promise<void> {
        // Validate tool configuration
        await this.validateToolConfig(tool);

        // Register tool
        this.tools.set(tool.id, tool);

        // Initialize permissions
        this.permissions.set(tool.id, new Set());
    }

    // Presenter
    async getToolAccess(agentId: string): Promise<Tool[]> {
        const accessibleTools = Array.from(this.tools.values())
            .filter(tool => this.permissions.get(tool.id)?.has(agentId));

        return accessibleTools.map(tool => ({
            id: tool.id,
            name: tool.name,
            version: tool.version,
            capabilities: tool.capabilities
        }));
    }
}