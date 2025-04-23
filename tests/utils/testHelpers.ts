import { Express } from 'express';
import request from 'supertest';

/**
 * Helper function to create a test request
 * @param app Express application instance
 * @returns SuperTest request instance
 */
export const createTestRequest = (app: Express) => {
  return request(app);
};

/**
 * Helper function to generate random test data
 * @param type Type of data to generate
 * @returns Random test data
 */
export const generateTestData = (type: 'user' | 'agent' | 'task') => {
  const baseData = {
    id: Math.random().toString(36).substring(7),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  switch (type) {
    case 'user':
      return {
        ...baseData,
        name: `Test User ${Math.random().toString(36).substring(7)}`,
        email: `test${Math.random().toString(36).substring(7)}@example.com`,
      };
    case 'agent':
      return {
        ...baseData,
        name: `Test Agent ${Math.random().toString(36).substring(7)}`,
        type: 'assistant',
        capabilities: ['test', 'mock'],
      };
    case 'task':
      return {
        ...baseData,
        title: `Test Task ${Math.random().toString(36).substring(7)}`,
        status: 'pending',
        priority: 'medium',
      };
    default:
      return baseData;
  }
};

/**
 * Helper function to wait for a specified time
 * @param ms Milliseconds to wait
 * @returns Promise that resolves after the specified time
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
