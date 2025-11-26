import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../src/components/auth/Login';
import { useAuth } from '../src/contexts/AuthContext';

// Mock the AuthContext
jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    state: {},
    pathname: '/login',
  }),
}));

// Wrapper component for testing with router
const LoginWrapper = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Login Component', () => {
  const mockLogin = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Default mock implementation
    useAuth.mockReturnValue({
      login: mockLogin,
      user: null,
      loading: false,
    });
  });

  it('should render login form correctly', () => {
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText('Sign up now')).toBeInTheDocument();
  });

  it('should update email and password fields when user types', async () => {
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('should call login function when form is submitted', async () => {
    mockLogin.mockResolvedValue({ access_token: 'mock-token' });
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('should navigate to dashboard after successful login', async () => {
    mockLogin.mockResolvedValue({ access_token: 'mock-token' });
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should navigate to onboarding for first-time users', async () => {
    mockLogin.mockResolvedValue({ access_token: 'mock-token' });
    // Mock localStorage.getItem to return 'true' for isFirstTimeUser
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'isFirstTimeUser') return 'true';
      return null;
    });
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(localStorage.removeItem).toHaveBeenCalledWith('isFirstTimeUser');
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('should display error message when login fails', async () => {
    const mockError = {
      response: {
        data: {
          detail: 'Invalid credentials',
        },
      },
    };
    mockLogin.mockRejectedValue(mockError);
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'wrongpassword');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password. Please try again.')).toBeInTheDocument();
    });
  });

  it('should display generic error message when error has no detail', async () => {
    const mockError = new Error('Network error');
    mockLogin.mockRejectedValue(mockError);
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password. Please try again.')).toBeInTheDocument();
    });
  });

  it('should show loading state during login', async () => {
    // Create a promise that we can control
    let resolveLogin;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    mockLogin.mockReturnValue(loginPromise);
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');
    await userEvent.click(submitButton);

    // Check loading state
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Resolve the login
    resolveLogin({ access_token: 'mock-token' });
    
    await waitFor(() => {
      expect(screen.getByText('Sign in')).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should clear error when new login attempt is made', async () => {
    
    // First, make a failed login
    const mockError = {
      response: {
        data: {
          detail: 'Invalid credentials',
        },
      },
    };
    mockLogin.mockRejectedValueOnce(mockError);
    
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // First failed attempt
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'wrongpassword');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password. Please try again.')).toBeInTheDocument();
    });

    // Second successful attempt
    mockLogin.mockResolvedValue({ access_token: 'mock-token' });
    await userEvent.clear(passwordInput);
    await userEvent.type(passwordInput, 'correctpassword');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('Invalid email or password. Please try again.')).not.toBeInTheDocument();
    });
  });

  it('should require email and password fields', () => {
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should have proper accessibility attributes', () => {
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    );

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');

    expect(emailInput).toHaveAttribute('id', 'email-address');
    expect(passwordInput).toHaveAttribute('id', 'password');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
  });
});