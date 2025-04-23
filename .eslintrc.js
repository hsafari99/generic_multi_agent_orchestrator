module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/member-delimiter-style': ['error', {
      multiline: {
        delimiter: 'semi',
        requireLast: true
      },
      singleline: {
        delimiter: 'semi',
        requireLast: false
      }
    }],

    // General rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    'no-duplicate-imports': 'error',
    'no-unused-expressions': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'error',
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always']
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off'
      }
    }
  ]
}; 