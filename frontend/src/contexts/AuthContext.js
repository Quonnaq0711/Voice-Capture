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
      let token, refreshToken;
      try {
        token = localStorage.getItem('token');
        refreshToken = localStorage.getItem('refresh_token');
      } catch (e) {
        console.warn('localStorage access denied (private browsing mode?):', e);
        setLoading(false);
        return;
      }

      if (token) {
        try {
          // Try to get profile with current token
          const profile = await auth.getProfile(token);
          setUser({ id: profile.id, token, name: profile.first_name });
        } catch (error) {
          // If access token is expired, try to refresh it
          if (error.response && error.response.status === 401 && refreshToken) {
            try {
              if (process.env.NODE_ENV === 'development') console.log('Access token expired, attempting to refresh...');
              const data = await auth.refreshToken();
              // Retry getting profile with new token
              const profile = await auth.getProfile(data.access_token);
              setUser({ id: profile.id, token: data.access_token, name: profile.first_name });
            } catch (refreshError) {
              // Refresh failed, tokens are invalid - logout
              console.warn('Token refresh failed during initial check:', refreshError);
              logout();
            }
          } else {
            // No refresh token or other error - logout
            console.warn('Token validation failed during initial check:', error);
            logout();
          }
        }
      }
      setLoading(false);
    };
    checkUser();
  }, [logout]); // logout is now stable via useCallback

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