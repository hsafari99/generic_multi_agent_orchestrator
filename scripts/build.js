const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Build steps
const steps = [
  {
    name: 'Clean',
    command: 'npm run clean',
    validate: () => !fs.existsSync(path.join(__dirname, '../dist'))
  },
  {
    name: 'Type Check',
    command: 'tsc --noEmit',
    validate: () => true
  },
  {
    name: 'Build',
    command: 'tsc',
    validate: () => fs.existsSync(path.join(__dirname, '../dist'))
  },
  {
    name: 'Test',
    command: 'npm test',
    validate: () => true
  }
];

// Run build pipeline
async function runBuild() {
  console.log(`${colors.blue}Starting build pipeline...${colors.reset}\n`);

  for (const step of steps) {
    try {
      console.log(`${colors.yellow}Running ${step.name}...${colors.reset}`);
      execSync(step.command, { stdio: 'inherit' });
      
      if (step.validate()) {
        console.log(`${colors.green}✓ ${step.name} completed successfully${colors.reset}\n`);
      } else {
        throw new Error(`${step.name} validation failed`);
      }
    } catch (error) {
      console.error(`${colors.red}✗ ${step.name} failed:${colors.reset}`, error.message);
      process.exit(1);
    }
  }

  console.log(`${colors.green}Build completed successfully!${colors.reset}`);
}

runBuild(); 