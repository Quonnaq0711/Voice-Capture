import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { auth } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Stable logout function - wrapped in useCallback to prevent unnecessary re-renders
  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch (error) {
      // Even if logout fails, clear local state
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  }, []);

  // Listen for storage events (cross-tab synchronization)
  // Using useEffect without dependencies to avoid re-registering listener
  useEffect(() => {
    const handleStorageChange = (e) => {
      // If token was removed in another tab, logout this tab too
      if (e.key === 'token' && !e.newValue) {
        if (process.env.NODE_ENV === 'development') console.log('Token removed in another tab, logging out...');
        setUser(null);
        window.location.href = '/login';
      }
      // If token was updated in another tab, update user state
      else if (e.key === 'token' && e.newValue) {
        if (process.env.NODE_ENV === 'development') console.log('Token updated in another tab, syncing...');
        // Update token using setUser with callback to access latest state
        setUser(prevUser => {
          if (prevUser) {
            return { ...prevUser, token: e.newValue };
          }
          return prevUser;
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []); // Empty dependency array - only register once

  useEffect(() => {
    const checkUser = async () => {
      // Wrap localStorage access in try-catch for private browsing mode compatibility
      let token;
      try {
        token = localStorage.getItem('token');
      } catch (e) {
        console.warn('localStorage access denied (private browsing mode?):', e);
        setLoading(false);
        return;
      }

      if (token) {
        try {
          // Try to get profile with current token.
          // If token is expired, the axios interceptor in api.js automatically
          // handles refresh — no need to duplicate that logic here.
          const profile = await auth.getProfile(token);
          // Interceptor may have refreshed the token; read the latest from localStorage
          const currentToken = localStorage.getItem('token') || token;
          setUser({ id: profile.id, token: currentToken, name: profile.first_name });
        } catch (error) {
          // Interceptor already tried token refresh. If we reach here, auth failed completely.
          // handleAuthenticationFailure() in api.js already cleared localStorage and
          // triggered a redirect, but we still clean up React state for safety.
          console.warn('Auth check failed:', error.message || error);
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    try {
      const data = await auth.login(email, password);
      // After login, fetch user profile
        const profile = await auth.getProfile(data.access_token);
        setUser({ id: profile.id, token: data.access_token, name: profile.first_name });
      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (first_name, last_name, email, password) => {
    try {
      const data = await auth.register(first_name, last_name, email, password);
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Verify registration OTP
  const verifyRegistrationOTP = async (email, otp) => {
        try {
            const response = await auth.verifyRegistrationOTP(email, otp);
            return response;
        } catch (error) {
            throw error;
        }
    };

  // Resend registration OTP
  const resendRegistrationOTP = async (email) => {
        try {
            const response = await auth.resendRegistrationOTP(email);
            return response;
        } catch (error) {
            throw error;
        }
    };

    // Password reset request function 
    const resetPasswordRequest = async (email) => {
        try {
            const response = await auth.resetPasswordRequest(email);
            return response;
        } catch (error) {
            throw error;
        }
    };

    // Verify password reset OTP and set new password
    const verifyPasswordOTP = async (email, otp, newPassword) => {
        try {
            const response = await auth.verifyPasswordOTP(email, otp, newPassword);
            return response;
        } catch (error) {
            throw error;
        }
    };

  const value = {
    user,
    loading,
    login,
    register,
    verifyRegistrationOTP,
    verifyPasswordOTP,
    resetPasswordRequest,
    resendRegistrationOTP,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};