import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const location = useLocation();

  // Use refs to prevent premature clearing
  const errorTimerRef = useRef(null);
  const infoTimerRef = useRef(null);

  // Auto-dismiss error messages after 10 seconds (industry standard + buffer)
  useEffect(() => {
    // Clear any existing timer
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }

    if (error) {
      // Set new timer with ref to prevent cleanup issues
      errorTimerRef.current = setTimeout(() => {
        setError('');
        errorTimerRef.current = null;
      }, 10000); // 10 seconds - ensure visibility
    }

    // Cleanup function
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, [error]);

  // Auto-dismiss info messages after 10 seconds
  useEffect(() => {
    // Clear any existing timer
    if (infoTimerRef.current) {
      clearTimeout(infoTimerRef.current);
    }

    if (info) {
      infoTimerRef.current = setTimeout(() => {
        setInfo('');
        infoTimerRef.current = null;
      }, 10000);
    }

    return () => {
      if (infoTimerRef.current) {
        clearTimeout(infoTimerRef.current);
      }
    };
  }, [info]);

  useEffect(() => {
    if (location.state?.message) {
      setInfo(location.state.message);
      // Clear the state to prevent the message from showing again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Don't clear error immediately - let user read it if they're retrying
    // Only clear error once we start loading
    setLoading(true);

    try {
      await login(email, password);

      // Clear error only on successful login
      setError('');

      // Check if this is a first-time user
      const isFirstTimeUser = localStorage.getItem('isFirstTimeUser');
      if (isFirstTimeUser === 'true') {
        // Remove the flag and navigate to onboarding
        localStorage.removeItem('isFirstTimeUser');
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      // Use generic error message to prevent information leakage
      // Log actual error for debugging (only visible in browser console)
      console.error('Login error:', err.response?.data?.detail || err.message);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

   return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {info && (
            <div className="rounded-md bg-blue-50 p-4 relative animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="text-sm text-blue-700 flex-1">{info}</div>
                <button
                  type="button"
                  onClick={() => setInfo('')}
                  className="ml-3 flex-shrink-0 inline-flex text-blue-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-md p-1 transition-colors"
                  aria-label="Dismiss"
                >
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 p-4 relative animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="text-sm text-red-700 flex-1">{error}</div>
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="ml-3 flex-shrink-0 inline-flex text-red-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded-md p-1 transition-colors"
                  aria-label="Dismiss"
                >
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Sign up now
              </Link>
            </p>
            <p className="text-sm text-gray-600">
              Forgot Password?{' '}
              <Link
                to="/request-password"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Click Here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
