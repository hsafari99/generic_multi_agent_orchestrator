# Git Hooks with Husky

## Overview

This project uses Husky and lint-staged to enforce code quality checks before commits. This ensures that all committed code meets our quality standards.

## Configuration Files

- `.husky/pre-commit`: Pre-commit hook configuration
- `.lintstagedrc`: lint-staged configuration

## Git Hooks

### Pre-commit Hook

The pre-commit hook runs before each commit and:

1. Runs ESLint on staged JavaScript/TypeScript files
2. Runs Prettier on staged files
3. Prevents commit if any checks fail

## lint-staged Configuration

### JavaScript/TypeScript Files

For `.js` and `.ts` files:

- Run ESLint with auto-fix
- Run Prettier formatting

### Other Files

For `.json`, `.md`, `.yml`, and `.yaml` files:

- Run Prettier formatting

## Usage

### Automatic Checks

The hooks run automatically when you:

- Make a commit
- Try to push changes

### Manual Testing

To test the hooks manually:

```bash
# Test pre-commit hook
npx husky run .husky/pre-commit

# Test lint-staged
npx lint-staged
```

## Troubleshooting

### Common Issues

1. Hook not running:

   - Ensure Husky is installed: `npm install --save-dev husky`
   - Initialize Husky: `npx husky install`
   - Check hook permissions: `chmod +x .husky/pre-commit`

2. lint-staged not working:
   - Verify `.lintstagedrc` configuration
   - Check for syntax errors in configuration
   - Ensure all required dependencies are installed

### Disabling Hooks

To temporarily disable hooks:

```bash
git commit -m "message" --no-verify
```

## Best Practices

1. Always commit with hooks enabled
2. Fix linting issues before committing
3. Keep hook configurations in version control
4. Document any changes to hook behavior
