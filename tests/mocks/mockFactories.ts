import { Express } from 'express';
import { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';

/**
 * Creates a mock Express request
 * @param options Request options
 * @returns Mock Express request
 */
export const createMockRequest = (options: Partial<Request> = {}) => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...options,
  } as Request;
};

/**
 * Creates a mock Express response
 * @returns Mock Express response with jest functions
 */
export const createMockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
};

/**
 * Creates a mock Express next function
 * @returns Mock next function
 */
export const createMockNext = () => {
  return jest.fn() as NextFunction;
};

/**
 * Creates a mock Express app
 * @returns Mock Express app
 */
export const createMockApp = () => {
  const app: Partial<Express> = {};
  app.use = jest.fn().mockReturnValue(app);
  app.get = jest.fn().mockReturnValue(app);
  app.post = jest.fn().mockReturnValue(app);
  app.put = jest.fn().mockReturnValue(app);
  app.delete = jest.fn().mockReturnValue(app);
  return app as Express;
}; 