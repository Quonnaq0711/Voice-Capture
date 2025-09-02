import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for token in local storage
    const token = localStorage.getItem('token');
    if (token) {
      setUser({ token });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const data = await auth.login(email, password);
      setUser({ token: data.access_token });
      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (username, email, password) => {
    try {
      const data = await auth.register(username, email, password);
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

    // Password reset request function - THIS IS WHAT YOU'RE MISSING
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
  const logout = () => {
    auth.logout();
    setUser(null);
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