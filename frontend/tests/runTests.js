/**
 * Test runner script for frontend unit tests
 * This script provides utilities for running and managing frontend tests
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Print colored console messages
 * @param {string} message - Message to print
 * @param {string} color - Color code
 */
function printColored(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Print section header
 * @param {string} title - Section title
 */
function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  printColored(title, colors.bright + colors.cyan);
  console.log('='.repeat(60));
}

/**
 * Check if required dependencies are installed
 */
function checkDependencies() {
  printHeader('Checking Dependencies');
  
  const requiredDeps = [
    '@testing-library/react',
    '@testing-library/jest-dom',
    '@testing-library/user-event',
    'jest'
  ];
  
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    printColored('❌ package.json not found', colors.red);
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  let allPresent = true;
  
  requiredDeps.forEach(dep => {
    if (allDeps[dep]) {
      printColored(`✅ ${dep} - ${allDeps[dep]}`, colors.green);
    } else {
      printColored(`❌ ${dep} - Missing`, colors.red);
      allPresent = false;
    }
  });
  
  return allPresent;
}

/**
 * List all test files
 */
function listTestFiles() {
  printHeader('Available Test Files');
  
  const testDir = __dirname;
  const testFiles = fs.readdirSync(testDir)
    .filter(file => file.endsWith('.test.js'))
    .sort();
  
  if (testFiles.length === 0) {
    printColored('No test files found', colors.yellow);
    return [];
  }
  
  testFiles.forEach((file, index) => {
    printColored(`${index + 1}. ${file}`, colors.blue);
  });
  
  return testFiles;
}

/**
 * Run specific test file
 * @param {string} testFile - Test file name
 */
function runSingleTest(testFile) {
  printHeader(`Running Test: ${testFile}`);
  
  try {
    const command = `npm test -- --testPathPattern=${testFile} --verbose`;
    printColored(`Executing: ${command}`, colors.yellow);
    
    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    printColored(`✅ Test completed: ${testFile}`, colors.green);
  } catch (error) {
    printColored(`❌ Test failed: ${testFile}`, colors.red);
    console.error(error.message);
  }
}

/**
 * Run all tests
 */
function runAllTests() {
  printHeader('Running All Tests');
  
  try {
    const command = 'npm test -- --watchAll=false --coverage';
    printColored(`Executing: ${command}`, colors.yellow);
    
    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    printColored('✅ All tests completed successfully', colors.green);
  } catch (error) {
    printColored('❌ Some tests failed', colors.red);
    console.error(error.message);
  }
}

/**
 * Run tests in watch mode
 */
function runWatchMode() {
  printHeader('Running Tests in Watch Mode');
  
  try {
    const command = 'npm test';
    printColored(`Executing: ${command}`, colors.yellow);
    printColored('Press Ctrl+C to exit watch mode', colors.magenta);
    
    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
  } catch (error) {
    printColored('Watch mode interrupted', colors.yellow);
  }
}

/**
 * Generate test coverage report
 */
function generateCoverage() {
  printHeader('Generating Coverage Report');
  
  try {
    const command = 'npm test -- --coverage --watchAll=false';
    printColored(`Executing: ${command}`, colors.yellow);
    
    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    printColored('✅ Coverage report generated', colors.green);
    printColored('Check the coverage/ directory for detailed reports', colors.blue);
  } catch (error) {
    printColored('❌ Coverage generation failed', colors.red);
    console.error(error.message);
  }
}

/**
 * Main function to handle command line arguments
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  printColored('Frontend Test Runner', colors.bright + colors.magenta);
  printColored('====================', colors.magenta);
  
  // Check dependencies first
  if (!checkDependencies()) {
    printColored('\n❌ Missing required dependencies. Please install them first:', colors.red);
    printColored('npm install @testing-library/react @testing-library/jest-dom @testing-library/user-event', colors.yellow);
    process.exit(1);
  }
  
  switch (command) {
    case 'list':
      listTestFiles();
      break;
      
    case 'run':
      if (args[1]) {
        runSingleTest(args[1]);
      } else {
        runAllTests();
      }
      break;
      
    case 'watch':
      runWatchMode();
      break;
      
    case 'coverage':
      generateCoverage();
      break;
      
    case 'help':
    default:
      printHeader('Usage Instructions');
      console.log('Available commands:');
      console.log('');
      printColored('node runTests.js list', colors.blue);
      console.log('  - List all available test files');
      console.log('');
      printColored('node runTests.js run [testfile]', colors.blue);
      console.log('  - Run all tests or specific test file');
      console.log('  - Example: node runTests.js run Login.test.js');
      console.log('');
      printColored('node runTests.js watch', colors.blue);
      console.log('  - Run tests in watch mode (auto-rerun on changes)');
      console.log('');
      printColored('node runTests.js coverage', colors.blue);
      console.log('  - Generate test coverage report');
      console.log('');
      printColored('node runTests.js help', colors.blue);
      console.log('  - Show this help message');
      console.log('');
      
      // List available test files
      listTestFiles();
      break;
  }
}

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  checkDependencies,
  listTestFiles,
  runSingleTest,
  runAllTests,
  runWatchMode,
  generateCoverage
};