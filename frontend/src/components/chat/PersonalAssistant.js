import React, { useState, useEffect, useRef, useCallback, useReducer, useMemo, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ChatDialog from './ChatDialog';

// ==================== TIMING CONSTANTS ====================
const NOTIFICATION_DISMISS_MS = 5000;      // Auto-dismiss notification after 5s
const WELCOME_MESSAGE_TIMEOUT_MS = 10000;  // Auto-hide welcome message after 10s
const NAVIGATION_COUNTDOWN_MS = 1000;      // Countdown tick interval (1s)
const AGENT_WELCOME_DISPLAY_MS = 5000;     // Show agent welcome for 5s
const NAVIGATION_DELAY_MS = 500;           // Delay before navigation actions
const STATE_REQUEST_TIMEOUT_MS = 1000;     // Timeout for state requests
const ASSISTANT_SIZE_PX = 120;             // Approximate size of assistant avatar
const ASSISTANT_PADDING_PX = 20;           // Padding from screen edges

// Create a custom event system to replace window object pollution
const dispatchNavigationEvent = (eventName, detail) => {
  const event = new CustomEvent(`assistant:${eventName}`, { detail });
  document.dispatchEvent(event);
};

const subscribeToNavigationEvent = (eventName, handler) => {
  const eventType = `assistant:${eventName}`;
  document.addEventListener(eventType, handler);
  return () => document.removeEventListener(eventType, handler);
};

// Helper to dispatch chat events (replaces window.updateCountdownMessage etc.)
const dispatchChatEvent = (type, payload) => {
  document.dispatchEvent(new CustomEvent(`chat:${type}`, { detail: payload }));
};

// ==================== NAVIGATION STATE MACHINE ====================
// Navigation states - prevents race conditions from multiple useState calls
const NavigationState = {
  IDLE: 'IDLE',                   // Not navigating
  COUNTDOWN: 'COUNTDOWN',         // Countdown in progress
  NAVIGATING: 'NAVIGATING',       // Navigation executing
  AGENT_WELCOME: 'AGENT_WELCOME'  // Showing agent welcome message
};

// Navigation action types
const NavigationActions = {
  START_COUNTDOWN: 'START_COUNTDOWN',
  UPDATE_COUNTDOWN: 'UPDATE_COUNTDOWN',
  CANCEL_NAVIGATION: 'CANCEL_NAVIGATION',
  EXECUTE_NAVIGATION: 'EXECUTE_NAVIGATION',
  SHOW_AGENT_WELCOME: 'SHOW_AGENT_WELCOME',
  HIDE_AGENT_WELCOME: 'HIDE_AGENT_WELCOME',
  RESET: 'RESET'
};

// Initial navigation state
const initialNavigationState = {
  state: NavigationState.IDLE,
  countdown: 3,
  targetAgent: null
};

// Navigation reducer - handles all navigation state transitions atomically
const navigationReducer = (state, action) => {
  switch (action.type) {
    case NavigationActions.START_COUNTDOWN:
      // Start countdown to navigate to target agent
      return {
        state: NavigationState.COUNTDOWN,
        countdown: 3,
        targetAgent: action.payload.targetAgent
      };

    case NavigationActions.UPDATE_COUNTDOWN:
      // Decrement countdown timer
      const newCountdown = state.countdown - 1;
      if (newCountdown <= 0) {
        // Countdown finished - transition to navigating state
        return {
          state: NavigationState.NAVIGATING,
          countdown: 0,
          targetAgent: state.targetAgent
        };
      }
      return {
        ...state,
        countdown: newCountdown
      };

    case NavigationActions.CANCEL_NAVIGATION:
      // Cancel ongoing navigation and return to idle
      return {
        state: NavigationState.IDLE,
        countdown: 3,
        targetAgent: null
      };

    case NavigationActions.EXECUTE_NAVIGATION:
      // Navigation completed - show agent welcome
      return {
        state: NavigationState.AGENT_WELCOME,
        countdown: 3,
        targetAgent: state.targetAgent
      };

    case NavigationActions.SHOW_AGENT_WELCOME:
      // Explicitly show agent welcome
      return {
        ...state,
        state: NavigationState.AGENT_WELCOME
      };

    case NavigationActions.HIDE_AGENT_WELCOME:
      // Hide agent welcome and return to idle
      return {
        state: NavigationState.IDLE,
        countdown: 3,
        targetAgent: null
      };

    case NavigationActions.RESET:
      // Reset to initial state
      return initialNavigationState;

    default:
      return state;
  }
};

// Memoized bubble components to prevent unnecessary re-renders
const WelcomeBubble = memo(({ user, onClose }) => (
  <div className="absolute bottom-full mb-2 w-64 bg-white p-4 rounded-lg shadow-lg right-0 transform transition-all duration-300 ease-in-out origin-bottom-right scale-100">
    <button
      onClick={onClose}
      className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
      aria-label="Close welcome message"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
    <h3 className="text-lg font-bold text-gray-800 pr-6">Welcome, {user?.first_name || 'User'}!</h3>
    <p className="text-sm text-gray-600 mt-1">Your personal AI assistant for a better life. What can I help you with today?</p>
    <div className="absolute right-4 -bottom-2 w-4 h-4 bg-white transform rotate-45"></div>
  </div>
));

const getBubbleColor = (type) => {
  switch (type) {
    case 'success':
    case 'complete':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-blue-500';
  }
};

const NotificationBubble = memo(({ notification, onClose }) => {
  if (!notification) return null;

  const color = getBubbleColor(notification.type);

  return (
    <div className={`absolute bottom-full mb-2 w-72 ${color} text-white p-4 rounded-lg shadow-lg right-0 transform transition-all duration-300 ease-in-out origin-bottom-right scale-100`}>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-white hover:text-gray-200 transition-colors"
        aria-label="Close notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {notification.title && (
        <h3 className="text-sm font-bold pr-6 mb-1">{notification.title}</h3>
      )}
      <p className="text-sm opacity-95">{notification.message}</p>
      {notification.type === 'progress' && notification.progress !== undefined && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1 opacity-90">
            <span>{notification.current_section || 'Processing'}</span>
            <span>{notification.progress}%</span>
          </div>
          <div className="w-full bg-white bg-opacity-30 rounded-full h-1.5">
            <div className="bg-white h-1.5 rounded-full transition-all duration-300" style={{ width: `${notification.progress}%` }}></div>
          </div>
        </div>
      )}
      <div className={`absolute right-4 -bottom-2 w-4 h-4 ${color} transform rotate-45`}></div>
    </div>
  );
});

