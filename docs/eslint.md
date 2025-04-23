# ESLint Configuration

## Overview

This project uses ESLint with TypeScript support to maintain code quality and consistency. The configuration is designed to enforce best practices and catch common errors.

## Configuration Files

- `.eslintrc.js`: Main ESLint configuration
- `.eslintignore`: Files and directories to ignore

## Rules

### TypeScript Rules

- `@typescript-eslint/explicit-function-return-type`: Warns when function return types are not explicitly declared
- `@typescript-eslint/no-explicit-any`: Warns when `any` type is used
- `@typescript-eslint/no-unused-vars`: Errors on unused variables (ignores variables starting with `_`)
- `@typescript-eslint/no-non-null-assertion`: Warns on non-null assertions
- `@typescript-eslint/consistent-type-definitions`: Enforces using `interface` over `type` for object type definitions
- `@typescript-eslint/member-delimiter-style`: Enforces consistent semicolon usage in interfaces

### General Rules

- `no-console`: Warns on console.log usage (allows console.warn and console.error)
- `no-debugger`: Warns on debugger statements
- `no-duplicate-imports`: Errors on duplicate imports
- `no-unused-expressions`: Errors on unused expressions
- `no-var`: Errors on var usage
- `prefer-const`: Errors when let is used but never reassigned
- `prefer-template`: Errors on string concatenation
- `quotes`: Enforces single quotes
- `semi`: Enforces semicolons

## Test Files

Special rules for test files:

- `@typescript-eslint/no-explicit-any`: Disabled
- `@typescript-eslint/no-non-null-assertion`: Disabled

## Usage

### Linting

```bash
# Lint all files
npm run lint

# Lint and fix automatically
npm run lint:fix
```

### Integration with Prettier

ESLint is configured to work with Prettier to avoid conflicts between formatting rules.

### Editor Integration

For the best experience, install the ESLint extension for your editor:

- VS Code: ESLint
- WebStorm: Built-in
- Vim: ALE or vim-eslint
