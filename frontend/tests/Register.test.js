import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Register from '../src/components/auth/Register';
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
}));

// Wrapper component for testing with router
const RegisterWrapper = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Register Component', () => {
  const mockRegister = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default mock implementation
    useAuth.mockReturnValue({
      register: mockRegister,
      user: null,
      loading: false,
    });
  });

  it('should render registration form correctly', () => {
    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    expect(screen.getByText('Sign Up for Idii')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email Address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('should update input fields when user types', async () => {
    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const emailInput = screen.getByPlaceholderText('Email Address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password');

    await userEvent.type(firstNameInput, 'Test');
    await userEvent.type(lastNameInput, 'User');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'Password123!');
    await userEvent.type(confirmPasswordInput, 'Password123!');

    expect(firstNameInput).toHaveValue('Test');
    expect(lastNameInput).toHaveValue('User');
    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('Password123!');
    expect(confirmPasswordInput).toHaveValue('Password123!');
  });

  it('should call register function when form is submitted with valid data', async () => {
    mockRegister.mockResolvedValue({ message: 'User registered successfully' });

    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const emailInput = screen.getByPlaceholderText('Email Address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await userEvent.type(firstNameInput, 'Test');
    await userEvent.type(lastNameInput, 'User');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'Password123!');
    await userEvent.type(confirmPasswordInput, 'Password123!');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('Test', 'User', 'test@example.com', 'Password123!');
    });
  });

  it('should navigate to confirm-registration page after successful registration', async () => {
    mockRegister.mockResolvedValue({ message: 'User registered successfully' });

    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const emailInput = screen.getByPlaceholderText('Email Address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await userEvent.type(firstNameInput, 'Test');
    await userEvent.type(lastNameInput, 'User');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'Password123!');
    await userEvent.type(confirmPasswordInput, 'Password123!');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('isFirstTimeUser', 'true');
      expect(mockNavigate).toHaveBeenCalledWith('/confirm-registration', {
        state: {
          email: 'test@example.com',
          isFirstTime: true,
        },
      });
    });
  });

  it('should display error when passwords do not match', async () => {
    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const emailInput = screen.getByPlaceholderText('Email Address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await userEvent.type(firstNameInput, 'Test');
    await userEvent.type(lastNameInput, 'User');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'Password123!');
    await userEvent.type(confirmPasswordInput, 'DifferentPassword123!');
    await userEvent.click(submitButton);

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should display error message when registration fails', async () => {
    const mockError = {
      response: {
        data: {
          detail: 'Email already exists',
        },
      },
    };
    mockRegister.mockRejectedValue(mockError);

    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const emailInput = screen.getByPlaceholderText('Email Address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await userEvent.type(firstNameInput, 'Test');
    await userEvent.type(lastNameInput, 'User');
    await userEvent.type(emailInput, 'existing@example.com');
    await userEvent.type(passwordInput, 'Password123!');
    await userEvent.type(confirmPasswordInput, 'Password123!');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Registration failed: Email already exists')).toBeInTheDocument();
    });
  });

  it('should display generic error message when error has no detail', async () => {
    const mockError = new Error('Network error');
    mockRegister.mockRejectedValue(mockError);

    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const emailInput = screen.getByPlaceholderText('Email Address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await userEvent.type(firstNameInput, 'Test');
    await userEvent.type(lastNameInput, 'User');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'Password123!');
    await userEvent.type(confirmPasswordInput, 'Password123!');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Registration failed: Please try again later')).toBeInTheDocument();
    });
  });

  it('should show loading state during registration', async () => {
    // Create a promise that we can control
    let resolveRegister;
    const registerPromise = new Promise((resolve) => {
      resolveRegister = resolve;
    });
    mockRegister.mockReturnValue(registerPromise);

    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const emailInput = screen.getByPlaceholderText('Email Address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    await userEvent.type(firstNameInput, 'Test');
    await userEvent.type(lastNameInput, 'User');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'Password123!');
    await userEvent.type(confirmPasswordInput, 'Password123!');
    await userEvent.click(submitButton);

    // Check loading state
    expect(screen.getByText('Registering...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Resolve the registration
    resolveRegister({ message: 'User registered successfully' });

    await waitFor(() => {
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should clear error when new registration attempt is made', async () => {
    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const emailInput = screen.getByPlaceholderText('Email Address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    // First attempt with mismatched passwords
    await userEvent.type(firstNameInput, 'Test');
    await userEvent.type(lastNameInput, 'User');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'Password123!');
    await userEvent.type(confirmPasswordInput, 'DifferentPassword123!');
    await userEvent.click(submitButton);

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();

    // Second attempt with matching passwords
    mockRegister.mockResolvedValue({ message: 'User registered successfully' });
    await userEvent.clear(confirmPasswordInput);
    await userEvent.type(confirmPasswordInput, 'Password123!');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
    });
  });

  it('should require all form fields', () => {
    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const emailInput = screen.getByPlaceholderText('Email Address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password');

    expect(firstNameInput).toBeRequired();
    expect(lastNameInput).toBeRequired();
    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
    expect(confirmPasswordInput).toBeRequired();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
  });

  it('should have proper accessibility attributes', () => {
    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const firstNameInput = screen.getByPlaceholderText('First Name');
    const lastNameInput = screen.getByPlaceholderText('Last Name');
    const emailInput = screen.getByPlaceholderText('Email Address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm Password');

    expect(firstNameInput).toHaveAttribute('id', 'firstname');
    expect(lastNameInput).toHaveAttribute('id', 'lastname');
    expect(emailInput).toHaveAttribute('id', 'email-address');
    expect(passwordInput).toHaveAttribute('id', 'password');
    expect(confirmPasswordInput).toHaveAttribute('id', 'confirm-password');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');
    expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password');
  });

  it('should show password strength meter when typing password', async () => {
    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const passwordInput = screen.getByPlaceholderText('Password');

    // Type a weak password
    await userEvent.type(passwordInput, 'weak');
    expect(screen.getByText('Weak')).toBeInTheDocument();

    // Type a stronger password
    await userEvent.clear(passwordInput);
    await userEvent.type(passwordInput, 'Password123!');
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('should show password validation errors', async () => {
    render(
      <RegisterWrapper>
        <Register />
      </RegisterWrapper>
    );

    const passwordInput = screen.getByPlaceholderText('Password');

    // Type a password without uppercase
    await userEvent.type(passwordInput, 'password123!');
    expect(screen.getByText('Password must include an uppercase letter.')).toBeInTheDocument();
  });
});
