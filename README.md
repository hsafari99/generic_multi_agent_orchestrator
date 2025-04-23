# Generic Multi-Agent Orchestrator

## Overview
A TypeScript-based orchestrator for managing and coordinating multiple AI agents in a distributed system. This project provides a flexible and extensible framework for building complex AI agent workflows.

## Features
- 🚀 TypeScript-based implementation
- 🔄 Asynchronous agent coordination
- 📊 Real-time monitoring and logging
- 🔒 Secure communication between agents
- 🧪 Comprehensive test coverage
- 📝 Detailed API documentation
- 🔍 Built-in debugging tools

## Prerequisites
- Node.js >= 18.0.0
- npm >= 8.0.0

## Installation
```bash
# Clone the repository
git clone https://github.com/hsafari99/generic_multi_agent_orchestrator.git

# Navigate to the project directory
cd generic_multi_agent_orchestrator

# Install dependencies
npm install
```

## Development
```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build the project
npm run build
```

## Project Structure
```
generic/
├── src/              # Source code
├── tests/            # Test files
├── docs/             # Documentation
├── config/           # Configuration files
├── scripts/          # Build and utility scripts
└── dist/             # Compiled output
```

## Configuration
The project uses environment variables for configuration. Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info

# Security
JWT_SECRET=your-secret-key
```

## API Documentation
API documentation is available in the `docs/api` directory. You can also generate it locally:

```bash
npm run docs
```

## Testing
The project uses Jest for testing. Run tests with:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run end-to-end tests
npm run test:e2e
```

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## License
This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Support
For support, please open an issue in the GitHub repository or contact the maintainers.

## Acknowledgments
- [TypeScript](https://www.typescriptlang.org/)
- [Express](https://expressjs.com/)
- [Jest](https://jestjs.io/)
- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/) 