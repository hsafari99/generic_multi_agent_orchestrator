# Test Coverage Documentation

## Overview
This document describes the test coverage setup and requirements for the project.

## Coverage Requirements

### Global Thresholds
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

### Specific Module Thresholds
- Controllers: 85%
- Services: 90%

## Coverage Reports
The project generates multiple coverage reports:
- Text summary in console
- HTML report in `coverage/` directory
- LCOV report for CI integration
- Clover report for additional tooling

## Running Coverage Reports

### Basic Coverage
```bash
npm run test:coverage
```

### HTML Report
```bash
npm run test:coverage:html
```

### CI Report
```bash
npm run test:coverage:ci
```

### Coverage Check
```bash
npm run test:coverage:check
```

## Coverage Configuration
Coverage settings are configured in:
- `jest.config.js`: Basic coverage settings
- `coverage.config.js`: Detailed coverage thresholds and patterns

## Ignored Files
The following files are excluded from coverage:
- Type definition files (*.d.ts)
- Test files (*.test.ts)
- Test directories (__tests__)
- Index files (index.ts)
- Type definition files (types.ts)
- Node modules
- Build output
- Coverage reports
- Test files

## Best Practices
1. Write tests for all new code
2. Maintain coverage above thresholds
3. Review coverage reports regularly
4. Fix failing coverage checks before merging 