class MessageBus {
    private subscribers: Map<string, Set<MessageHandler>>;
    private messageQueue: MessageQueue;

    constructor() {
        this.subscribers = new Map();
        this.messageQueue = new MessageQueue();
    }

    // Subscribe to a topic
    async subscribe(topic: string, handler: MessageHandler): Promise<void> {
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, new Set());
        }
        this.subscribers.get(topic)!.add(handler);
    }

    // Publish to a topic
    async publish(topic: string, message: AgentMessage): Promise<void> {
        // Add to queue
        await this.messageQueue.enqueue(topic, message);

        // Get all matching subscribers
        const handlers = this.getMatchingHandlers(topic);
        
        // Notify subscribers
        for (const handler of handlers) {
            await handler(message);
        }
    }

    // Get all handlers that match the topic pattern
    private getMatchingHandlers(topic: string): Set<MessageHandler> {
        const handlers = new Set<MessageHandler>();
        
        // Add exact match handlers
        if (this.subscribers.has(topic)) {
            this.subscribers.get(topic)!.forEach(handler => handlers.add(handler));
        }

        // Add wildcard match handlers
        const wildcardTopic = topic.split('.')[0] + '.*';
        if (this.subscribers.has(wildcardTopic)) {
            this.subscribers.get(wildcardTopic)!.forEach(handler => handlers.add(handler));
        }

        return handlers;
    }
}