const AgentWelcomeBubble = memo(({ currentAgent, onClose }) => {
  if (!currentAgent) return null;

  return (
    <div className="absolute bottom-full mb-2 w-64 bg-green-500 text-white p-4 rounded-lg shadow-lg right-0 transform transition-all duration-300 ease-in-out origin-bottom-right scale-100">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-white hover:text-gray-200 transition-colors"
        aria-label="Close welcome message"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <h3 className="text-lg font-bold pr-6">Welcome to {currentAgent.displayName}!</h3>
      <p className="text-sm mt-1">Your {currentAgent.displayName} agent is ready to assist you.</p>
      <div className="absolute right-4 -bottom-2 w-4 h-4 bg-green-500 transform rotate-45"></div>
    </div>
  );
});

const PersonalAssistant = ({ user, isDialogOpen: externalIsDialogOpen, setIsDialogOpen: externalSetIsDialogOpen, onDialogClose, onUnreadCountChange, onOpenAgentModal, agentType, notifications = [], initialSessionId, onSessionSwitched }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [internalIsDialogOpen, setInternalIsDialogOpen] = useState(false);

  // Use external state if provided, otherwise use internal state
  const isDialogOpen = externalIsDialogOpen !== undefined ? externalIsDialogOpen : internalIsDialogOpen;
  const setIsDialogOpen = externalSetIsDialogOpen || setInternalIsDialogOpen;

  // Always show welcome message on mount
  const [showWelcome, setShowWelcome] = useState(true);

  // Notification bubble state
  const [activeNotification, setActiveNotification] = useState(null);
  const notificationProcessedRef = useRef(new Set());
  const notificationTimerRef = useRef(null);

  // Reset showWelcome to true whenever user changes (login/logout)
  useEffect(() => {
    if (user?.first_name) {
      setShowWelcome(true);
    }
  }, [user?.id]); // Trigger when user ID changes (login/logout)

  // Handle notifications - show the latest unprocessed notification
  useEffect(() => {
    if (notifications.length > 0) {
      // Find the latest notification that hasn't been processed
      const latestNotification = notifications.find(n => !notificationProcessedRef.current.has(n.id));

      if (latestNotification) {
        // Clear any existing timer before setting new notification
        if (notificationTimerRef.current) {
          clearTimeout(notificationTimerRef.current);
          notificationTimerRef.current = null;
        }

        // Hide welcome message when showing notification
        setShowWelcome(false);
        setActiveNotification(latestNotification);
        notificationProcessedRef.current.add(latestNotification.id);

        // Auto-dismiss after 5 seconds (except for error notifications)
        if (latestNotification.type !== 'error') {
          notificationTimerRef.current = setTimeout(() => {
            setActiveNotification(null);
            notificationTimerRef.current = null;
          }, NOTIFICATION_DISMISS_MS);
        }
      }
    }
  }, [notifications]);

  // Cleanup timer on unmount only
  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  // Calculate safe initial position
  const getInitialPosition = useCallback(() => {
    return {
      x: Math.max(ASSISTANT_PADDING_PX, window.innerWidth - ASSISTANT_SIZE_PX - ASSISTANT_PADDING_PX),
      y: Math.max(ASSISTANT_PADDING_PX, window.innerHeight - ASSISTANT_SIZE_PX - ASSISTANT_PADDING_PX)
    };
  }, []);

  const [position, setPosition] = useState(getInitialPosition());

  // Use reducer for navigation state management to prevent race conditions
  // This replaces 4 separate useState calls: showCountdown, countdown, targetAgent, showAgentWelcome
  const [navState, dispatchNav] = useReducer(navigationReducer, initialNavigationState);

  // Ref to access navState in event handlers without causing listener rebuilds
  const navStateRef = useRef(navState);
  useEffect(() => {
    navStateRef.current = navState;
  }, [navState]);

  const [hasDialogBeenOpened, setHasDialogBeenOpened] = useState(false);

  useEffect(() => {
    if (externalIsDialogOpen) {
      setHasDialogBeenOpened(true);
    }
  }, [externalIsDialogOpen]);

  // Handle window resize to keep assistant visible
  useEffect(() => {
    const handleResize = () => {
      setPosition(prevPosition => {
        const maxX = window.innerWidth - ASSISTANT_SIZE_PX - ASSISTANT_PADDING_PX;
        const maxY = window.innerHeight - ASSISTANT_SIZE_PX - ASSISTANT_PADDING_PX;

        // Constrain position within new viewport dimensions
        return {
          x: Math.min(Math.max(ASSISTANT_PADDING_PX, prevPosition.x), maxX),
          y: Math.min(Math.max(ASSISTANT_PADDING_PX, prevPosition.y), maxY)
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Available agents configuration - Only show active agents (stable reference)
  const agents = useMemo(() => [
    { name: 'Career Agent', path: '/agents/career', displayName: 'Career' },
    { name: 'Travel Agent', path: '/agents/travel', displayName: 'Travel' },
    { name: 'Body Agent', path: '/agents/body', displayName: 'Body' }
  ], []);
  
  // Function to reset position to bottom right corner
  const resetPosition = useCallback(() => {
    setPosition(getInitialPosition());
  }, [getInitialPosition]);
  
  // Get current agent based on location
  const getCurrentAgent = useCallback(() => {
    const currentPath = location.pathname;
    return agents.find(agent => agent.path === currentPath);
  }, [location.pathname, agents]);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialMousePos = useRef({ x: 0, y: 0 });
  const assistantRef = useRef(null);
  // Cache assistant dimensions to avoid layout thrashing during drag
  const assistantDimensionsRef = useRef({ width: 128, height: 128 });

  const handleMouseDown = (e) => {
    e.preventDefault();
    // Cache dimensions at drag start to avoid reading from DOM on every mousemove
    if (assistantRef.current) {
      assistantDimensionsRef.current = {
        width: assistantRef.current.offsetWidth,
        height: assistantRef.current.offsetHeight
      };
    }
    setIsDragging(true);
    dragStartPos.current = { x: position.x, y: position.y };
    initialMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = useCallback((e) => {
    setIsDragging(false);
    const mouseTravel = Math.sqrt(
      Math.pow(e.clientX - initialMousePos.current.x, 2) +
      Math.pow(e.clientY - initialMousePos.current.y, 2)
    );

    // If mouse moved less than 5px, consider it a click
    if (mouseTravel < 5) {
      if (!hasDialogBeenOpened) {
        setHasDialogBeenOpened(true);
      }
      setIsDialogOpen(true);
    }
  }, [initialMousePos, hasDialogBeenOpened, setIsDialogOpen]);

  // Auto-hide welcome message after 10 seconds
  useEffect(() => {
    if (showWelcome && user?.first_name) {
      const timer = setTimeout(() => {
        setShowWelcome(false);
      }, WELCOME_MESSAGE_TIMEOUT_MS);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [showWelcome, user?.first_name, navState.state]);
  
  // Function to cancel ongoing navigation
  // Uses navStateRef to avoid recreation on every state change
  const cancelNavigation = useCallback(() => {
    if (navStateRef.current.state === NavigationState.COUNTDOWN) {
      dispatchNav({ type: NavigationActions.CANCEL_NAVIGATION });
      dispatchChatEvent('updateCountdown', { message: 'Navigation cancelled. Staying on current page.' });
    }
  }, []);

  // Handle countdown timer - State machine implementation
  useEffect(() => {
    let timer;

    if (navState.state === NavigationState.COUNTDOWN && navState.countdown > 0) {
      // COUNTDOWN state: Tick down every second
      timer = setTimeout(() => {
        dispatchNav({ type: NavigationActions.UPDATE_COUNTDOWN });

        // Send professional countdown update to chat
        if (navState.targetAgent) {
          const newCount = navState.countdown - 1;
          if (newCount > 0) {
            const agentName = navState.targetAgent.name === 'Dashboard'
              ? 'Dashboard'
              : `${navState.targetAgent.displayName} Agent`;
            dispatchChatEvent('updateCountdown', {
              message: `Redirecting to ${agentName} in ${newCount} second${newCount > 1 ? 's' : ''}...`
            });
          }
        }
      }, NAVIGATION_COUNTDOWN_MS);
    } else if (navState.state === NavigationState.NAVIGATING) {
      // NAVIGATING state: Execute navigation and transition to AGENT_WELCOME
      if (navState.targetAgent) {
        navigate(navState.targetAgent.path);

        // Send completion message to chat
        const agentName = navState.targetAgent.name === 'Dashboard'
          ? 'Dashboard'
          : `${navState.targetAgent.displayName} Agent`;
        dispatchChatEvent('updateCountdown', { message: `Successfully redirected to ${agentName}!` });

        // Transition to agent welcome state after navigation
        setTimeout(() => {
          dispatchNav({ type: NavigationActions.EXECUTE_NAVIGATION });
        }, NAVIGATION_DELAY_MS);
      }
    } else if (navState.state === NavigationState.AGENT_WELCOME) {
      // AGENT_WELCOME state: Show welcome, then return to IDLE
      timer = setTimeout(() => {
        dispatchNav({ type: NavigationActions.HIDE_AGENT_WELCOME });
      }, AGENT_WELCOME_DISPLAY_MS);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [navState.state, navState.countdown, navState.targetAgent, navigate]);
  

  
  // Handle agent navigation from chat dialog
  // Uses navStateRef to avoid recreation on every state change
  const handleAgentNavigation = useCallback((agentName, onCountdownMessage) => {
    const currentNavState = navStateRef.current;

    if (agentName === 'None') {
      // Check if already on dashboard
      if (location.pathname === '/dashboard') {
        // Cancel any ongoing navigation and stay on current page
        if (currentNavState.state === NavigationState.COUNTDOWN) {
          dispatchNav({ type: NavigationActions.CANCEL_NAVIGATION });
        }
        if (onCountdownMessage) {
          onCountdownMessage('Already on Dashboard. Staying on current page.');
        }
        return;
      }
      // If there's an ongoing countdown to Dashboard, do nothing
      if (currentNavState.state === NavigationState.COUNTDOWN &&
          currentNavState.targetAgent &&
          currentNavState.targetAgent.name === 'Dashboard') {
        return;
      }
      // Navigate to dashboard
      dispatchNav({
        type: NavigationActions.START_COUNTDOWN,
        payload: { targetAgent: { name: 'Dashboard', path: '/dashboard' } }
      });
      // Send professional countdown message to chat
      if (onCountdownMessage) {
        onCountdownMessage('Redirecting to Dashboard in 3 seconds...');
      }
      return;
    }

    const agent = agents.find(a => a.name === agentName);
    if (!agent) return;

    const currentAgent = getCurrentAgent();

    // If already on the selected agent page, cancel any ongoing navigation
    if (currentAgent && currentAgent.name === agentName) {
      // Cancel any ongoing navigation and stay on current page
      if (currentNavState.state === NavigationState.COUNTDOWN) {
        dispatchNav({ type: NavigationActions.CANCEL_NAVIGATION });
      }
      if (onCountdownMessage) {
        onCountdownMessage(`Already on ${agent.displayName} Agent page. Staying on current page.`);
      }
      return;
    }

    // If there's an ongoing countdown, check if it's for the same agent
    if (currentNavState.state === NavigationState.COUNTDOWN) {
      // If selecting the same agent that's already being navigated to, do nothing
      if (currentNavState.targetAgent && currentNavState.targetAgent.name === agentName) {
        return;
      }
      // Otherwise, cancel current countdown and start new one
      dispatchNav({ type: NavigationActions.CANCEL_NAVIGATION });
      if (onCountdownMessage) {
        onCountdownMessage('Previous navigation cancelled.');
      }
      // Add a small delay before starting new navigation
      setTimeout(() => {
        dispatchNav({
          type: NavigationActions.START_COUNTDOWN,
          payload: { targetAgent: agent }
        });
        if (onCountdownMessage) {
          onCountdownMessage(`Redirecting to ${agent.displayName} Agent in 3 seconds...`);
        }
      }, NAVIGATION_DELAY_MS);
      return;
    }

    // Set target agent and start countdown
    dispatchNav({
      type: NavigationActions.START_COUNTDOWN,
      payload: { targetAgent: agent }
    });
    // Send professional countdown message to chat
    if (onCountdownMessage) {
      onCountdownMessage(`Redirecting to ${agent.displayName} Agent in 3 seconds...`);
    }
  }, [location.pathname, agents, getCurrentAgent]);
  
  // ==================== CUSTOM EVENT SYSTEM ====================
  // Replace window object pollution with custom events
  // This prevents security issues and namespace conflicts
  // Uses navStateRef to avoid listener rebuilds on every state change
  useEffect(() => {
    // Set up event listeners for navigation control
    const unsubscribeResetPosition = subscribeToNavigationEvent('resetPosition', () => {
      resetPosition();
    });

    const unsubscribeNavigate = subscribeToNavigationEvent('navigate', (event) => {
      handleAgentNavigation(event.detail.agentName);
    });

    const unsubscribeCancel = subscribeToNavigationEvent('cancelNavigation', () => {
      cancelNavigation();
    });

    const unsubscribeGetState = subscribeToNavigationEvent('getState', () => {
      // Use ref to get current state without causing listener rebuilds
      dispatchNavigationEvent('stateResponse', {
        isNavigating: navStateRef.current.state === NavigationState.COUNTDOWN,
        targetAgent: navStateRef.current.targetAgent
      });
    });

    // Cleanup all event listeners on unmount
    return () => {
      unsubscribeResetPosition();
      unsubscribeNavigate();
      unsubscribeCancel();
      unsubscribeGetState();
    };
  }, [resetPosition, handleAgentNavigation, cancelNavigation]);

  // ==================== MOUSE EVENT MANAGEMENT ====================
  // Properly manage mouse event listeners to prevent memory leaks
  useEffect(() => {
    if (!isDragging) {
      // Not dragging - no event listeners needed
      return;
    }

    // Define event handlers
    const handleMouseMove = (e) => {
      const dx = e.clientX - initialMousePos.current.x;
      const dy = e.clientY - initialMousePos.current.y;

      let newX = dragStartPos.current.x + dx;
      let newY = dragStartPos.current.y + dy;

      // Constrain movement within the viewport using cached dimensions (avoids layout thrashing)
      const { width, height } = assistantDimensionsRef.current;
      newX = Math.max(0, Math.min(newX, window.innerWidth - width));
      newY = Math.max(0, Math.min(newY, window.innerHeight - height));

      setPosition({ x: newX, y: newY });
    };

    // Add event listeners when dragging starts
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Cleanup: remove event listeners when dragging stops or component unmounts
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseUp]); // Re-run when isDragging or handleMouseUp changes

  // Bubble components are now memoized and defined outside the component

  // SVG for the assistant's avatar
  const AssistantAvatar = () => (
    <div className="relative w-32 h-32 filter drop-shadow-lg animate-float">
      
      <svg
        className="w-full h-full cursor-grab transition-transform hover:scale-110 active:cursor-grabbing"
        viewBox="0 0 150 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        onMouseDown={handleMouseDown}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>

        {/* Main Body */}
        <rect x="25" y="50" width="100" height="80" rx="20" fill="url(#bodyGradient)" />

        {/* Head */}
        <rect x="35" y="20" width="80" height="60" rx="15" fill="#60A5FA" />
        
        {/* Neck */}
        <rect x="60" y="75" width="30" height="10" fill="#2563EB" />

        {/* Eyes */}
        <circle cx="55" cy="45" r="10" fill="white" />
        <circle cx="95" cy="45" r="10" fill="white" />
        <circle cx="55" cy="45" r="5" fill="#1E3A8A" className="animate-pulse" />
        <circle cx="95" cy="45" r="5" fill="#1E3A8A" className="animate-pulse" />

        {/* Smile */}
        <path
          d="M65 65 Q75 75 85 65"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Antenna */}
        <line x1="75" y1="5" x2="75" y2="20" stroke="#60A5FA" strokeWidth="4" />
        <circle cx="75" cy="5" r="5" fill="#93C5FD" className="animate-pulse" />
        
        {/* Arms */}
        <rect x="5" y="70" width="15" height="40" rx="7.5" fill="#60A5FA" />
        <rect x="130" y="70" width="15" height="40" rx="7.5" fill="#60A5FA" />

      </svg>
    </div>
  );

  return (
    <div
      ref={assistantRef}
      className="fixed z-50"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}

    >
      {/* Show welcome bubble on initial load */}
      {showWelcome && user?.first_name && navState.state !== NavigationState.AGENT_WELCOME && (
        <WelcomeBubble user={user} onClose={() => setShowWelcome(false)} />
      )}

      {/* Show notification bubble */}
      {activeNotification && (
        <NotificationBubble
          notification={activeNotification}
          onClose={() => setActiveNotification(null)}
        />
      )}

      {/* Show agent welcome bubble after navigation */}
      {navState.state === NavigationState.AGENT_WELCOME && (
        <AgentWelcomeBubble currentAgent={getCurrentAgent()} onClose={() => dispatchNav({ type: NavigationActions.HIDE_AGENT_WELCOME })} />
      )}
      
      <AssistantAvatar />
      
      {hasDialogBeenOpened && (
        <div style={{ display: isDialogOpen ? 'block' : 'none' }}>
          <ChatDialog
            onClose={() => {
              setIsDialogOpen(false);
              if (onDialogClose) {
                onDialogClose();
              }
            }}
            assistantPosition={position}
            setAssistantPosition={setPosition}
            onUnreadCountChange={onUnreadCountChange}
            onOpenAgentModal={onOpenAgentModal}
            agentType={agentType}
            initialSessionId={initialSessionId}
            onSessionSwitched={onSessionSwitched}
          />
        </div>
      )}
    </div>
  );
};

// ==================== PUBLIC API ====================
// Export functions to replace window object usage
// Usage in other components:
//   import { navigateToAgent, resetAssistantPosition } from './PersonalAssistant';
//   navigateToAgent('career');
export const navigateToAgent = (agentName) => {
  dispatchNavigationEvent('navigate', { agentName });
};

export const cancelAgentNavigation = () => {
  dispatchNavigationEvent('cancelNavigation', {});
};

export const resetAssistantPosition = () => {
  dispatchNavigationEvent('resetPosition', {});
};

// Singleton to prevent duplicate listeners
let pendingStateRequest = null;

export const getAssistantNavigationState = () => {
  if (pendingStateRequest) return pendingStateRequest;

  pendingStateRequest = new Promise((resolve) => {
    let resolved = false;  // Prevent double resolution from race condition
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      document.removeEventListener('assistant:stateResponse', handler);
      pendingStateRequest = null;
    };

    const handler = (event) => {
      if (resolved) return;  // Already resolved by timeout
      resolved = true;
      cleanup();
      resolve(event.detail);
    };

    document.addEventListener('assistant:stateResponse', handler);
    dispatchNavigationEvent('getState', {});

    timeoutId = setTimeout(() => {
      if (resolved) return;  // Already resolved by handler
      resolved = true;
      cleanup();
      resolve(null);
    }, STATE_REQUEST_TIMEOUT_MS);
  });

  return pendingStateRequest;
};

export default PersonalAssistant;