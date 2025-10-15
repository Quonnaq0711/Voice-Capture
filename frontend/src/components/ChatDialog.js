import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { XMarkIcon, PaperAirplaneIcon, PlusIcon, ClockIcon, Cog6ToothIcon, TrashIcon, ChevronDownIcon, DocumentDuplicateIcon, PencilIcon, StopIcon, CheckIcon, SparklesIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { chat, sessions, profile as profileAPI, activities as activitiesAPI } from '../services/api';
import { sendMessage as defaultSendMessage, sendMessageStream as defaultSendMessageStream, checkHealth, clearMemory, generateSessionId, handleApiError, removeMessagesAfterIndex, updateMessageAtIndex } from '../services/chatApi';
import MessageRenderer from './MessageRenderer';

const ChatDialog = ({ onClose, assistantPosition, setAssistantPosition, onUnreadCountChange }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getApiUrls = useCallback(() => {
    // Map agent paths to their respective API URLs
    // In production, use relative paths (proxied through Nginx)
    // In development, use localhost URLs for direct connection
    const isProduction = process.env.NODE_ENV === 'production';

    const agentApiMap = {
      '/agents/career': isProduction ? '/api/career' : 'http://localhost:6002/api/chat',
      '/agents/money': isProduction ? '/api/money' : 'http://localhost:8003/api/chat',
      '/agents/mind': isProduction ? '/api/mind' : 'http://localhost:8004/api/chat',
      '/agents/travel': isProduction ? '/api/travel' : 'http://localhost:8005/api/chat',
      '/agents/body': isProduction ? '/api/body' : 'http://localhost:8006/api/chat',
      '/agents/family-life': isProduction ? '/api/family-life' : 'http://localhost:8007/api/chat',
      '/agents/hobby': isProduction ? '/api/hobby' : 'http://localhost:8008/api/chat',
      '/agents/knowledge': isProduction ? '/api/knowledge' : 'http://localhost:8009/api/chat',
      '/agents/personal-dev': isProduction ? '/api/personal-dev' : 'http://localhost:8010/api/chat',
      '/agents/spiritual': isProduction ? '/api/spiritual' : 'http://localhost:8011/api/chat'
    };

    // Find matching agent API URL
    for (const [path, baseUrl] of Object.entries(agentApiMap)) {
      if (location.pathname.startsWith(path)) {
        return {
          messageUrl: `${baseUrl}/message`,
          streamUrl: `${baseUrl}/message/stream`,
        };
      }
    }

    // For dashboard and other pages, use default (personal assistant)
    return {
      messageUrl: null, // Will use default from chatApi.js
      streamUrl: null,  // Will use default from chatApi.js
    };
  }, [location.pathname]);

  const { messageUrl, streamUrl } = getApiUrls();

  const sendMessage = (message, sessionId, signal) => {
    return defaultSendMessage(message, sessionId, signal, messageUrl);
  };

  const sendMessageStream = (message, sessionId, userId, onToken, onComplete, onError, streamApiUrl) => {
    return defaultSendMessageStream(message, sessionId, userId, onToken, onComplete, onError, streamApiUrl || streamUrl);
  };
  const [messages, setMessages] = useState([]);
  // Track which message indices have been copied to show feedback
  const [copiedMessageIds, setCopiedMessageIds] = useState(new Set());
  const [input, setInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialDialogPos = useRef({ x: 0, y: 0 });
  const [userHasScrolled, setUserHasScrolled] = useState(false);
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
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [apiStatus, setApiStatus] = useState('unknown'); // 'healthy', 'unhealthy', 'unknown'
  const [chatSessionId, setChatSessionId] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [generatingSessions, setGeneratingSessions] = useState(new Set()); // Track sessions generating responses
  const [userId, setUserId] = useState(null);
  const [followUpQuestions, setFollowUpQuestions] = useState({}); // Store follow-up questions by message ID
  const currentSessionRef = useRef(currentSession);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  // Fetch user ID once on mount
  useEffect(() => {
    profileAPI.getCurrentUser()
      .then(data => {
        if (data && data.id) setUserId(data.id);
      })
      .catch(err => console.error('Failed to fetch user ID', err));
  }, []);

  useEffect(() => {
    const isCurrentSessionGenerating = generatingSessions.has(currentSession?.id);
    setIsLoading(isCurrentSessionGenerating);
  }, [currentSession, generatingSessions]);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editInput, setEditInput] = useState('');
  
  // Optimize input states
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [originalInput, setOriginalInput] = useState('');
  const [isOptimized, setIsOptimized] = useState(false);
  const [sessionHistoryHeight, setSessionHistoryHeight] = useState(240); // Default height for session history
  const [isResizingSessions, setIsResizingSessions] = useState(false);
  const [eventSource, setEventSource] = useState(null); // Track EventSource for streaming responses
  const eventSourceRef = useRef(null); // Latest EventSource reference to avoid closure loss
  const cancelPendingRef = useRef(false); // Track whether a cancel request has been initiated
  const [unreadSessions, setUnreadSessions] = useState(new Set()); // Track sessions with unread messages, now synced with backend
  // Sync local chatSessionId with currentSession.id
  useEffect(() => {
    if (currentSession?.id && chatSessionId !== currentSession.id) {
       localStorage.setItem('chatSessionId', currentSession.id);
       setChatSessionId(currentSession.id);
     }
  }, [currentSession]);
  
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
      timestamp: new Date().getTime(),
      id: Date.now() // Simple ID for system messages
    };
    setMessages(prev => [...prev, systemMessage]);
  }, []);

  // Track chat activity
  const trackChatActivity = useCallback(async (messageText, sessionId, messageId) => {
    try {
      const currentPath = location.pathname;
      let activitySource = 'dashboard'; // default
      let sourceContext = 'dashboard';

      // Determine source based on current location
      if (currentPath === '/dashboard') {
        activitySource = 'dashboard';
        sourceContext = 'dashboard';
      } else if (currentPath === '/agents/career') {
        activitySource = 'career';
        sourceContext = 'career_agent';
      } else if (currentPath.startsWith('/agents/')) {
        const agentName = currentPath.split('/').pop();
        activitySource = agentName;
        sourceContext = `${agentName}_agent`;
      }

      // Create activity with more specific information
      await activitiesAPI.createActivity({
        activity_type: 'chat',
        activity_source: activitySource,
        activity_title: `Chat Message - ${sourceContext}`,
        activity_description: `Sent message to Personal Assistant from ${sourceContext}`,
        activity_metadata: {
          agent_type: 'personal_assistant',
          source_context: sourceContext,
          message_preview: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
          session_id: sessionId,
          message_id: messageId
        }
      });
    } catch (error) {
      console.warn('Failed to track chat activity:', error);
    }
  }, [location.pathname]);

  // Track edit chat activity
  const trackEditChatActivity = useCallback(async (messageText, sessionId, messageId) => {
    try {
      const currentPath = location.pathname;
      let activitySource = 'dashboard'; // default
      let sourceContext = 'dashboard';

      // Determine source based on current location
      if (currentPath === '/dashboard') {
        activitySource = 'dashboard';
        sourceContext = 'dashboard';
      } else if (currentPath === '/agents/career') {
        activitySource = 'career';
        sourceContext = 'career_agent';
      } else if (currentPath.startsWith('/agents/')) {
        const agentName = currentPath.split('/').pop();
        activitySource = agentName;
        sourceContext = `${agentName}_agent`;
      }

      // Create activity with edit-specific information
      await activitiesAPI.createActivity({
        activity_type: 'chat',
        activity_source: activitySource,
        activity_title: `Chat Message Edit - ${sourceContext}`,
        activity_description: `Edited message to Personal Assistant from ${sourceContext}`,
        activity_metadata: {
          agent_type: 'personal_assistant',
          source_context: sourceContext,
          message_preview: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
          session_id: sessionId,
          message_id: messageId,
          action_type: 'edit'
        }
      });
    } catch (error) {
      console.warn('Failed to track edit chat activity:', error);
    }
  }, [location.pathname]);

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
          timestamp: new Date().getTime()
        };
      } else {
        // Otherwise, add a new system message
        newMessages.push({
          text: text,
          sender: 'system',
          timestamp: new Date().getTime(),
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
  const messageContainerRef = useRef(null);
  const dialogRef = useRef(null);
  const textareaRef = useRef(null);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  
  // Add progress message to chat (for career analysis progress)
  const addProgressMessage = useCallback(async (text, type = 'progress') => {
    // Detect current agent context from URL or page state
    const currentPath = window.location.pathname;
    const isCareerAgent = currentPath.includes('/career') || document.querySelector('[data-agent-type="career"]');
    
    // Save progress message to database if we have a current session
    let savedMessage = null;
    if (currentSession?.id) {
      try {
        const agentType = isCareerAgent ? 'career' : 'dashboard';
        const dbMessage = await chat.saveMessage(text, 'assistant', currentSession.id, agentType);
        savedMessage = {
          text: dbMessage.message_text,
          sender: dbMessage.sender,
          timestamp: dbMessage.created_at,
          id: dbMessage.id,
          messageType: type,
          agent_type: dbMessage.agent_type || agentType
        };
      } catch (error) {
        console.error('Failed to save progress message to database:', error);
      }
    }
    
    // Use saved message if available, otherwise create local message
    const progressMessage = savedMessage || {
      text: text,
      sender: 'assistant',
      timestamp: new Date().getTime(),
      id: Date.now(),
      messageType: type,
      agent_type: isCareerAgent ? 'career' : 'dashboard'
    };
    
    setMessages(prev => [...prev, progressMessage]);
  }, [currentSession, chat]);

  // Update progress message (replace the last progress message if it exists)
  const updateProgressMessage = useCallback((text, type = 'progress') => {
    // Detect current agent context from URL or page state
    const currentPath = window.location.pathname;
    const isCareerAgent = currentPath.includes('/career') || document.querySelector('[data-agent-type="career"]');
    
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      
      // If the last message is a progress message, replace it
      if (lastMessage && lastMessage.sender === 'assistant' && 
          lastMessage.messageType && 
          ['progress', 'section_start'].includes(lastMessage.messageType)) {
        newMessages[newMessages.length - 1] = {
          ...lastMessage,
          text: text,
          messageType: type,
          timestamp: new Date().getTime(),
          agent_type: isCareerAgent ? 'career' : 'dashboard' // Set correct agent type based on context
        };
      } else {
        // Otherwise, add a new progress message
        newMessages.push({
          text: text,
          sender: 'assistant',
          timestamp: new Date().getTime(),
          id: Date.now(),
          messageType: type,
          agent_type: isCareerAgent ? 'career' : 'dashboard' // Set correct agent type based on context
        });
      }
      
      return newMessages;
    });
  }, []);

  // Expose progress functions and updateCountdownMessage to global window object
  useEffect(() => {
    window.updateCountdownMessage = updateCountdownMessage;
    window.addProgressMessage = addProgressMessage;
    window.updateProgressMessage = updateProgressMessage;
    return () => {
      delete window.updateCountdownMessage;
      delete window.addProgressMessage;
      delete window.updateProgressMessage;
    };
  }, [updateCountdownMessage, addProgressMessage, updateProgressMessage]);

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

  // Listen for career analysis progress events
  useEffect(() => {
    // Event handler for analysis progress
    const handleAnalysisProgress = async (event) => {
      const { section, status, progress, totalSections } = event.detail;
      console.log('ChatDialog: Analysis progress update:', { section, status, progress });
      
      if (status === 'starting') {
        // Set loading state when analysis starts
        setIsLoading(true);
        setIsCancelling(false);
        
        const sectionName = section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const currentSectionNumber = progress ? Math.ceil(progress / (100 / totalSections)) : 1;
        
        await addProgressMessage(
          `🚀 Starting ${sectionName} analysis... (Section ${currentSectionNumber} of ${totalSections})`,
          'section_start'
        );
      } else if (status === 'analyzing') {
        const sectionName = section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const progressPercentage = progress || 0;
        const currentSectionNumber = progress ? Math.ceil(progress / (100 / totalSections)) : 1;
        
        updateProgressMessage(
          `🔍 Analyzing ${sectionName}... (${progressPercentage}% complete - Section ${currentSectionNumber} of ${totalSections})`,
          'section_progress'
        );
      }
    };

    // Event handler for section start
    const handleSectionStart = async (event) => {
      const { section, display_name, description, progress } = event.detail;
      console.log('ChatDialog: Section started:', { section, display_name, description, progress });
      
      // Set loading state when section starts
      setIsLoading(true);
      setIsCancelling(false);
      
      const sectionName = display_name || section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      await addProgressMessage(
        `🔄 Starting ${sectionName} analysis...`,
        'section_start'
      );
    };

    // Event handler for section completion
    const handleSectionComplete = async (event) => {
      const { section, data, error } = event.detail;
      console.log('ChatDialog: Section completed:', { section, hasData: !!data, error });
      
      if (error) {
        await addProgressMessage(
          `❌ Error analyzing ${section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${error}`,
          'section_complete'
        );
        return;
      }

      if (data) {
        const sectionName = section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        await addProgressMessage(
          `✅ ${sectionName} analysis completed successfully! New insights are now available in your career profile.`,
          'section_complete'
        );
      }
    };

    // Event handler for analysis completion
    const handleAnalysisComplete = async (event) => {
      const { success, error } = event.detail;
      console.log('ChatDialog: Analysis workflow completed:', { success, error });
      
      // Clear loading state when analysis completes
      setIsLoading(false);
      setIsCancelling(false);
      
      if (success) {
        await addProgressMessage(
          `🎉 Your comprehensive career analysis is now complete! All sections have been analyzed successfully. You can explore your insights to discover new opportunities and career guidance.`,
          'analysis_complete'
        );
      } else if (error) {
        await addProgressMessage(
          `❌ Analysis failed: ${error}. Please try again or contact support if the issue persists.`,
          'analysis_complete'
        );
      }
    };
    
    // Add event listeners to the document (global events)
    const element = document.querySelector('[data-agent-type="career"]') || document;
    if (element) {
      element.addEventListener('analysisProgress', handleAnalysisProgress);
      element.addEventListener('sectionStart', handleSectionStart);
      element.addEventListener('sectionComplete', handleSectionComplete);
      element.addEventListener('analysisComplete', handleAnalysisComplete);
    }
    
    // Clean up event listeners on component unmount
    return () => {
      if (element) {
        element.removeEventListener('analysisProgress', handleAnalysisProgress);
        element.removeEventListener('sectionStart', handleSectionStart);
        element.removeEventListener('sectionComplete', handleSectionComplete);
        element.removeEventListener('analysisComplete', handleAnalysisComplete);
      }
    };
  }, [addProgressMessage, updateProgressMessage]);

  // Check API health on component mount and when location changes
  useEffect(() => {
    checkApiHealth();
    
    // Set up periodic health checks every 30 seconds
    const healthCheckInterval = setInterval(() => {
      checkApiHealth();
    }, 30000); // 30 seconds
    
    // Cleanup interval on unmount
    return () => {
      clearInterval(healthCheckInterval);
    };
  }, []);
  
  // Re-check API health when location changes (switching between dashboard and agents)
  useEffect(() => {
    checkApiHealth();
  }, [location.pathname]);

  // Generate or restore chat session ID when component mounts
  useEffect(() => {
    if (!chatSessionId) {
      // Try to get existing session ID from localStorage or current session
      let sessionId = localStorage.getItem('chatSessionId');
      
      // If no stored session ID, generate a new one
      if (!sessionId) {
        sessionId = generateSessionId();
        localStorage.setItem('chatSessionId', sessionId);
      }
      
      localStorage.setItem('chatSessionId', sessionId);
       setChatSessionId(sessionId);
    }
  }, [chatSessionId]);

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = (force = false) => {
    if (force || !userHasScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
            id: msg.id,
            agent_type: msg.agent_type || 'dashboard'
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
    // Only auto-scroll if the user hasn't scrolled up
    if (!userHasScrolled) {
      scrollToBottom();
    }
  }, [messages]);

  // Cleanup function to prevent memory leaks when component unmounts
  useEffect(() => {
    return () => {
      // Clean up EventSource
      if (eventSource) {
        eventSource.close();
      }
      
      // Clean up AbortController
      if (abortController) {
        abortController.abort();
      }
      
      // Clear any generating sessions
      setGeneratingSessions(new Set());
      
      // Clean up global window functions
      if (window.updateCountdownMessage) {
        delete window.updateCountdownMessage;
      }
      
      // Clear any pending timeouts or intervals that might be running
      // Note: The navigation state interval is already cleaned up in its own useEffect
    };
  }, [eventSource, abortController]);

  // Determine agent type based on current path
  const getAgentType = useCallback(() => {
    const agent = agents.find(a => location.pathname.startsWith(a.path));
    if (agent) {
      return agent.path.substring('/agents/'.length);
    }
    return 'dashboard';
  }, [location.pathname, agents]);

  // Save message to database
  const saveMessageToDb = async (messageText, sender) => {
    try {
      let sessionToUse = currentSession;
      let newSessionCreated = false;
      const agentType = getAgentType();
      
      // If no current session and this is the first user message, create a new session
      if (!sessionToUse && sender === 'user') {
        const sessionName = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
        await sessions.createSession(sessionName, new Date().getTime());
        const activeSession = await sessions.getActiveSession();
        setCurrentSession(activeSession);
        sessionToUse = activeSession;
        newSessionCreated = true;
      }
      
      // Only call saveMessage if we have a valid session
      if (sessionToUse?.id) {
        const savedMessage = await chat.saveMessage(messageText, sender, sessionToUse.id, agentType);
        const messageData = {
          text: savedMessage.message_text,
          sender: savedMessage.sender,
          timestamp: savedMessage.created_at,
          id: savedMessage.id,
          agent_type: savedMessage.agent_type || agentType
        };
        return { message: messageData, newSession: newSessionCreated ? sessionToUse : null };
      } else {
        console.warn('No valid session available for saving message');
        return { message: null, newSession: null };
      }
    } catch (error) {
      console.error('Failed to save message:', error);
      return { message: null, newSession: null };
    }
  };

  // Check API health
  const checkApiHealth = async () => {
    try {
      // Determine which API to check based on current location
      let apiUrl = null;

      // Map agent paths to their respective API URLs
      // In production, use relative paths (proxied through Nginx)
      // In development, use localhost URLs for direct connection
      const isProduction = process.env.NODE_ENV === 'production';

      const agentApiMap = {
        '/agents/career': isProduction ? '/api/career' : 'http://localhost:6002/api/chat',
        '/agents/money': isProduction ? '/api/money' : 'http://localhost:8003/api/chat',
        '/agents/mind': isProduction ? '/api/mind' : 'http://localhost:8004/api/chat',
        '/agents/travel': isProduction ? '/api/travel' : 'http://localhost:8005/api/chat',
        '/agents/body': isProduction ? '/api/body' : 'http://localhost:8006/api/chat',
        '/agents/family-life': isProduction ? '/api/family-life' : 'http://localhost:8007/api/chat',
        '/agents/hobby': isProduction ? '/api/hobby' : 'http://localhost:8008/api/chat',
        '/agents/knowledge': isProduction ? '/api/knowledge' : 'http://localhost:8009/api/chat',
        '/agents/personal-dev': isProduction ? '/api/personal-dev' : 'http://localhost:8010/api/chat',
        '/agents/spiritual': isProduction ? '/api/spiritual' : 'http://localhost:8011/api/chat'
      };

      // Find matching agent API URL
      for (const [path, url] of Object.entries(agentApiMap)) {
        if (location.pathname.startsWith(path)) {
          apiUrl = url;
          break;
        }
      }

      // For dashboard and other pages, use default (personal assistant)
      const health = await checkHealth(apiUrl);
      setApiStatus(health.status === 'healthy' ? 'healthy' : 'unhealthy');
    } catch (error) {
      setApiStatus('unhealthy');
    }
  };

  // Copy message to clipboard function
  const copyToClipboard = async (text, msgIndex) => {
    try {
      await navigator.clipboard.writeText(text);
      // Record the message index after successful copy to trigger button animation
      setCopiedMessageIds(prev => new Set([...prev, msgIndex]));
      // Reset button state after 1.5 seconds
      setTimeout(() => {
        setCopiedMessageIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(msgIndex);
          return newSet;
        });
      }, 1500);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('Message copied to clipboard (fallback)');
      } catch (fallbackError) {
        console.error('Failed to copy message:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  };

  // Edit message functions
  const startEditMessage = (index, messageText) => {
    setEditingMessageIndex(index);
    setEditInput(messageText);
  };

  const cancelEditMessage = () => {
    setEditingMessageIndex(null);
    setEditInput('');
  };
  
  // Optimize input functions
  const optimizeInput = async () => {
    if (!input.trim() || isOptimizing) return;
    
    setIsOptimizing(true);
    setOriginalInput(input); // Store original input for revert functionality
    
    try {
      const data = await chat.optimizeQuery(input.trim());
      
      if (data.status === 'success' && data.optimized_query) {
        setInput(data.optimized_query);
        setIsOptimized(true);
      } else {
        console.error('Failed to optimize query:', data.error || 'Unknown error');
        // Show error message to user (you might want to add a toast notification here)
      }
    } catch (error) {
      console.error('Error optimizing input:', error);
      // Show error message to user (you might want to add a toast notification here)
    } finally {
      setIsOptimizing(false);
    }
  };
  
  const revertOptimization = () => {
    if (isOptimized && originalInput) {
      setInput(originalInput);
      setIsOptimized(false);
      setOriginalInput('');
    }
  };
  
  // Auto-resize textarea function
  const autoResizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, []);

  // Auto-resize textarea when input changes
  useEffect(() => {
    autoResizeTextarea();
  }, [input, autoResizeTextarea]);

  // Reset optimization state when input changes manually
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInput(newValue);
    
    // If user manually changes the input after optimization, reset optimization state
    if (isOptimized && newValue !== input) {
      setIsOptimized(false);
      setOriginalInput('');
    }
  };

  // Function to handle keyboard shortcuts in edit mode
  const handleEditKeyPress = (e, messageIndex) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      submitEditedMessage(messageIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditMessage();
    }
  };

  const submitEditedMessage = async (index) => {
    if (!editInput.trim()) return;

    const currentSessionAtSendTime = currentSession;
    const currentChatSessionIdAtSendTime = chatSessionId;
    
    // Add current session to generating sessions
    if (currentSessionAtSendTime?.id) {
      setGeneratingSessions(prev => new Set([...prev, currentSessionAtSendTime.id]));
    }

    try {
      
      // Get the message to be edited
      const messageToEdit = messages[index];
      
      // Sync with personal assistant backend: Remove all messages after the edited message index
      try {
        await removeMessagesAfterIndex(index, chatSessionId);
      } catch (backendError) {
        console.warn('Failed to sync message removal with personal assistant backend:', backendError);
      }
      
      // Sync with personal assistant backend: Update the message at the current index
      try {
        await updateMessageAtIndex(index, editInput.trim(), chatSessionId);
      } catch (backendError) {
        console.warn('Failed to sync message update with personal assistant backend:', backendError);
      }
      
      // Sync with database: Update the message in database if it has an ID
      if (messageToEdit.id) {
        try {
          await chat.updateMessage(messageToEdit.id, editInput.trim());
        } catch (dbError) {
          console.warn('Failed to update message in database:', dbError);
        }
      }
      
      // Sync with database: Delete messages after the edited message index
      try {
        await chat.deleteMessagesAfterIndex(index);
      } catch (dbError) {
        console.warn('Failed to delete messages after index in database:', dbError);
      }
      
      // Update session name if editing the first user message
      if (index === 0 && messageToEdit.sender === 'user' && currentSession) {
        try {
          const newSessionName = editInput.trim().length > 50 ? 
            editInput.trim().substring(0, 50) + '...' : 
            editInput.trim();
          await sessions.updateSessionName(currentSession.id, newSessionName);
          
          // Update local session state
          setCurrentSession(prev => ({
            ...prev,
            session_name: newSessionName
          }));
        } catch (sessionError) {
          console.warn('Failed to update session name:', sessionError);
        }
      }
      
      // Remove all messages after the edited message (including the edited message's response)
      const newMessages = messages.slice(0, index);
      
      // Update the edited message
      const editedMessage = {
        ...messages[index],
        text: editInput.trim(),
        timestamp: new Date().getTime()
      };
      
      newMessages.push(editedMessage);
      setMessages(newMessages);
      
      // Track edit activity after message is updated
      if (currentSessionAtSendTime?.id) {
        trackEditChatActivity(editInput.trim(), currentSessionAtSendTime.id, editedMessage.id);
      }

      // Clear edit state
      setEditingMessageIndex(null);
      setEditInput('');

      // Create new AbortController for the edit request
      const editController = new AbortController();
      setAbortController(editController);
      
      // Set loading state for the new request
      if (currentSessionAtSendTime?.id) {
        setGeneratingSessions(prev => new Set([...prev, currentSessionAtSendTime.id]));
      }
      setIsLoading(true);
      setIsCancelling(false);
      
      // Send the edited message to get a new response using streaming
      const currentPath = location.pathname;
      const agentType = currentPath.startsWith('/agents/career') ? 'career' : 'personal_assistant';

      // Add a placeholder message for the AI response
      const placeholderMessage = {
        id: Date.now() + 1,
        text: '',
        sender: 'assistant',
        timestamp: new Date().getTime(),
        isStreaming: true,
        agent_type: agentType,
      };
      
      setMessages(prev => [...prev, placeholderMessage]);
      
      let streamingResponse = '';
      // Use streaming response for edited messages
      const eventSource = sendMessageStream(
        editInput.trim(),
        currentSessionAtSendTime?.id,
        userId,
        // onToken callback - update the streaming message
        async (token, options = {}) => {
          streamingResponse += token;
          
          // If this is the initial message, save it to database immediately
          if (options.isInitialMessage) {
            const sessionToSaveIn = currentSessionAtSendTime;
            if (sessionToSaveIn?.id) {
              try {
                await chat.saveMessage(token, 'assistant', sessionToSaveIn.id, getAgentType());
                console.log('Initial message saved to database:', token);
              } catch (error) {
                console.error('Failed to save initial message to database:', error);
              }
            }
          }
          
          setMessages(prev => {
            const streamingMessageId = placeholderMessage.id;

            // Ensure we are still in the originating session before updating UI
            if (currentSessionRef.current?.id !== currentSessionAtSendTime?.id || chatSessionId !== currentChatSessionIdAtSendTime) {
              return prev; // Ignore tokens for other sessions
            }

            // Find the assistant message to update
            const newMessages = [...prev];
            let assistantIdx = newMessages.findIndex(m => m.sender === 'assistant' && (m.isStreaming || m.id === streamingMessageId));

            if (assistantIdx === -1) {
              // No assistant message exists, create one.
              newMessages.push({
                id: streamingMessageId,
                text: streamingResponse,
                sender: 'assistant',
                timestamp: new Date().getTime(),
                isStreaming: !options.isInitialMessage // Don't show cursor for initial message
              });
              assistantIdx = newMessages.length - 1;
            } else {
              // Assistant message found, update it.
              const currentMessage = newMessages[assistantIdx];
              newMessages[assistantIdx] = {
                ...currentMessage,
                text: streamingResponse,
                id: streamingMessageId, // Claim the message with the correct ID
                isStreaming: options.isInitialMessage ? false : true // Show cursor for subsequent tokens
              };
            }

            return newMessages;
          });
        },
        // onComplete callback - finalize the message
        async (fullResponse, professionalData, followUpQuestionsData) => {
          // Remove session from generating sessions on completion
          if (currentSessionAtSendTime?.id) {
            setGeneratingSessions(prev => {
              const newSet = new Set(prev);
              newSet.delete(currentSessionAtSendTime.id);
              return newSet;
            });
          }

          if (currentSessionRef.current?.id === currentSessionAtSendTime?.id && chatSessionId === currentChatSessionIdAtSendTime) {
            // Save the complete response to database
            const saveResult = await saveMessageToDb(fullResponse, 'assistant');
            
            const assistantMessage = saveResult.message || {
              id: Date.now() + 1,
              text: fullResponse,
              sender: 'assistant',
              timestamp: new Date().getTime()
            };
            
            // Update the placeholder message with the final response
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.sender === 'assistant' && lastMessage.isStreaming) {
                  Object.assign(lastMessage, { ...assistantMessage, id: lastMessage.id }); // Preserve streaming ID
                  delete lastMessage.isStreaming;
                }
                return newMessages;
              });
  
              // Handle follow-up questions if provided
              if (followUpQuestionsData && Array.isArray(followUpQuestionsData) && followUpQuestionsData.length > 0) {
                const messageId = placeholderMessage.id;
                setFollowUpQuestions(prev => ({
                  ...prev,
                  [messageId]: followUpQuestionsData
                }));
              }

          } else {
            // User switched sessions, save response to the original session's database
            console.log('User switched sessions during response generation for edited message. Response saved to database but not displayed.');
            if (currentSessionAtSendTime?.id) {
              await chat.saveMessage(fullResponse, 'assistant', currentSessionAtSendTime.id, getAgentType());
              // Mark session as unread by calling the backend
              try {
                await sessions.markSessionAsUnread(currentSessionAtSendTime.id); // This function needs to be created in api.js
                setUnreadSessions(prev => new Set(prev).add(currentSessionAtSendTime.id));
                // Trigger unread count update immediately
                if (onUnreadCountChange) {
                  onUnreadCountChange();
                }
              } catch (error) {
                console.error('Failed to mark session as unread:', error);
              }
            }
          }
        },
        // onError callback - handle errors
        async (error) => {
          console.error('Streaming error during edit:', error);
          // Handle streaming errors
          const errorMessage = {
            id: Date.now() + 1,
            text: `Error: ${error}`,
            sender: 'system',
            timestamp: new Date().toISOString()
          };
          
          if (currentSessionRef.current?.id === currentSessionAtSendTime?.id) {
            setMessages(prev => {
              const newMessages = [...prev];
              // Remove the placeholder message and add error message
              if (newMessages[newMessages.length - 1]?.isStreaming) {
                newMessages[newMessages.length - 1] = errorMessage;
              } else {
                newMessages.push(errorMessage);
              }
              return newMessages;
            });
          }
        }
      );
      
      setEventSource(eventSource);
      eventSourceRef.current = eventSource;
      // If a cancellation was requested before EventSource became available
      if (cancelPendingRef.current) {
        eventSource.close();
        eventSourceRef.current = null;
        setEventSource(null);
      eventSourceRef.current = null;
        return; // Do not proceed with streaming callbacks
      }

      // Streaming response handling is done in the callbacks above
    } catch (error) {
      console.error('Error editing message:', error);
      
      // Check if the error is due to cancellation
      if (error.message === 'Request cancelled' || error.name === 'AbortError') {
        console.log('Edit request was cancelled by user');
        // Don't show error message for cancelled requests, but continue to finally block
      } else {
      
        const errorMessage = handleApiError(error);
        
        const errorResponse = {
          id: Date.now() + 1,
          text: `Error: ${errorMessage}`,
          sender: 'system',
          timestamp: new Date().toISOString()
        };
        
        if (currentSessionRef.current?.id === currentSessionAtSendTime?.id) {
          setMessages(prev => [...prev, errorResponse]);
        } else {
          // Also save error messages to the correct session
          if (currentSessionAtSendTime?.id) {
            await chat.saveMessage(errorResponse.text, 'system', currentSessionAtSendTime.id, getAgentType());
          }
        }
      }
    } finally {
      setIsLoading(false);
      setIsCancelling(false);
      setAbortController(null);
      setEventSource(null);
    }
  };

  // Create new session
  const handleNewSession = async () => {
    try {
      // Clear chat memory for current session before starting new session
      if (currentSession && currentSession.id) {
        await clearMemory(currentSession.id);
      }

      // Create a new session in the backend
      const newSession = await sessions.createSession('New Session', new Date().toISOString()); // You can customize the default name
      
      // Update state with the new session
      setCurrentSession(newSession);
      setMessages([]); // Clear messages for the new session
      setChatSessionId(newSession.id);
      localStorage.setItem('chatSessionId', newSession.id);
      
      // Add a welcome message
      const welcomeMessage = {
        text: "Hello! I'm your personal assistant. How can I help you today?",
        sender: 'assistant',
        timestamp: new Date().getTime(),
        id: Date.now(),
        session_id: newSession.id,
        agent_type: getAgentType(), // Set agent type for correct avatar
      };
      setMessages([welcomeMessage]);
      
      // Refresh the sessions list to show the new session
      loadSessions();
      setShowSessions(false);

    } catch (error) {
      console.error('Failed to create new session:', error);
      // Optionally, show an error message to the user
      addSystemMessage(`Error: Could not create a new session. ${error.message}`);
    }
  };

  // Load sessions list
  const loadSessions = async () => {
    try {
      const sessionsData = await sessions.getSessions();
      setSessionsList(sessionsData);
      // Update unread sessions set from the server data
      const unread = new Set(sessionsData.filter(s => s.unread).map(s => s.id));
      setUnreadSessions(unread);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  // Switch to a specific session
  const switchToSession = async (sessionId) => {
    // Optimistically update current session reference to avoid leaking tokens between sessions
    currentSessionRef.current = { id: sessionId };
    setChatSessionId(sessionId);
    // Mark session as read on the backend when switching to it
    try {
      await sessions.markSessionAsRead(sessionId); // This function needs to be created in api.js
      setUnreadSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
      // Trigger unread count update immediately
      if (onUnreadCountChange) {
        onUnreadCountChange();
      }
    } catch (error) {
      console.error('Failed to mark session as read:', error);
    }

    try {


      await sessions.activateSession(sessionId);
      const sessionMessages = await sessions.getSessionMessages(sessionId);
      let formattedMessages = sessionMessages.messages.map(msg => ({
        text: msg.message_text,
        sender: msg.sender,
        timestamp: msg.created_at,
        id: msg.id,
        agent_type: msg.agent_type || 'dashboard',
        // By default, messages are not in streaming state
        isStreaming: false
      }));
      // If the session is still generating, add a temporary placeholder.
      // The onToken callback will manage claiming and cleaning this up.
      if (generatingSessions.has(sessionId)) {
        const hasStreamingPlaceholder = formattedMessages.some(m => m.sender === 'assistant' && m.isStreaming);
        if (!hasStreamingPlaceholder) {
          formattedMessages.push({
            id: `streaming-placeholder-${sessionId}`,
            text: '',
            sender: 'assistant',
            timestamp: Date.now(),
            isStreaming: true,
            agent_type: getAgentType() // Preserve agent type on session switch
          });
        }
      }
      setMessages(formattedMessages);
      
      // Update current session
      const activeSession = await sessions.getActiveSession();
      setCurrentSession(activeSession);
      setChatSessionId(sessionId);
      setShowSessions(false);

      // Update loading state based on whether the target session is still generating
      setIsLoading(generatingSessions.has(sessionId));
      setIsCancelling(false);
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

  // Handle session history resize
  const handleSessionResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingSessions(true);
  }, []);

  // Session resize effect
  useEffect(() => {
    if (!isResizingSessions) return;

    const handleMouseMove = (e) => {
      const dialogRect = dialogRef.current?.getBoundingClientRect();
      if (!dialogRect) return;

      const relativeY = e.clientY - dialogRect.top;
      const headerHeight = 60; // Approximate header height
      const minHeight = 120;
      const maxHeight = dialogSize.height - headerHeight - 200; // Leave space for messages and input
      
      const newHeight = Math.max(minHeight, Math.min(maxHeight, relativeY - headerHeight));
      setSessionHistoryHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingSessions(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSessions, dialogSize.height]);



  // Handle cancel request
  const handleCancel = async () => {
    if (!isLoading) return;

    // Flag cancellation so any late EventSource can be immediately closed
    cancelPendingRef.current = true;

    // Mark as cancelling so UI can show spinner immediately
    setIsCancelling(true);

    // If we're on career agent page, try to cancel the career analysis
    if (location.pathname.startsWith('/agents/career') && currentSession?.id) {
      try {
        const response = await fetch(`/api/career/analyze/session/${currentSession.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          console.log('Career analysis cancelled successfully');
          // Add a system message to indicate cancellation
          addSystemMessage('🛑 Career analysis cancelled by user.');
        } else {
          console.warn('Failed to cancel career analysis:', response.statusText);
        }
      } catch (error) {
        console.error('Error cancelling career analysis:', error);
      }
    }

    // Close existing EventSource so backend stops streaming
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setEventSource(null);
    }

    // Abort any in-flight fetch / SSE polyfills
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }

    // Remove current session from generating set so isLoading refreshes
    if (currentSession?.id) {
      setGeneratingSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentSession.id);
        return newSet;
      });
    }

    // Turn off streaming flags so blinking cursor disappears immediately
    setMessages(prev => prev.map(msg =>
      msg.isStreaming ? { ...msg, isStreaming: false } : msg
    ));

    // Reset loading state after brief timeout to allow UI update
    setTimeout(() => {
      setIsLoading(false);
      setIsCancelling(false);
      cancelPendingRef.current = false; // Reset cancel flag
    }, 300);
  };

  // Handle message submission
  // Handle follow-up question click
  const handleFollowUpQuestionClick = (question) => {
    // Do nothing if the question is empty, a response is loading, or navigation is in progress.
    if (!question || isLoading || isNavigating) return;
    
    // Create a synthetic event because handleSubmit expects one.
    const syntheticEvent = {
      preventDefault: () => {},
    };

    // Call handleSubmit directly with the question, bypassing the input state.
    handleSubmit(syntheticEvent, question);
  };

  const handleSubmit = async (e, messageOverride = null) => {
    e.preventDefault();
    
    // If a response is already loading, treat the submission as a cancellation request.
    if (isLoading) {
      handleCancel();
      return;
    }
    
    // Determine the message to send, using the override if available (for follow-up questions).
    const userMessage = (messageOverride || input).trim();
    
    // Do not send an empty message or if navigation is in progress.
    if (!userMessage || isNavigating) return;

    // Clear the input field immediately after sending.
    setInput('');

    // Force scroll to bottom when user sends a message
    setUserHasScrolled(false);
    scrollToBottom(true);

    // Capture current session state to ensure response goes to correct session
    const currentSessionAtSendTime = currentSession;
    const currentChatSessionIdAtSendTime = chatSessionId;



    // Save user message to database and add to UI
    const { message: savedUserMessage, newSession } = await saveMessageToDb(userMessage, 'user');
    if (savedUserMessage) {
      setMessages(prev => [...prev, savedUserMessage]);
    } else {
      // Fallback to local state if save fails
      setMessages(prev => [...prev, { text: userMessage, sender: 'user', timestamp: new Date().getTime(), agent_type: getAgentType() }]);
    }

    // Track chat activity after message is saved
    const sessionForTracking = newSession || currentSessionAtSendTime;
    const messageIdForTracking = savedUserMessage?.id;
    if (sessionForTracking?.id) {
      trackChatActivity(userMessage, sessionForTracking.id, messageIdForTracking);
    }

    // Update currentSessionAtSendTime if a new session was created
    const updatedSessionAtSendTime = newSession || currentSessionAtSendTime;

    // If a new session was created, add it to the top of the sessions list
    if (newSession) {
      setSessionsList(prev => [newSession, ...prev]);

      // Rename the newly created session to the user\u2019s first message
      try {
        const newSessionName = userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage;
        await sessions.updateSessionName(newSession.id, newSessionName);
        setCurrentSession(prev => (prev ? { ...prev, session_name: newSessionName } : prev));
        setSessionsList(prev => prev.map(s => (s.id === newSession.id ? { ...s, session_name: newSessionName } : s)));
      } catch (err) {
        console.warn('Failed to update new session name:', err);
      }
    } else if (currentSessionAtSendTime && currentSessionAtSendTime.session_name === 'New Session') {
      // Rename placeholder session created earlier
      try {
        const newSessionName = userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage;
        await sessions.updateSessionName(currentSessionAtSendTime.id, newSessionName);
        setCurrentSession(prev => (prev ? { ...prev, session_name: newSessionName } : prev));
        setSessionsList(prev => prev.map(s => (s.id === currentSessionAtSendTime.id ? { ...s, session_name: newSessionName } : s)));
      } catch (err) {
        console.warn('Failed to update existing session name:', err);
      }
    }

    // Add current session to generating sessions - ensure we have a valid session ID
    const sessionIdForGenerating = updatedSessionAtSendTime?.id || currentSessionAtSendTime?.id;
    if (sessionIdForGenerating) {
      setGeneratingSessions(prev => {
        const newSet = new Set(prev);
        newSet.add(sessionIdForGenerating);
        return newSet;
      });
    }

    // Create new AbortController for this request
    const controller = new AbortController();
    setAbortController(controller);

    // Get AI response from chat API using streaming
    setIsLoading(true);
    setIsCancelling(false);
    
    // Create a placeholder message for streaming response
    const streamingMessageId = Date.now();
    let streamingResponse = '';
    
    // Add initial empty assistant message for streaming
    const initialAssistantMessage = {
      id: streamingMessageId,
      text: '',
      sender: 'assistant',
      timestamp: new Date().getTime(),
      agent_type: getAgentType(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, initialAssistantMessage]);
    
    try {
      // Use streaming response
      const eventSource = sendMessageStream(
        userMessage,
        sessionIdForGenerating,
        userId,
        // onToken callback - update the streaming message
        async (token, options = {}) => {
          streamingResponse += token;
          
          // If this is the initial message, save it to database immediately
          if (options.isInitialMessage) {
            const sessionToSaveIn = updatedSessionAtSendTime || currentSessionAtSendTime;
            if (sessionToSaveIn?.id) {
              try {
                await chat.saveMessage(token, 'assistant', sessionToSaveIn.id, getAgentType());
                console.log('Initial message saved to database:', token);
              } catch (error) {
                console.error('Failed to save initial message to database:', error);
              }
            }
          }
          
          setMessages(prev => {
            // Ensure we are still in the originating session before updating UI
            if (currentSessionRef.current?.id !== (currentSessionAtSendTime?.id || updatedSessionAtSendTime?.id) || chatSessionId !== currentChatSessionIdAtSendTime) {
              return prev; // Ignore tokens for other sessions
            }
            // Find the assistant message to update
            const newMessages = [...prev];
            let assistantIdx = newMessages.findIndex(m => m.sender === 'assistant' && (m.isStreaming || m.id === streamingMessageId));

            if (assistantIdx === -1) {
              // No assistant message exists, create one.
              newMessages.push({
                id: streamingMessageId,
                text: streamingResponse,
                sender: 'assistant',
                timestamp: new Date().getTime(),
                isStreaming: !options.isInitialMessage // Don't show cursor for initial message
              });
              assistantIdx = newMessages.length - 1;
            } else {
              // Assistant message found, update it.
              const currentMessage = newMessages[assistantIdx];
              newMessages[assistantIdx] = {
                ...currentMessage,
                text: streamingResponse,
                id: streamingMessageId, // Claim the message with the correct ID
                isStreaming: options.isInitialMessage ? false : true // Show cursor for subsequent tokens
              };
            }

            return newMessages;
          });
        },
        // onComplete callback - finalize the message
        async (fullResponse, professionalData, followUpQuestionsData) => {
          // Remove session from generating sessions on completion
          const sessionIdForClearing = updatedSessionAtSendTime?.id || currentSessionAtSendTime?.id;
          if (sessionIdForClearing) {
            setGeneratingSessions(prev => {
              const newSet = new Set(prev);
              newSet.delete(sessionIdForClearing);
              return newSet;
            });
          }

          // Check if user is still in the same session
          const sessionMatches = currentSessionAtSendTime === null ? 
            (currentSessionRef.current?.id === updatedSessionAtSendTime?.id) : 
            (currentSessionRef.current?.id === currentSessionAtSendTime?.id);
          
          if (sessionMatches && chatSessionId === currentChatSessionIdAtSendTime) {
            // Save the complete response to database
            // For new sessions, use the updatedSessionAtSendTime which contains the newly created session
            const sessionToSaveIn = updatedSessionAtSendTime || currentSessionAtSendTime;
            let savedAssistantMessage = null;
            
            if (sessionToSaveIn?.id) {
              try {
                const savedMessage = await chat.saveMessage(fullResponse, 'assistant', sessionToSaveIn.id, getAgentType());
                savedAssistantMessage = {
                  text: savedMessage.message_text,
                  sender: savedMessage.sender,
                  timestamp: savedMessage.created_at,
                  id: savedMessage.id
                };
              } catch (error) {
                console.error('Failed to save assistant message to database:', error);
              }
            }
            
            // Update the streaming message to final state
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? {
                    ...msg,
                    text: fullResponse,
                    isStreaming: false,
                    id: savedAssistantMessage?.id || msg.id
                  }
                : msg
            ));
            
            // Handle follow-up questions if provided
            if (followUpQuestionsData && Array.isArray(followUpQuestionsData) && followUpQuestionsData.length > 0) {
              const messageId = savedAssistantMessage?.id || streamingMessageId;
              setFollowUpQuestions(prev => ({
                ...prev,
                [messageId]: followUpQuestionsData
              }));
            }
            
            // If professional data is provided (for career insights), update the parent component
            if (professionalData && location.pathname.startsWith('/agents/career')) {
              // Find the parent window to update the CareerAgent component
              const careerAgentWindow = window.parent.document.querySelector('[data-agent-type="career"]');
              if (careerAgentWindow) {
                // Dispatch a custom event with the professional data
                const event = new CustomEvent('careerInsightsReceived', { detail: { professionalData } });
                careerAgentWindow.dispatchEvent(event);
              }
            }
          } else {
            // User switched sessions, save to database but remove from current UI
            const sessionIdToSave = currentSessionAtSendTime?.id || updatedSessionAtSendTime?.id;
            if (sessionIdToSave) {
              await chat.saveMessage(fullResponse, 'assistant', sessionIdToSave, getAgentType());
              // Mark session as unread by calling the backend
              try {
                await sessions.markSessionAsUnread(sessionIdToSave); // This function needs to be created in api.js
                setUnreadSessions(prev => new Set(prev).add(sessionIdToSave));
                // Trigger unread count update immediately
                if (onUnreadCountChange) {
                  onUnreadCountChange();
                }
              } catch (error) {
                console.error('Failed to mark session as unread:', error);
              }
            }
            // Remove the streaming message from current session
            setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
          }
        },
        // onError callback - handle errors
        async (errorMessage) => { 
          // Remove session from generating sessions on error
          const sessionIdForClearing = updatedSessionAtSendTime?.id || currentSessionAtSendTime?.id;
          if (sessionIdForClearing) {
            setGeneratingSessions(prev => {
              const newSet = new Set(prev);
              newSet.delete(sessionIdForClearing);
              return newSet;
            });
          }

          console.error('Streaming error:', errorMessage);
          
          const sessionMatches = currentSessionAtSendTime === null ? 
            (currentSessionRef.current?.id === updatedSessionAtSendTime?.id) : 
            (currentSessionRef.current?.id === currentSessionAtSendTime?.id);
          
          if (sessionMatches && chatSessionId === currentChatSessionIdAtSendTime) {
            const finalErrorMessage = errorMessage || 'Sorry, I encountered an error processing your message.';
            // For new sessions, use the updatedSessionAtSendTime which contains the newly created session
            const sessionToSaveIn = updatedSessionAtSendTime || currentSessionAtSendTime;
            let savedErrorMessage = null;
            
            if (sessionToSaveIn?.id) {
              try {
                const savedMessage = await chat.saveMessage(finalErrorMessage, 'assistant', sessionToSaveIn.id, getAgentType());
                savedErrorMessage = {
                  text: savedMessage.message_text,
                  sender: savedMessage.sender,
                  timestamp: savedMessage.created_at,
                  id: savedMessage.id
                };
              } catch (error) {
                console.error('Failed to save error message to database:', error);
              }
            }
            
            // Update the streaming message to show error
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? {
                    ...msg,
                    text: finalErrorMessage,
                    isStreaming: false,
                    isError: true,
                    id: savedErrorMessage?.id || msg.id
                  }
                : msg
            ));
          } else {
            // User switched sessions, save error to database but remove from current UI
            const sessionIdToSave = currentSessionAtSendTime?.id || updatedSessionAtSendTime?.id;
            if (sessionIdToSave) {
              await chat.saveMessage(errorMessage, 'assistant', sessionIdToSave, getAgentType());
            }
            // Remove the streaming message from current session
            setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
          }
        }
      );
      
      // Store the EventSource for potential cancellation
      setEventSource(eventSource);
      eventSourceRef.current = eventSource;
      if (cancelPendingRef.current) {
        eventSource.close();
        eventSourceRef.current = null;
        setEventSource(null);
        return;
      }

      
    } catch (error) {
      console.error('Error starting streaming response:', error);
      
      // Remove the placeholder streaming message
      setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
      
      // Check if user is still in the same session
      const errorSessionMatches = currentSessionAtSendTime === null ? 
        (currentSessionRef.current?.id === updatedSessionAtSendTime?.id) : 
        (currentSessionRef.current?.id === currentSessionAtSendTime?.id);
      
      if (errorSessionMatches && chatSessionId === currentChatSessionIdAtSendTime) {
        const errorMessage = handleApiError(error);
        // For new sessions, use the updatedSessionAtSendTime which contains the newly created session
        const sessionToSaveIn = updatedSessionAtSendTime || currentSessionAtSendTime;
        let savedErrorMessage = null;
        
        if (sessionToSaveIn?.id) {
          try {
            const savedMessage = await chat.saveMessage(errorMessage, 'assistant', sessionToSaveIn.id, getAgentType());
            savedErrorMessage = {
              text: savedMessage.message_text,
              sender: savedMessage.sender,
              timestamp: savedMessage.created_at,
              id: savedMessage.id
            };
          } catch (saveError) {
            console.error('Failed to save error message to database:', saveError);
          }
        }
        
        if (savedErrorMessage) {
          setMessages(prev => [...prev, savedErrorMessage]);
        } else {
          setMessages(prev => [...prev, { 
            text: errorMessage, 
            sender: 'assistant', 
            timestamp: new Date().toISOString() 
          }]);
        }
      }
    } finally {
      setIsLoading(false);
      setIsCancelling(false);
      setAbortController(null);
      setEventSource(null);
    }
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

    const minWidth = 320;
    const minHeight = 400;
    const maxWidth = window.innerWidth - 40; // Leave 20px padding on each side
    const maxHeight = window.innerHeight - 40;

    if (resizeDirection.includes('right')) {
      newWidth = Math.min(maxWidth, Math.max(minWidth, resizeStartSize.current.width + deltaX));
    }
    if (resizeDirection.includes('left')) {
      newWidth = Math.min(maxWidth, Math.max(minWidth, resizeStartSize.current.width - deltaX));
    }
    if (resizeDirection.includes('bottom')) {
      newHeight = Math.min(maxHeight, Math.max(minHeight, resizeStartSize.current.height + deltaY));
    }
    if (resizeDirection.includes('top')) {
      newHeight = Math.min(maxHeight, Math.max(minHeight, resizeStartSize.current.height - deltaY));
    }

    setDialogSize({ width: newWidth, height: newHeight });
  }, [isResizing, resizeDirection]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDirection('');
  }, []);

  const handleDragStart = (e) => {
    // Prevent drag from starting on buttons or other interactive elements
    if (e.target.closest('button, input, select, textarea')) {
      return;
    }
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialDialogPos.current = { x: assistantPosition.x, y: assistantPosition.y };
  };

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    let newX = initialDialogPos.current.x + dx;
    let newY = initialDialogPos.current.y + dy;

    // Constrain movement within the viewport
    const dialogRect = dialogRef.current?.getBoundingClientRect();
    if (dialogRect) {
      if (newX < 0) newX = 0;
      if (newY < 0) newY = 0;
      if (newX + 128 > window.innerWidth) newX = window.innerWidth - 128; // assistant width
      if (newY + 128 > window.innerHeight) newY = window.innerHeight - 128; // assistant height
    }

    setAssistantPosition({ x: newX, y: newY });
  }, [isDragging, setAssistantPosition]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

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

  // Force dialog reposition on window resize to keep it within viewport bounds
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Track if dialog needs repositioning
  const [dialogKey, setDialogKey] = useState(0);

  useEffect(() => {
    const handleWindowResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
      // Force dialog reposition by changing key
      setDialogKey(prev => prev + 1);
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // Force reposition when assistant moves
  useEffect(() => {
    setDialogKey(prev => prev + 1);
  }, [assistantPosition.x, assistantPosition.y]);

  const getDialogStyle = () => {
    const assistantX = assistantPosition.x;
    const assistantY = assistantPosition.y;
    const assistantWidth = 128; // w-32 in pixels
    const assistantHeight = 128;
    const spacing = 16; // Gap between assistant and dialog
    const edgePadding = 20; // Minimum padding from viewport edges

    const viewportWidth = windowSize.width;
    const viewportHeight = windowSize.height;

    const minWidth = 320;
    const minHeight = 400;
    const maxWidth = viewportWidth - 40; // Maximum width (leave padding)
    const maxHeight = viewportHeight - 40; // Maximum height (leave padding)

    // Calculate available space in each direction from the assistant
    const spaceLeft = assistantX - edgePadding;
    const spaceRight = viewportWidth - (assistantX + assistantWidth) - edgePadding;
    const spaceAbove = assistantY - edgePadding;
    const spaceBelow = viewportHeight - (assistantY + assistantHeight) - edgePadding;

    // Determine horizontal placement (left or right of assistant)
    let dialogX;
    let dialogWidth = Math.min(maxWidth, dialogSize.width); // Respect max width
    let horizontalPlacement;

    // Choose the side with more space
    if (spaceRight >= spaceLeft) {
      // Place dialog to the right of assistant
      horizontalPlacement = 'right';
      dialogX = assistantX + assistantWidth + spacing;

      // Check if dialog fits to the right
      const availableWidth = viewportWidth - dialogX - edgePadding;
      if (availableWidth < dialogWidth) {
        // If it doesn't fit, try the left side if it has more space
        if (spaceLeft > availableWidth && spaceLeft >= minWidth) {
          horizontalPlacement = 'left';
          const leftAvailableWidth = assistantX - spacing - edgePadding;
          dialogWidth = Math.max(minWidth, Math.min(dialogWidth, leftAvailableWidth));
          dialogX = assistantX - spacing - dialogWidth;
        } else {
          dialogWidth = Math.max(minWidth, availableWidth);
        }
      }
    } else {
      // Place dialog to the left of assistant
      horizontalPlacement = 'left';

      // Check if dialog fits to the left
      const availableWidth = assistantX - spacing - edgePadding;
      if (availableWidth < dialogWidth) {
        // If it doesn't fit, try the right side if it has more space
        if (spaceRight > availableWidth && spaceRight >= minWidth) {
          horizontalPlacement = 'right';
          dialogX = assistantX + assistantWidth + spacing;
          const rightAvailableWidth = viewportWidth - dialogX - edgePadding;
          dialogWidth = Math.max(minWidth, Math.min(dialogWidth, rightAvailableWidth));
        } else {
          dialogWidth = Math.max(minWidth, availableWidth);
          dialogX = assistantX - spacing - dialogWidth;
        }
      } else {
        dialogX = assistantX - spacing - dialogWidth;
      }
    }

    // Ensure dialog doesn't go off-screen horizontally
    dialogX = Math.max(edgePadding, Math.min(dialogX, viewportWidth - dialogWidth - edgePadding));

    // Determine vertical placement
    let dialogY;
    let dialogHeight = Math.min(maxHeight, dialogSize.height); // Respect max height

    // Try to align dialog bottom with assistant bottom (preferred)
    dialogY = assistantY + assistantHeight - dialogHeight;

    // Check if dialog fits above the bottom edge
    if (dialogY < edgePadding) {
      // Not enough space above, try aligning tops
      dialogY = assistantY;

      // Check if it fits below the top edge
      const availableHeight = viewportHeight - dialogY - edgePadding;
      if (availableHeight < dialogHeight) {
        dialogHeight = Math.max(minHeight, availableHeight);
      }
    }

    // Additional check: if dialog extends below viewport, adjust upward
    const dialogBottom = dialogY + dialogHeight;
    if (dialogBottom > viewportHeight - edgePadding) {
      dialogY = viewportHeight - edgePadding - dialogHeight;

      // If still doesn't fit, shrink height
      if (dialogY < edgePadding) {
        dialogY = edgePadding;
        dialogHeight = Math.max(minHeight, viewportHeight - 2 * edgePadding);
      }
    }

    // Final bounds check - ensure dialog is within viewport
    dialogY = Math.max(edgePadding, Math.min(dialogY, viewportHeight - dialogHeight - edgePadding));

    // Update dialog size if it was constrained (avoid infinite loop during resize)
    if (!isResizing && (dialogWidth !== dialogSize.width || dialogHeight !== dialogSize.height)) {
      // Use setTimeout to avoid state update during render
      setTimeout(() => {
        setDialogSize({ width: dialogWidth, height: dialogHeight });
      }, 0);
    }

    // Build style object with fixed positioning
    const style = {
      position: 'fixed',
      left: `${dialogX}px`,
      top: `${dialogY}px`,
      width: `${dialogWidth}px`,
      height: `${dialogHeight}px`,
      transition: isResizing ? 'none' : 'all 0.3s ease-in-out',
      opacity: 0,
      transform: 'scale(0.95)',
      zIndex: 50,
    };

    // Trigger animation using requestAnimationFrame for smoother performance
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const elem = document.getElementById('chat-dialog');
        if (elem) {
          elem.style.opacity = '1';
          elem.style.transform = 'scale(1)';
        }
      });
    });

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
        className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-10"
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
      <div 
        className="p-4 bg-blue-500 text-white cursor-move"
        onMouseDown={handleDragStart}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold">Personal Assistant</h3>
            {/* API Status Indicator */}
            <div className={`w-2 h-2 rounded-full ${
              apiStatus === 'healthy' ? 'bg-green-400' : 
              apiStatus === 'unhealthy' ? 'bg-red-400' : 'bg-yellow-400'
            }`} title={`Chat API: ${apiStatus}`}></div>
          </div>
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
        <div className="relative">
          <div 
            className="p-4 border-b border-gray-200 bg-gray-50 overflow-y-auto"
            style={{ height: `${sessionHistoryHeight}px` }}
          >
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
                        <p className="text-xs font-medium text-gray-800 truncate flex items-center">
                          {unreadSessions.has(session.id) && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 flex-shrink-0"></span>
                          )}
                          {session.session_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {generatingSessions.has(session.id) ? (
                            <span className="text-blue-600 animate-pulse">Generating response...</span>
                          ) : (
                            new Date(session.created_at).toLocaleString('en-US', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                            })
                          )}
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
          {/* Resize handle for session history */}
          <div 
            className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-gray-300 hover:bg-gray-400 transition-colors ${
              isResizingSessions ? 'bg-blue-400' : ''
            }`}
            onMouseDown={handleSessionResizeStart}
            title="Drag to resize session history"
          >
            <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-0.5 bg-gray-500 mx-4"></div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={messageContainerRef}
        className="flex-1 p-4 overflow-y-auto"
        onScroll={() => {
          const container = messageContainerRef.current;
          if (container) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            // A threshold of 5px is used to account for rounding issues
            const isAtBottom = scrollHeight - scrollTop <= clientHeight + 5;
            setUserHasScrolled(!isAtBottom);
          }
        }}
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500">Loading chat history...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`flex items-start group my-2 ${
                  message.sender === 'system' 
                    ? 'justify-center' 
                    : message.sender === 'user' 
                    ? 'flex-row-reverse' 
                    : 'flex-row'
                }`}
              >
                {/* Avatar */}
                {message.sender !== 'system' && (
                  <div className={`flex-shrink-0 ${message.sender === 'user' ? 'ml-2' : 'mr-2'}`}>
                    {message.sender === 'user' ? (
                      <div className="px-3 py-1 rounded-lg bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                        {user?.name || 'User'}
                      </div>
                    ) : (
                      <div className={`px-3 py-1 rounded-lg flex items-center justify-center text-white text-sm font-medium ${message.agent_type === 'career' ? 'bg-green-500' : 'bg-purple-500'}`}>
                        {message.agent_type === 'career' ? 'Career' : 'Dashboard'}
                      </div>
                    )}
                  </div>
                )}
                {message.sender === 'system' ? (
                  <div className="w-full flex justify-center">
                    <div className="bg-yellow-100 text-yellow-800 border border-yellow-200 px-4 py-2 rounded-full text-sm font-medium">
                      <MessageRenderer content={message.text} isStreaming={message.isStreaming} />
                    </div>
                  </div>
                ) : editingMessageIndex === index && message.sender === 'user' ? (
                  // Edit mode for user messages
                  <div className="w-full max-w-[90%] p-3 rounded-lg bg-blue-500 text-white">
                    <textarea
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      onKeyDown={(e) => handleEditKeyPress(e, index)}
                      className="w-full bg-white text-gray-800 p-3 rounded border-none resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                      rows={Math.max(2, editInput.split('\n').length)}
                      autoFocus
                    />
                    <div className="flex justify-end space-x-3 mt-3">
                      <button
                        onClick={cancelEditMessage}
                        className="px-4 py-2 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => submitEditedMessage(index)}
                        className="px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  // Normal message display with MessageRenderer
                  <div className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[90%] p-3 rounded-lg select-text ${
                        message.sender === 'user'
                          ? 'bg-blue-500 text-white'
                          : message.messageType === 'progress' || message.messageType === 'section_start'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : message.messageType === 'section_complete'
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : message.messageType === 'analysis_complete'
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <div className={message.sender === 'system' ? 'text-sm' : getFontSizeClass()}>
                        <MessageRenderer content={message.text} isStreaming={message.isStreaming} />
                      </div>
                    </div>
                    
                    {/* Action buttons - appears below message content and above timestamp */}
                    {message.sender !== 'system' && editingMessageIndex !== index && (
                      <div className={`mt-2 flex space-x-1 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <button
                          onClick={() => copyToClipboard(message.text, index)}
                          className={`p-1 rounded transition-colors ${copiedMessageIds.has(index) ? 'bg-green-100 text-green-600' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
                          title="Copy message"
                        >
                          {copiedMessageIds.has(index) ? (
                            <CheckIcon className="w-4 h-4 text-green-500" />
                          ) : (
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          )}
                        </button>
                        {message.sender === 'user' && (
                          <button
                            onClick={() => startEditMessage(index, message.text)}
                            disabled={isLoading || isCancelling}
                            className={`p-1 rounded transition-colors ${isLoading || isCancelling ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
                            title={isLoading || isCancelling ? "Cannot edit while generating response" : "Edit message"}
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                    
                    {message.timestamp && message.sender !== 'system' && editingMessageIndex !== index && (
                      <div className="text-xs text-gray-400 mt-1 px-1">
                        {new Date(typeof message.timestamp === 'string' ? message.timestamp : message.timestamp).toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                    
                    {/* Follow-up Questions */}
                    {message.sender === 'assistant' && !message.isStreaming && followUpQuestions[message.id] && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
                        <div className="flex items-center mb-3">
                          <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-semibold text-blue-800">You might also want to ask:</span>
                        </div>
                        <div className="grid gap-2">
                          {followUpQuestions[message.id].map((question, qIndex) => (
                            <button
                              key={qIndex}
                              onClick={() => handleFollowUpQuestionClick(question)}
                              disabled={isLoading || isNavigating}
                              className={`group relative w-full text-left p-3 text-sm rounded-lg border-2 transition-all duration-200 transform ${
                                isLoading || isNavigating
                                  ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'bg-white text-gray-700 border-blue-200 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                              }`}
                              title={isLoading || isNavigating ? 'Please wait for current response to complete' : 'Click to ask this question'}
                            >
                              <div className="flex items-start">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 mt-0.5 ${
                                  isLoading || isNavigating
                                    ? 'bg-gray-200 text-gray-400'
                                    : 'bg-blue-100 text-blue-600 group-hover:bg-blue-200'
                                }`}>
                                  {qIndex + 1}
                                </span>
                                <span className="flex-1 leading-relaxed">{question}</span>
                                {!isLoading && !isNavigating && (
                                  <svg className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={
              isNavigating 
                ? "Redirecting to agent..." 
                : isCancelling 
                ? "Cancelling..." 
                : isLoading 
                ? "Thinking..." 
                : isOptimizing
                ? "Optimizing your input..."
                : "Ask me anything..."
            }
            disabled={isNavigating || isCancelling || isLoading || isOptimizing}
            rows={1}
            style={{
              minHeight: '40px',
              maxHeight: '200px',
              height: 'auto',
              resize: 'none'
            }}
            className={`w-full p-2 pr-24 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none ${
              isNavigating || isCancelling || isLoading || isOptimizing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
            }`}
          />
          {/* Optimize Button */}
          <button
            onClick={isOptimized ? revertOptimization : optimizeInput}
            type="button"
            disabled={isNavigating || isCancelling || isLoading || isOptimizing || !input.trim()}
            className={`absolute bottom-2 right-16 p-2 rounded-lg transition-colors ${
              isNavigating || isCancelling || isLoading || isOptimizing || !input.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isOptimized
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
            title={
              isOptimizing
                ? 'Optimizing...'
                : isOptimized
                ? 'Revert to original input'
                : 'Optimize input content'
            }
          >
            {isOptimizing ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : isOptimized ? (
              <ArrowUturnLeftIcon className="w-5 h-5" />
            ) : (
              <SparklesIcon className="w-5 h-5" />
            )}
          </button>
          
          {/* Send Button */}
          <button
            onClick={isLoading && !isCancelling ? handleCancel : undefined}
            type={isLoading && !isCancelling ? 'button' : 'submit'}
            disabled={isNavigating || isOptimizing || (isLoading ? false : !input.trim())}
            className={`absolute bottom-2 right-4 p-2 rounded-lg transition-colors ${
              isNavigating || isOptimizing || (isLoading ? false : !input.trim())
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isLoading && !isCancelling
                ? 'bg-red-500 text-white hover:bg-red-600'
                : isCancelling
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
            title={isLoading && !isCancelling ? 'Cancel request' : 'Send message'}
          >
            {isCancelling ? (
              <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
            ) : isLoading ? (
              <StopIcon className="w-5 h-5" />
            ) : (
              <PaperAirplaneIcon className="w-5 h-5" />
            )}
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