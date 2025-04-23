import { config } from 'dotenv';
import { beforeAll, afterAll } from '@jest/globals';
// Load environment variables from .env.test file
config({ path: '.env.test' });

// Global setup for e2e tests
beforeAll(async () => {
  // Add any global setup here
  console.log('Setting up e2e test environment...');
});

afterAll(async () => {
  // Add any global cleanup here
  console.log('Cleaning up e2e test environment...');
});
