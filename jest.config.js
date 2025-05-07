/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/integrationTest/',
    '/examples/',
    '.*\\.integration\\.test\\.ts$'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
    '!src/**/types.ts',
    '!src/core/database/config.ts',
    '!src/core/database/connection.ts',
    '!src/core/database/schema.ts',
    '!src/core/cache/config.ts',
    '!src/core/cache/client.ts',
    '!src/core/cache/manager.ts',
    '!src/__tests__/**/*.ts',
    '!src/__tests__/a2a.integration.test.ts',
    '!src/core/examples/**/*.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  coverageDirectory: 'coverage',
  collectCoverage: true,
  verbose: true,
}; 