import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { XMarkIcon, PaperAirplaneIcon, PlusIcon, ClockIcon, Cog6ToothIcon, TrashIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { chat, sessions } from '../services/api';

const ChatDialog = ({ onClose, assistantPosition }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogSize, setDialogSize] = useState({ width: 480, height: 600 }); // Increased default size
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');
  const [fontSize, setFontSize] = useState('medium'); // 'small', 'medium', 'large'
  const [showSessions, setShowSessions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionsList, setSessionsList] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userSelectedAgent, setUserSelectedAgent] = useState(false); // Track if user manually selected an agent
  
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
  
  // Get current agent based on location
  const getCurrentAgent = useCallback(() => {
    const currentPath = location.pathname;
    return agents.find(agent => agent.path === currentPath);
  }, [location.pathname, agents]);
  
  // Update selected agent when location changes (only if user hasn't manually selected)
  useEffect(() => {
    if (!userSelectedAgent) {
      const currentAgent = getCurrentAgent();
      if (currentAgent) {
        setSelectedAgent(currentAgent.name);
      } else {
        setSelectedAgent('');
      }
    }
  }, [location.pathname, getCurrentAgent, userSelectedAgent]);
  
  // Add system message to chat
  const addSystemMessage = useCallback((text) => {
    const systemMessage = {
      text: text,
      sender: 'system',
      timestamp: new Date().toISOString(),
      id: Date.now() // Simple ID for system messages
    };
    setMessages(prev => [...prev, systemMessage]);
  }, []);
  
  // Update countdown message (replace the last system message if it's a countdown)
  const updateCountdownMessage = useCallback((text) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      
      // If the last message is a system countdown/navigation message, replace it
      if (lastMessage && lastMessage.sender === 'system' && 
          (lastMessage.text.includes('Redirecting') || 
           lastMessage.text.includes('Successfully redirected') ||
           lastMessage.text.includes('Already on') ||
           lastMessage.text.includes('Navigation cancelled') ||
           lastMessage.text.includes('Previous navigation cancelled'))) {
        newMessages[newMessages.length - 1] = {
          ...lastMessage,
          text: text,
          timestamp: new Date().toISOString()
        };
      } else {
        // Otherwise, add a new system message
        newMessages.push({
          text: text,
          sender: 'system',
          timestamp: new Date().toISOString(),
          id: Date.now()
        });
      }
      
      return newMessages;
    });
  }, []);

  // Handle agent selection in chat
  const handleAgentSelection = (agentName) => {
    // Immediately update selectedAgent to reflect the selection
    if (agentName === 'None') {
      setSelectedAgent('');
      // Reset user selection flag when selecting 'None' to allow auto-detection
      setUserSelectedAgent(false);
    } else {
      setSelectedAgent(agentName);
      // Mark that user has manually selected an agent
      setUserSelectedAgent(true);
    }
    
    // Use the global navigation function from PersonalAssistant
    if (window.handleAgentNavigation) {
      window.handleAgentNavigation(agentName, addSystemMessage);
    } else {
      // Fallback to direct navigation if PersonalAssistant is not available
      if (agentName === 'None') {
        if (location.pathname !== '/dashboard') {
          navigate('/dashboard');
        }
      } else {
        const agent = agents.find(a => a.name === agentName);
        if (agent) {
          const currentAgent = getCurrentAgent();
          if (!currentAgent || currentAgent.name !== agentName) {
            navigate(agent.path);
          }
        }
      }
    }
    
    setShowAgentDropdown(false);
  };

  const messagesEndRef = useRef(null);
  const dialogRef = useRef(null);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  
  // Expose updateCountdownMessage to global window object
  useEffect(() => {
    window.updateCountdownMessage = updateCountdownMessage;
    return () => {
      delete window.updateCountdownMessage;
    };
  }, [updateCountdownMessage]);

  // Track navigation state from PersonalAssistant
  useEffect(() => {
    const checkNavigationState = () => {
      if (window.getNavigationState) {
        const navState = window.getNavigationState();
        setIsNavigating(navState.isNavigating);
      }
    };

    // Check navigation state periodically
    const interval = setInterval(checkNavigationState, 100);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load chat history and active session on component mount
  useEffect(() => {
    const loadChatData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          // Load active session
          const activeSession = await sessions.getActiveSession();
          setCurrentSession(activeSession);
          
          // Load chat history for active session
          const historyData = await chat.getHistory(activeSession?.id);
          const formattedMessages = historyData.messages.map(msg => ({
            text: msg.message_text,
            sender: msg.sender,
            timestamp: msg.created_at,
            id: msg.id
          }));
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error('Failed to load chat data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChatData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save message to database
  const saveMessageToDb = async (messageText, sender) => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // If no current session and this is the first user message, create a new session
        if (!currentSession && sender === 'user') {
          const sessionName = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
          const newSession = await sessions.createSession(sessionName, new Date().toISOString());
          const activeSession = await sessions.getActiveSession();
          setCurrentSession(activeSession);
        }
        
        const savedMessage = await chat.saveMessage(messageText, sender);
        return {
          text: savedMessage.message_text,
          sender: savedMessage.sender,
          timestamp: savedMessage.created_at,
          id: savedMessage.id
        };
      }
    } catch (error) {
      console.error('Failed to save message:', error);
    }
    return null;
  };

  // Create new session
  const handleNewSession = async () => {
    try {
      setMessages([]);
      setCurrentSession(null);
      setShowSessions(false);
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  };

  // Load sessions list
  const loadSessions = async () => {
    try {
      const sessionsData = await sessions.getSessions();
      setSessionsList(sessionsData);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  // Switch to a specific session
  const switchToSession = async (sessionId) => {
    try {
      await sessions.activateSession(sessionId);
      const sessionMessages = await sessions.getSessionMessages(sessionId);
      const formattedMessages = sessionMessages.messages.map(msg => ({
        text: msg.message_text,
        sender: msg.sender,
        timestamp: msg.created_at,
        id: msg.id
      }));
      setMessages(formattedMessages);
      
      // Update current session
      const activeSession = await sessions.getActiveSession();
      setCurrentSession(activeSession);
      setShowSessions(false);
    } catch (error) {
      console.error('Failed to switch session:', error);
    }
  };

  // Show delete confirmation modal
  const showDeleteConfirmation = (sessionId, event) => {
    // Prevent triggering the session switch when clicking delete button
    event.stopPropagation();
    setSessionToDelete(sessionId);
    setShowDeleteConfirm(true);
  };

  // Delete a specific session
  const deleteSession = async () => {
    if (!sessionToDelete) return;

    try {
      await sessions.deleteSession(sessionToDelete);
      
      // If the deleted session is the current active session, clear the chat
      if (currentSession?.id === sessionToDelete) {
        setMessages([]);
        setCurrentSession(null);
      }
      
      // Reload sessions list to reflect the deletion
      await loadSessions();
      
      // Close the confirmation modal
      setShowDeleteConfirm(false);
      setSessionToDelete(null);
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session. Please try again.');
    }
  };

  // Cancel delete operation
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setSessionToDelete(null);
  };

  // Get font size classes
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-sm';
      case 'large': return 'text-lg';
      default: return 'text-base';
    }
  };



  // Handle message submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isNavigating) return;

    const userMessage = input.trim();
    setInput('');

    // Save user message to database and add to UI
    const savedUserMessage = await saveMessageToDb(userMessage, 'user');
    if (savedUserMessage) {
      setMessages(prev => [...prev, savedUserMessage]);
    } else {
      // Fallback to local state if save fails
      setMessages(prev => [...prev, { text: userMessage, sender: 'user', timestamp: new Date().toISOString() }]);
    }

    // TODO: Integrate with backend API for AI response
    // For now, add a mock response
    setTimeout(async () => {
      const assistantResponse = "I'm here to help! What would you like to know?";
      const savedAssistantMessage = await saveMessageToDb(assistantResponse, 'assistant');
      if (savedAssistantMessage) {
        setMessages(prev => [...prev, savedAssistantMessage]);
      } else {
        // Fallback to local state if save fails
        setMessages(prev => [...prev, { text: assistantResponse, sender: 'assistant', timestamp: new Date().toISOString() }]);
      }
    }, 1000);
  };

  // Handle resize functionality
  const handleResizeStart = useCallback((e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { width: dialogSize.width, height: dialogSize.height };
  }, [dialogSize]);

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStartPos.current.x;
    const deltaY = e.clientY - resizeStartPos.current.y;
    let newWidth = resizeStartSize.current.width;
    let newHeight = resizeStartSize.current.height;

    if (resizeDirection.includes('right')) {
      newWidth = Math.max(320, resizeStartSize.current.width + deltaX);
    }
    if (resizeDirection.includes('left')) {
      newWidth = Math.max(320, resizeStartSize.current.width - deltaX);
    }
    if (resizeDirection.includes('bottom')) {
      newHeight = Math.max(400, resizeStartSize.current.height + deltaY);
    }
    if (resizeDirection.includes('top')) {
      newHeight = Math.max(400, resizeStartSize.current.height - deltaY);
    }

    setDialogSize({ width: newWidth, height: newHeight });
  }, [isResizing, resizeDirection]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDirection('');
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const getDialogStyle = () => {
    const style = {
      position: 'absolute',
      width: `${dialogSize.width}px`,
      height: `${dialogSize.height}px`,
      transition: isResizing ? 'none' : 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
      opacity: 0,
      transform: 'scale(0.95)',
    };

    // Position the dialog relative to the assistant
    const assistantX = assistantPosition.x;
    const assistantY = assistantPosition.y;
    const assistantWidth = 128; // w-32 in pixels
    const spacing = 16; // 1rem

    // Default to left of the assistant, aligned at bottom
    style.bottom = '0px';
    style.right = `${assistantWidth + spacing}px`;

    // Adjust if it goes off-screen to the left
    if (assistantX < dialogSize.width + spacing) {
      style.left = `${assistantWidth + spacing}px`;
      style.right = 'auto';
    }

    // Adjust if it goes off-screen to the top
    if (assistantY < dialogSize.height) {
        style.top = '0px';
        style.bottom = 'auto';
    }

    // For the animation
    setTimeout(() => {
        const elem = document.getElementById('chat-dialog');
        if (elem) {
            elem.style.opacity = 1;
            elem.style.transform = 'scale(1)';
        }
    }, 10);

    return style;
  };

  return (
    <div
      id="chat-dialog"
      ref={dialogRef}
      style={getDialogStyle()}
      className="bg-white rounded-lg shadow-xl flex flex-col overflow-hidden relative select-none"
    >
      {/* Resize handles */}
      <div
        className="absolute top-0 right-0 w-3 h-3 cursor-se-resize z-10"
        onMouseDown={(e) => handleResizeStart(e, 'top-right')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-10"
        onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-10"
        onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-10"
        onMouseDown={(e) => handleResizeStart(e, 'top-left')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute top-0 left-3 right-3 h-1 cursor-n-resize z-10"
        onMouseDown={(e) => handleResizeStart(e, 'top')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize z-10"
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize z-10"
        onMouseDown={(e) => handleResizeStart(e, 'left')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute right-0 top-3 bottom-3 w-1 cursor-e-resize z-10"
        onMouseDown={(e) => handleResizeStart(e, 'right')}
        style={{ background: 'transparent' }}
      />
      {/* Header */}
      <div className="p-4 bg-blue-500 text-white">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Personal Assistant</h3>
          <div className="flex items-center space-x-2">
            {/* New Session Button */}
            <button
              onClick={handleNewSession}
              className="p-1 hover:bg-blue-600 rounded-full transition-colors"
              title="New Session"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
            
            {/* History Sessions Button */}
            <button
              onClick={() => {
                setShowSessions(!showSessions);
                if (!showSessions) loadSessions();
              }}
              className="p-1 hover:bg-blue-600 rounded-full transition-colors"
              title="Session History"
            >
              <ClockIcon className="w-5 h-5" />
            </button>
            
            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 hover:bg-blue-600 rounded-full transition-colors"
              title="Settings"
            >
              <Cog6ToothIcon className="w-5 h-5" />
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 hover:bg-blue-600 rounded-full transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        {/* Agent Selection Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAgentDropdown(!showAgentDropdown)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between transition-colors"
          >
            <span>
              {selectedAgent ? 
                `${agents.find(a => a.name === selectedAgent)?.displayName}` : 
                'Select an Agent'
              }
            </span>
            <ChevronDownIcon className="w-4 h-4" />
          </button>
          
          {showAgentDropdown && (
            <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
              <button
                onClick={() => handleAgentSelection('None')}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none focus:bg-gray-100 border-b border-gray-100 text-gray-700"
              >
                <span className="font-medium text-gray-500">None (Dashboard)</span>
              </button>
              {agents.map((agent) => (
                <button
                  key={agent.name}
                  onClick={() => handleAgentSelection(agent.name)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none focus:bg-gray-100 ${
                    selectedAgent === agent.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span className="font-medium">{agent.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Settings</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Font Size
              </label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sessions List Panel */}
      {showSessions && (
        <div className="p-4 border-b border-gray-200 bg-gray-50 max-h-60 overflow-y-auto">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Session History</h4>
          {sessionsList.length === 0 ? (
            <p className="text-xs text-gray-500">No previous sessions</p>
          ) : (
            <div className="space-y-2">
              {sessionsList.map((session) => (
                <div
                  key={session.id}
                  onClick={() => switchToSession(session.id)}
                  className={`p-2 rounded cursor-pointer hover:bg-gray-100 transition-colors relative group ${
                    currentSession?.id === session.id ? 'bg-blue-100 border border-blue-300' : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {session.session_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                       onClick={(e) => showDeleteConfirmation(session.id, e)}
                       className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                       title="Delete Session"
                     >
                       <TrashIcon className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500">Loading chat history...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`flex flex-col ${
                  message.sender === 'system' 
                    ? 'items-center' 
                    : message.sender === 'user' 
                    ? 'items-end' 
                    : 'items-start'
                }`}
              >
                <div
                  className={`${
                    message.sender === 'system'
                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-200 px-4 py-2 rounded-full text-sm font-medium'
                      : `max-w-[80%] p-3 rounded-lg ${
                          message.sender === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`
                  }`}
                >
                  <div className={message.sender === 'system' ? 'text-sm' : getFontSizeClass()}>
                    {message.text}
                  </div>
                </div>
                {message.timestamp && message.sender !== 'system' && (
                  <div className="text-xs text-gray-400 mt-1 px-1">
                    {new Date(message.timestamp).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isNavigating ? "Redirecting to agent..." : "Ask me anything..."}
            disabled={isNavigating}
            className={`flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              isNavigating ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
            }`}
          />
          <button
            type="submit"
            disabled={isNavigating}
            className={`p-2 rounded-lg transition-colors ${
              isNavigating 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <XCircleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Session
                </h3>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete this session? This action cannot be undone and will permanently remove all messages in this conversation.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={deleteSession}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatDialog;