import { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours (120 minutes) - industry standard for personal data apps

const AutoLogoutProvider = ({ children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let inactivityTimer;

    // Define handleLogout inside useEffect to avoid recreating event listeners
    const handleLogout = async () => {
      console.log(`Auto-logout triggered: User inactive for ${INACTIVITY_TIMEOUT / 1000 / 60} minutes`);
      await logout();
      navigate('/login', { state: { message: 'You have been logged out due to inactivity.' } });
    };

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Set up event listeners
    events.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    // Start the timer
    resetTimer();

    // Cleanup function
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      clearTimeout(inactivityTimer);
    };
  }, [logout, navigate]);

  return <>{children}</>;
};

export default AutoLogoutProvider;