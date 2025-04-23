# Prettier Configuration

## Overview

This project uses Prettier to maintain consistent code formatting across the codebase. The configuration is designed to work seamlessly with ESLint and TypeScript.

## Configuration Files

- `.prettierrc`: Main Prettier configuration
- `.prettierignore`: Files and directories to ignore

## Formatting Rules

### Basic Rules

- `semi`: Always add semicolons at the end of statements
- `trailingComma`: Add trailing commas in objects and arrays (ES5 style)
- `singleQuote`: Use single quotes instead of double quotes
- `printWidth`: Maximum line length of 100 characters
- `tabWidth`: Use 2 spaces for indentation
- `useTabs`: Use spaces instead of tabs

### Advanced Rules

- `bracketSpacing`: Add spaces between brackets in object literals
- `arrowParens`: Omit parentheses around single arrow function parameters
- `endOfLine`: Use LF (Unix-style) line endings
- `bracketSameLine`: Put closing brackets on new lines
- `quoteProps`: Only add quotes around object properties when required
- `proseWrap`: Preserve line breaks in markdown and prose

## Integration with ESLint

Prettier is configured to work with ESLint using:

- `eslint-config-prettier`: Disables ESLint rules that might conflict with Prettier
- `eslint-plugin-prettier`: Runs Prettier as an ESLint rule

## Usage

### Formatting

```bash
# Format all files
npm run format

# Check formatting without making changes
npm run format:check
```

### Editor Integration

For the best experience, install the Prettier extension for your editor:

- VS Code: Prettier - Code formatter
- WebStorm: Built-in
- Vim: vim-prettier

### Editor Settings

Recommended VS Code settings:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Best Practices

1. Always run `npm run format` before committing changes
2. Configure your editor to format on save
3. Use the provided npm scripts for formatting
4. Keep the configuration in sync with ESLint rules
