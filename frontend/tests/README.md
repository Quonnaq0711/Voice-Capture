# Frontend Unit Tests

This directory contains comprehensive unit tests for the frontend React components of the Sadaora AI Assistant application.

## Test Structure

The test suite includes the following test files:

- **`setupTests.js`** - Test environment configuration and global mocks
- **`api.test.js`** - Tests for API service functions
- **`AuthContext.test.js`** - Tests for authentication context and hooks
- **`Login.test.js`** - Tests for Login component
- **`Register.test.js`** - Tests for Register component
- **`Dashboard.test.js`** - Tests for Dashboard component
- **`Profile.test.js`** - Tests for Profile component
- **`runTests.js`** - Test runner utility script

## Prerequisites

Ensure you have the following dependencies installed:

```bash
npm install @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

These should already be included in your `package.json` if you're using Create React App.

## Running Tests

### Method 1: Using npm scripts (Recommended)

```bash
# Run all tests once
npm test -- --watchAll=false

# Run tests in watch mode (auto-rerun on changes)
npm test

# Run tests with coverage report
npm test -- --coverage --watchAll=false

# Run specific test file
npm test -- --testPathPattern=Login.test.js
```

### Method 2: Using the custom test runner

```bash
# Show help and list available tests
node tests/runTests.js help

# List all test files
node tests/runTests.js list

# Run all tests
node tests/runTests.js run

# Run specific test file
node tests/runTests.js run Login.test.js

# Run tests in watch mode
node tests/runTests.js watch

# Generate coverage report
node tests/runTests.js coverage
```

## Test Coverage

The test suite covers the following areas:

### API Services (`api.test.js`)
- Authentication endpoints (login, register, logout)
- Chat functionality (save messages, get history)
- Session management (create, get, activate, delete)
- Profile operations (get, save, update, password change)
- File operations (avatar upload/delete, resume upload/delete)
- Error handling and request interceptors

### Authentication Context (`AuthContext.test.js`)
- Context provider functionality
- User initialization and state management
- Login/register/logout operations
- Hook usage and error handling
- Local storage integration

### Login Component (`Login.test.js`)
- Form rendering and field validation
- User input handling
- Success/failure login scenarios
- Navigation logic
- Error message display
- Loading states
- Accessibility attributes

### Register Component (`Register.test.js`)
- Registration form functionality
- Password confirmation validation
- Success/failure registration scenarios
- First-time user handling
- Form validation and error display
- Loading states

### Dashboard Component (`Dashboard.test.js`)
- Main dashboard rendering
- User data display
- Navigation functionality
- Personal assistant integration
- Agent modules display
- Personalized insights
- Achievement tracking
- API error handling

### Profile Component (`Profile.test.js`)
- Profile form rendering and data loading
- Form submission and validation
- Avatar upload/delete functionality
- Password change operations
- Resume upload functionality
- Notification preferences
- Error handling

## Test Configuration

### Setup (`setupTests.js`)
- Configures Jest testing environment
- Mocks `localStorage` and `window.location`
- Silences console methods during tests
- Clears all mocks before each test

### Mocking Strategy
- **API calls**: Mocked using `jest.fn()` with configurable return values
- **React Router**: Mocked navigation functions
- **Context providers**: Mocked with controllable state
- **File operations**: Mocked FileReader and file upload functionality
- **External libraries**: Mocked where necessary for isolated testing

## Writing New Tests

When adding new tests, follow these guidelines:

### 1. Test File Structure
```javascript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import YourComponent from '../src/components/YourComponent';

// Mock dependencies
jest.mock('../src/contexts/AuthContext');
jest.mock('../src/services/api');

// Wrapper for router context
const ComponentWrapper = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('YourComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mocks
  });

  it('should render correctly', () => {
    // Test implementation
  });
});
```

### 2. Test Categories
Organize tests into these categories:
- **Rendering tests**: Component renders without crashing
- **User interaction tests**: Button clicks, form submissions
- **State management tests**: Component state changes
- **API integration tests**: Mocked API calls and responses
- **Error handling tests**: Error scenarios and edge cases
- **Accessibility tests**: ARIA attributes and keyboard navigation

### 3. Best Practices
- Use `screen.getByRole()` for better accessibility testing
- Use `userEvent` instead of `fireEvent` for more realistic interactions
- Test user workflows, not implementation details
- Mock external dependencies consistently
- Use `waitFor()` for asynchronous operations
- Keep tests focused and independent

## Continuous Integration

For CI/CD pipelines, use:

```bash
# Run tests with coverage and exit
npm test -- --coverage --watchAll=false --ci
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase timeout in Jest configuration
   - Ensure all async operations use `waitFor()`

2. **Mock not working**
   - Check mock placement (before imports)
   - Verify mock path is correct
   - Clear mocks in `beforeEach()`

3. **Component not rendering**
   - Ensure all required props are provided
   - Check for missing context providers
   - Verify component imports

4. **File upload tests failing**
   - Ensure FileReader is properly mocked
   - Check file type and size validations

### Debug Tips

```javascript
// Debug rendered component
screen.debug();

// Check what's in the document
console.log(screen.getByTestId('your-element').innerHTML);

// Wait for element to appear
await waitFor(() => {
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

## Contributing

When contributing new tests:

1. Follow the existing test patterns
2. Ensure good test coverage (aim for >80%)
3. Write descriptive test names
4. Include both positive and negative test cases
5. Test edge cases and error scenarios
6. Update this README if adding new test categories

## Resources

- [React Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Accessibility Testing](https://testing-library.com/docs/guide-which-query/)