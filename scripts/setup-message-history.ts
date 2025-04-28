import { DatabaseConnection } from '../src/core/database/connection';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function addMessageHistoryTable() {
  const db = DatabaseConnection.getInstance();

  try {
    console.log('Connecting to database...');
    await db.isConnected();
    console.log('Connected successfully');

    // Create message history table
    console.log('Creating message history table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS message_history (
        id SERIAL PRIMARY KEY,
        message_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL,
        sender VARCHAR(255) NOT NULL,
        receiver VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        metadata JSONB,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_message_history_timestamp ON message_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_message_history_sender ON message_history(sender);
      CREATE INDEX IF NOT EXISTS idx_message_history_receiver ON message_history(receiver);
      CREATE INDEX IF NOT EXISTS idx_message_history_type ON message_history(type);
      CREATE INDEX IF NOT EXISTS idx_message_history_created_at ON message_history(created_at);
    `);

    console.log('Message history table created successfully');
  } catch (error) {
    console.error('Error creating message history table:', error);
    process.exit(1);
  } finally {
    await db.close();
    console.log('Database connection closed');
  }
}

// Run the script
addMessageHistoryTable(); 