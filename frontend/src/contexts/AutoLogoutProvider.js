import React, { useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

const INACTIVITY_TIMEOUT = 90 * 60 * 1000; // 90 minutes

const AutoLogoutProvider = ({ children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { state: { message: 'You have been logged out due to inactivity.' } });
  }, [logout, navigate]);

  useEffect(() => {
    let inactivityTimer;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];

    const setupListeners = () => {
      events.forEach(event => {
        window.addEventListener(event, resetTimer);
      });
      resetTimer();
    };

    const cleanupListeners = () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      clearTimeout(inactivityTimer);
    };

    setupListeners();

    return () => {
      cleanupListeners();
    };
  }, [handleLogout]);

  return <>{children}</>;
};

export default AutoLogoutProvider;