import { DatabaseConnection } from './connection';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Schema manager for handling database migrations
 */
export class SchemaManager {
  private static instance: SchemaManager;
  private db: DatabaseConnection;

  private constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * Get the singleton instance of the schema manager
   */
  public static getInstance(): SchemaManager {
    if (!SchemaManager.instance) {
      SchemaManager.instance = new SchemaManager();
    }
    return SchemaManager.instance;
  }

  /**
   * Initialize the database schema
   */
  public async initialize(): Promise<void> {
    try {
      // Read and execute schema.sql
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');

      // Split schema into individual statements, preserving dollar-quoted strings
      const statements = this.splitStatements(schema);

      // Execute each statement in a transaction
      await this.db.transaction(async client => {
        for (const statement of statements) {
          if (statement.trim()) {
            await client.query(statement);
          }
        }
      });

      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  /**
   * Check if schema is initialized
   */
  public async isInitialized(): Promise<boolean> {
    try {
      const result = await this.db.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agents')"
      );
      return result[0].exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Split SQL statements while preserving dollar-quoted strings
   */
  private splitStatements(schema: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inDollarQuote = false;

    const lines = schema.split('\n');
    for (const line of lines) {
      // Check for dollar quote start
      const dollarMatch = line.match(/\$\$([^$]*)\$\$/);
      if (dollarMatch) {
        inDollarQuote = !inDollarQuote;
      }

      currentStatement += line + '\n';

      // If we're not in a dollar quote and the line ends with a semicolon, it's a complete statement
      if (!inDollarQuote && line.trim().endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    return statements;
  }
}
