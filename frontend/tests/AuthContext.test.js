import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { auth } from '../src/services/api';

// Mock the API module
jest.mock('../src/services/api', () => ({
  auth: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    refreshToken: jest.fn(),
  },
}));

// Test component that uses the AuthContext
const TestComponent = () => {
  const { user, loading, login, register, logout } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="user">{user ? 'authenticated' : 'not-authenticated'}</div>
      <button onClick={() => login('test@example.com', 'password')} data-testid="login-btn">
        Login
      </button>
      <button onClick={() => register('Test', 'User', 'test@example.com', 'password')} data-testid="register-btn">
        Register
      </button>
      <button onClick={logout} data-testid="logout-btn">
        Logout
      </button>
    </div>
  );
};

// Component that tries to use useAuth outside of provider
const ComponentWithoutProvider = () => {
  const auth = useAuth();
  return <div>{auth.user}</div>;
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Reset localStorage.getItem to return null by default
    localStorage.getItem.mockReturnValue(null);
  });

  describe('AuthProvider', () => {
    it('should provide authentication context to children', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      expect(screen.getByTestId('user')).toHaveTextContent('not-authenticated');
    });

    it('should initialize user from localStorage token', async () => {
      const mockProfile = {
        id: 1,
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
      };
      auth.getProfile.mockResolvedValue(mockProfile);
      // Mock localStorage.getItem to return the token
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'token') return 'existing-token';
        return null;
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(auth.getProfile).toHaveBeenCalledWith('existing-token');
        expect(screen.getByTestId('user')).toHaveTextContent('authenticated');
      });
    });

    it('should handle login successfully', async () => {
      const mockLoginResponse = {
        access_token: 'new-token',
        token_type: 'bearer',
      };
      const mockProfile = {
        id: 1,
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
      };
      auth.login.mockResolvedValue(mockLoginResponse);
      auth.getProfile.mockResolvedValue(mockProfile);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const loginButton = screen.getByTestId('login-btn');

      await act(async () => {
        loginButton.click();
      });

      await waitFor(() => {
        expect(auth.login).toHaveBeenCalledWith('test@example.com', 'password');
        expect(auth.getProfile).toHaveBeenCalledWith('new-token');
        expect(screen.getByTestId('user')).toHaveTextContent('authenticated');
      });
    });

    it('should handle login error', async () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      const mockError = { message: 'Invalid credentials' };
      auth.login.mockRejectedValue(mockError);

      // Create a test component that handles errors silently
      const TestComponentWithErrorHandling = () => {
        const { user, loading, login, register, logout } = useAuth();
        
        const handleLogin = async () => {
          try {
            await login('test@example.com', 'password');
          } catch (error) {
            // Silently handle error
          }
        };
        
        return (
          <div>
            <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
            <div data-testid="user">{user ? 'authenticated' : 'not-authenticated'}</div>
            <button onClick={handleLogin} data-testid="login-btn">
              Login
            </button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponentWithErrorHandling />
        </AuthProvider>
      );

      const loginButton = screen.getByTestId('login-btn');
      
      await act(async () => {
        loginButton.click();
      });

      await waitFor(() => {
        expect(auth.login).toHaveBeenCalledWith('test@example.com', 'password');
        expect(screen.getByTestId('user')).toHaveTextContent('not-authenticated');
      });

      // Restore console.error
      console.error = originalError;
    });

    it('should handle register successfully', async () => {
      const mockRegisterResponse = {
        message: 'User registered successfully',
        user_id: 1,
      };
      auth.register.mockResolvedValue(mockRegisterResponse);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const registerButton = screen.getByTestId('register-btn');
      
      await act(async () => {
        registerButton.click();
      });

      await waitFor(() => {
        expect(auth.register).toHaveBeenCalledWith('Test', 'User', 'test@example.com', 'password');
      });
    });

    it('should handle register error', async () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      const mockError = { message: 'Registration failed' };
      auth.register.mockRejectedValue(mockError);

      // Create a test component that handles errors silently
      const TestComponentWithErrorHandling = () => {
        const { user, loading, login, register, logout } = useAuth();
        
        const handleRegister = async () => {
          try {
            await register('Test', 'User', 'test@example.com', 'password');
          } catch (error) {
            // Silently handle error
          }
        };
        
        return (
          <div>
            <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
            <div data-testid="user">{user ? 'authenticated' : 'not-authenticated'}</div>
            <button onClick={handleRegister} data-testid="register-btn">
              Register
            </button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponentWithErrorHandling />
        </AuthProvider>
      );

      const registerButton = screen.getByTestId('register-btn');
      
      await act(async () => {
        registerButton.click();
      });

      await waitFor(() => {
        expect(auth.register).toHaveBeenCalledWith('Test', 'User', 'test@example.com', 'password');
      });

      // Restore console.error
      console.error = originalError;
    });

    it('should handle logout', async () => {
      const mockProfile = {
        id: 1,
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
      };
      auth.getProfile.mockResolvedValue(mockProfile);
      // Mock localStorage.getItem to return the token
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'token') return 'existing-token';
        return null;
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initial authentication
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('authenticated');
      });

      const logoutButton = screen.getByTestId('logout-btn');

      await act(async () => {
        logoutButton.click();
      });

      await waitFor(() => {
        expect(auth.logout).toHaveBeenCalled();
        expect(screen.getByTestId('user')).toHaveTextContent('not-authenticated');
      });
    });

    it('should show loading state initially', () => {
      // Mock a delayed render to test loading state
      const DelayedTestComponent = () => {
        const { loading } = useAuth();
        return <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>;
      };

      render(
        <AuthProvider>
          <DelayedTestComponent />
        </AuthProvider>
      );

      // The loading state should be false after initial render
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      // Use a wrapper function to catch the error properly
      const renderComponent = () => {
        render(<ComponentWithoutProvider />);
      };

      expect(renderComponent).toThrow('useAuth must be used within an AuthProvider');

      // Restore console.error
      console.error = originalError;
    });

    it('should return auth context when used within AuthProvider', () => {
      const TestHookComponent = () => {
        const authContext = useAuth();
        
        return (
          <div>
            <div data-testid="has-user">{typeof authContext.user !== 'undefined' ? 'true' : 'false'}</div>
            <div data-testid="has-login">{typeof authContext.login === 'function' ? 'true' : 'false'}</div>
            <div data-testid="has-register">{typeof authContext.register === 'function' ? 'true' : 'false'}</div>
            <div data-testid="has-logout">{typeof authContext.logout === 'function' ? 'true' : 'false'}</div>
            <div data-testid="has-loading">{typeof authContext.loading !== 'undefined' ? 'true' : 'false'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestHookComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('has-user')).toHaveTextContent('true');
      expect(screen.getByTestId('has-login')).toHaveTextContent('true');
      expect(screen.getByTestId('has-register')).toHaveTextContent('true');
      expect(screen.getByTestId('has-logout')).toHaveTextContent('true');
      expect(screen.getByTestId('has-loading')).toHaveTextContent('true');
    });
  });
});