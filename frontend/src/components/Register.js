import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register = () => {
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  // ✅ Password validation logic
  const validatePassword = (pwd) => {
    const minLength = /.{8,}/;
    const upper = /[A-Z]/;
    const lower = /[a-z]/;
    const number = /[0-9]/;
    const special = /[!@#$%^&*(),.?":{}|<>]/;

    if (!minLength.test(pwd)) return 'Password must be at least 8 characters';
    if (!upper.test(pwd)) return 'Password must contain an uppercase letter';
    if (!lower.test(pwd)) return 'Password must contain a lowercase letter';
    if (!number.test(pwd)) return 'Password must contain a number';
    if (!special.test(pwd)) return 'Password must contain a special character';

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check password match
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    // Check password strength
    const pwdError = validatePassword(password);
    if (pwdError) {
      return setPasswordError(pwdError);
    }

    try {
      setError('');
      setPasswordError('');
      setLoading(true);

      await register(firstname, lastname, email, password);

      // Store date for 90-day password reset policy
      localStorage.setItem('registrationDate', new Date().toISOString());

      // Onboarding flag
      localStorage.setItem('isFirstTimeUser', 'true');

      navigate('/confirm-registration', {
        state: { email, isFirstTime: true },
      });
    } catch (err) {
      setError('Registration failed: ' + (err.response?.data?.detail || 'Please try again later'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    setPasswordError(validatePassword(pwd));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign Up for Idii
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}
          {passwordError && (
            <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700">{passwordError}</div>
          )}

          {/* First Name */}
          <div>
            <label htmlFor="firstname" className="sr-only">First Name</label>
            <input
              id="firstname"
              type="text"
              required
              placeholder="First Name"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastname" className="sr-only">Last Name</label>
            <input
              id="lastname"
              type="text"
              required
              placeholder="Last Name"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email-address" className="sr-only">Email</label>
            <input
              id="email-address"
              type="email"
              required
              placeholder="Email address"
              autoComplete="email"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Password"
              autoComplete="new-password"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              value={password}
              onChange={handlePasswordChange}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              required
              placeholder="Confirm password"
              autoComplete="new-password"
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              {loading ? 'Registering...' : 'Sign Up'}
            </button>
          </div>

          <div className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
