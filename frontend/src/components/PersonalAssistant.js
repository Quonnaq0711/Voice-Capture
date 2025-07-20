import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ChatDialog from './ChatDialog';

const PersonalAssistant = ({ user, isDialogOpen: externalIsDialogOpen, setIsDialogOpen: externalSetIsDialogOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [internalIsDialogOpen, setInternalIsDialogOpen] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isDialogOpen = externalIsDialogOpen !== undefined ? externalIsDialogOpen : internalIsDialogOpen;
  const setIsDialogOpen = externalSetIsDialogOpen || setInternalIsDialogOpen;
  const [showWelcome, setShowWelcome] = useState(true);
  const [position, setPosition] = useState({ x: window.innerWidth - 150, y: window.innerHeight - 150 });
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [targetAgent, setTargetAgent] = useState(null);
  const [showAgentWelcome, setShowAgentWelcome] = useState(false);
  
  // Available agents configuration
  const agents = [
    { name: 'Career Agent', path: '/agents/career', displayName: 'Career' },
    { name: 'Money Agent', path: '/agents/money', displayName: 'Money' },
    { name: 'Mind Agent', path: '/agents/mind', displayName: 'Mind' },
    { name: 'Travel Agent', path: '/agents/travel', displayName: 'Travel' },
    { name: 'Body Agent', path: '/agents/body', displayName: 'Body' },
    { name: 'Family Life Agent', path: '/agents/family-life', displayName: 'Family Life' },
    { name: 'Hobby Agent', path: '/agents/hobby', displayName: 'Hobby' },
    { name: 'Knowledge Agent', path: '/agents/knowledge', displayName: 'Knowledge' },
    { name: 'Personal Development Agent', path: '/agents/personal-dev', displayName: 'Personal Dev' },
    { name: 'Spiritual Agent', path: '/agents/spiritual', displayName: 'Spiritual' }
  ];
  
  // Function to reset position to bottom right corner
  const resetPosition = useCallback(() => {
    setPosition({ x: window.innerWidth - 150, y: window.innerHeight - 150 });
  }, []);
  
  // Get current agent based on location
  const getCurrentAgent = useCallback(() => {
    const currentPath = location.pathname;
    return agents.find(agent => agent.path === currentPath);
  }, [location.pathname, agents]);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialMousePos = useRef({ x: 0, y: 0 });
  const assistantRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
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
      setIsDialogOpen(true);
    }
  }, [initialMousePos]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 10000); // Hide welcome message after 10 seconds

    return () => clearTimeout(timer);
  }, []);
  
  // Function to cancel ongoing navigation
  const cancelNavigation = useCallback(() => {
    if (showCountdown) {
      setShowCountdown(false);
      setCountdown(3);
      setTargetAgent(null);
      if (window.updateCountdownMessage) {
        window.updateCountdownMessage('Navigation cancelled. Staying on current page.');
      }
    }
  }, [showCountdown]);

  // Handle countdown timer
  useEffect(() => {
    let timer;
    if (showCountdown && countdown > 0) {
      timer = setTimeout(() => {
        const newCountdown = countdown - 1;
        setCountdown(newCountdown);
        
        // Send professional countdown update to chat
        if (window.updateCountdownMessage && targetAgent) {
          if (newCountdown > 0) {
            const agentName = targetAgent.name === 'Dashboard' ? 'Dashboard' : `${targetAgent.displayName} Agent`;
            window.updateCountdownMessage(`Redirecting to ${agentName} in ${newCountdown} second${newCountdown > 1 ? 's' : ''}...`);
          }
        }
      }, 1000);
    } else if (showCountdown && countdown === 0) {
      // Navigate to target agent
      if (targetAgent) {
        navigate(targetAgent.path);
        setShowCountdown(false);
        setCountdown(3);
        
        // Don't reset position - keep Personal Assistant visible
        // resetPosition();
        
        // Send completion message to chat
        if (window.updateCountdownMessage) {
          const agentName = targetAgent.name === 'Dashboard' ? 'Dashboard' : `${targetAgent.displayName} Agent`;
          window.updateCountdownMessage(`Successfully redirected to ${agentName}!`);
        }
        
        // Show agent welcome message after navigation
        setTimeout(() => {
          setShowAgentWelcome(true);
          setTimeout(() => {
            setShowAgentWelcome(false);
          }, 5000); // Hide agent welcome after 5 seconds
        }, 500);
      }
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showCountdown, countdown, targetAgent, navigate]);
  

  
  // Handle agent navigation from chat dialog
  const handleAgentNavigation = useCallback((agentName, onCountdownMessage) => {
    if (agentName === 'None') {
      // Check if already on dashboard
      if (location.pathname === '/dashboard') {
        // Cancel any ongoing navigation and stay on current page
        if (showCountdown) {
          setShowCountdown(false);
          setCountdown(3);
          setTargetAgent(null);
        }
        if (onCountdownMessage) {
          onCountdownMessage('Already on Dashboard. Staying on current page.');
        }
        return;
      }
      // If there's an ongoing countdown to Dashboard, do nothing
      if (showCountdown && targetAgent && targetAgent.name === 'Dashboard') {
        return;
      }
      // Navigate to dashboard
      setTargetAgent({ name: 'Dashboard', path: '/dashboard' });
      setShowCountdown(true);
      setCountdown(3);
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
      if (showCountdown) {
        setShowCountdown(false);
        setCountdown(3);
        setTargetAgent(null);
      }
      if (onCountdownMessage) {
        onCountdownMessage(`Already on ${agent.displayName} Agent page. Staying on current page.`);
      }
      return;
    }
    
    // If there's an ongoing countdown, check if it's for the same agent
    if (showCountdown) {
      // If selecting the same agent that's already being navigated to, do nothing
      if (targetAgent && targetAgent.name === agentName) {
        return;
      }
      // Otherwise, cancel current countdown and start new one
      setShowCountdown(false);
      setCountdown(3);
      if (onCountdownMessage) {
        onCountdownMessage('Previous navigation cancelled.');
      }
      // Add a small delay before starting new navigation
      setTimeout(() => {
        setTargetAgent(agent);
        setShowCountdown(true);
        setCountdown(3);
        if (onCountdownMessage) {
          onCountdownMessage(`Redirecting to ${agent.displayName} Agent in 3 seconds...`);
        }
      }, 500);
      return;
    }
    
    // Set target agent and start countdown
    setTargetAgent(agent);
    setShowCountdown(true);
    setCountdown(3);
    // Send professional countdown message to chat
    if (onCountdownMessage) {
      onCountdownMessage(`Redirecting to ${agent.displayName} Agent in 3 seconds...`);
    }
  }, [location.pathname, agents, getCurrentAgent, showCountdown]);
  
  // Expose functions and state to global window object
  useEffect(() => {
    window.resetAssistantPosition = resetPosition;
    window.handleAgentNavigation = handleAgentNavigation;
    window.cancelAgentNavigation = cancelNavigation;
    window.getNavigationState = () => ({ isNavigating: showCountdown, targetAgent });
    return () => {
      delete window.resetAssistantPosition;
      delete window.handleAgentNavigation;
      delete window.cancelAgentNavigation;
      delete window.getNavigationState;
    };
  }, [resetPosition, handleAgentNavigation, cancelNavigation, showCountdown, targetAgent]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - initialMousePos.current.x;
        const dy = e.clientY - initialMousePos.current.y;
        
        let newX = dragStartPos.current.x + dx;
        let newY = dragStartPos.current.y + dy;
  
        // Constrain movement within the viewport
        if (assistantRef.current) {
          const assistantWidth = assistantRef.current.offsetWidth;
          const assistantHeight = assistantRef.current.offsetHeight;
          
          if (newX < 0) newX = 0;
          if (newY < 0) newY = 0;
          if (newX + assistantWidth > window.innerWidth) newX = window.innerWidth - assistantWidth;
          if (newY + assistantHeight > window.innerHeight) newY = window.innerHeight - assistantHeight;
        }
  
        setPosition({ x: newX, y: newY });
      }
    };

    // Add listeners only when dragging
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    // Cleanup function
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseUp]);

  const WelcomeBubble = ({ user }) => (
    <div className="absolute bottom-full mb-2 w-64 bg-white p-4 rounded-lg shadow-lg right-0 transform transition-all duration-300 ease-in-out origin-bottom-right scale-100">
      <h3 className="text-lg font-bold text-gray-800">Welcome, {user?.username || 'User'}!</h3>
      <p className="text-sm text-gray-600 mt-1">Your personal AI assistant for a better life. What can I help you with today?</p>
      <div className="absolute right-4 -bottom-2 w-4 h-4 bg-white transform rotate-45"></div>
    </div>
  );
  

  
  // Agent welcome bubble component
  const AgentWelcomeBubble = () => {
    const currentAgent = getCurrentAgent();
    if (!currentAgent) return null;
    
    return (
      <div className="absolute bottom-full mb-2 w-64 bg-green-500 text-white p-4 rounded-lg shadow-lg right-0 transform transition-all duration-300 ease-in-out origin-bottom-right scale-100">
        <h3 className="text-lg font-bold">Welcome to {currentAgent.displayName}!</h3>
        <p className="text-sm mt-1">Your {currentAgent.displayName} agent is ready to assist you.</p>
        <div className="absolute right-4 -bottom-2 w-4 h-4 bg-green-500 transform rotate-45"></div>
      </div>
    );
  };

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
      {showWelcome && user?.username && !showAgentWelcome && (
        <WelcomeBubble user={user} />
      )}
      
      {/* Show agent welcome bubble after navigation */}
      {showAgentWelcome && (
        <AgentWelcomeBubble />
      )}
      
      <AssistantAvatar />
      
      {isDialogOpen && (
        <ChatDialog 
          onClose={() => setIsDialogOpen(false)} 
          assistantPosition={position} 
          setAssistantPosition={setPosition} 
        />
      )}
    </div>
  );
};

export default PersonalAssistant;