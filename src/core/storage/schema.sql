-- Message table for storing message history
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    sender VARCHAR(255) NOT NULL,
    receiver VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    status VARCHAR(50) NOT NULL,
    retries INTEGER DEFAULT 0,
    last_attempt TIMESTAMP WITH TIME ZONE,
    next_attempt TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Queue status table for tracking queue states
CREATE TABLE queue_status (
    queue_name VARCHAR(255) PRIMARY KEY,
    size INTEGER NOT NULL DEFAULT 0,
    processing_count INTEGER NOT NULL DEFAULT 0,
    dead_letter_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dead letter queue table for failed messages
CREATE TABLE dead_letter_queue (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id),
    error_message TEXT,
    failure_reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Message metadata table for additional information
CREATE TABLE message_metadata (
    message_id UUID PRIMARY KEY REFERENCES messages(id),
    priority INTEGER DEFAULT 0,
    requires_ack BOOLEAN DEFAULT false,
    ttl INTEGER,
    custom_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_sender ON messages(sender);
CREATE INDEX idx_messages_receiver ON messages(receiver);
CREATE INDEX idx_message_metadata_priority ON message_metadata(priority);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating timestamps
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_metadata_updated_at
    BEFORE UPDATE ON message_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 