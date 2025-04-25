import { SchemaManager } from '../src/core/database/schema';
import { DatabaseConnection } from '../src/core/database/connection';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the correct path
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env file from:', envPath);
dotenv.config({ path: envPath });

// Debug: Log environment variables
console.log('Environment variables loaded:', {
  DATABASE_URL: process.env.DATABASE_URL ? 'Present' : 'Missing',
});

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function initializeDatabase() {
  try {
    // Get database connection
    const db = DatabaseConnection.getInstance();

    // Debug: Log connection attempt
    console.log('Attempting to connect to database...');

    // Check connection
    try {
      const isConnected = await db.isConnected();
      if (!isConnected) {
        throw new Error('Failed to connect to database');
      }
      console.log('Successfully connected to database');
    } catch (error) {
      console.error('Connection error details:', error);
      throw error;
    }

    // Initialize schema
    const schemaManager = SchemaManager.getInstance();
    const isInitialized = await schemaManager.isInitialized();

    if (isInitialized) {
      console.log('Database schema already initialized');
    } else {
      console.log('Initializing database schema...');
      await schemaManager.initialize();
      console.log('Database schema initialized successfully');
    }

    // Close connection
    await db.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();
