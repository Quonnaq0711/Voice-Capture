import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { XMarkIcon, PaperAirplaneIcon, PlusIcon, ClockIcon, Cog6ToothIcon, TrashIcon, ChevronDownIcon, DocumentDuplicateIcon, PencilIcon, StopIcon } from '@heroicons/react/24/outline';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { chat, sessions, profile as profileAPI } from '../services/api';
import { sendMessage, sendMessageStream, checkHealth, clearMemory, generateSessionId, handleApiError, removeMessagesAfterIndex, updateMessageAtIndex } from '../services/chatApi';
import MessageRenderer from './MessageRenderer';

const ChatDialog = ({ onClose, assistantPosition, setAssistantPosition }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
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

  // Check API health on component mount
  useEffect(() => {
    checkApiHealth();

  }, []);

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

  // Save message to database
  const saveMessageToDb = async (messageText, sender) => {
    try {
      let sessionToUse = currentSession;
      let newSessionCreated = false;
      
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
        const savedMessage = await chat.saveMessage(messageText, sender, sessionToUse.id);
        const messageData = {
          text: savedMessage.message_text,
          sender: savedMessage.sender,
          timestamp: savedMessage.created_at,
          id: savedMessage.id
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
      const health = await checkHealth();
      setApiStatus(health.status === 'healthy' ? 'healthy' : 'unhealthy');
    } catch (error) {
      setApiStatus('unhealthy');
    }
  };

  // Copy message to clipboard function
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
      console.log('Message copied to clipboard');
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
      // Add a placeholder message for the AI response
      const placeholderMessage = {
        id: Date.now() + 1,
        text: '',
        sender: 'assistant',
        timestamp: new Date().getTime(),
        isStreaming: true
      };
      
      setMessages(prev => [...prev, placeholderMessage]);
      
      let streamingResponse = '';
      // Use streaming response for edited messages
      const eventSource = sendMessageStream(
        editInput.trim(),
        currentSessionAtSendTime?.id,
        userId,
        // onToken callback - update the streaming message
        (token) => {
          streamingResponse += token;
          setMessages(prev => {
            const streamingMessageId = placeholderMessage.id;

            // Ensure we are still in the originating session before updating UI
            if (currentSessionRef.current?.id !== currentSessionAtSendTime?.id || chatSessionId !== currentChatSessionIdAtSendTime) {
              return prev; // Ignore tokens for other sessions
            }

            // Find the first streaming placeholder, claim it, and remove others.
            const newMessages = [...prev];
            let streamingIdx = newMessages.findIndex(m => m.sender === 'assistant' && m.isStreaming);

            if (streamingIdx === -1) {
              // No placeholder exists, create one.
              newMessages.push({
                id: streamingMessageId,
                text: streamingResponse,
                sender: 'assistant',
                timestamp: new Date().getTime(),
                isStreaming: true
              });
              streamingIdx = newMessages.length - 1;
            } else {
              // Placeholder found, update it.
              newMessages[streamingIdx] = {
                ...newMessages[streamingIdx],
                text: streamingResponse,
                id: streamingMessageId, // Claim the placeholder with the correct ID
              };
            }

            // Remove any other streaming placeholders to prevent duplicates.
            return newMessages.filter((m, idx) => 
              !(m.sender === 'assistant' && m.isStreaming && idx !== streamingIdx)
            );
          });
        },
        // onComplete callback - finalize the message
        async (fullResponse) => {
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
                Object.assign(lastMessage, assistantMessage);
                delete lastMessage.isStreaming;
              }
              return newMessages;
            });
          } else {
            // User switched sessions, save response to the original session's database
            console.log('User switched sessions during response generation for edited message. Response saved to database but not displayed.');
            if (currentSessionAtSendTime?.id) {
              await chat.saveMessage(fullResponse, 'assistant', currentSessionAtSendTime.id);
              // Mark session as unread by calling the backend
              try {
                await sessions.markSessionAsUnread(currentSessionAtSendTime.id); // This function needs to be created in api.js
                setUnreadSessions(prev => new Set(prev).add(currentSessionAtSendTime.id));
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
            await chat.saveMessage(errorResponse.text, 'system', currentSessionAtSendTime.id);
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
      if (chatSessionId) {
        await clearMemory(chatSessionId);
      }
      
      // Generate new chat session ID and save to localStorage
      const newSessionId = generateSessionId();
      localStorage.setItem('chatSessionId', newSessionId);
      setChatSessionId(newSessionId);
      
      // Add welcome message in English
      const welcomeMessage = {
        text: "Hello! I'm your personal assistant. How can I help you today?",
        sender: 'assistant',
        timestamp: new Date().getTime(),
        id: Date.now()
      };
      setMessages([welcomeMessage]);
      
      // Don't set currentSession to null immediately, let it be set when first message is sent
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
            isStreaming: true
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
  const handleCancel = () => {
    if (!isLoading) return;

    // Flag cancellation so any late EventSource can be immediately closed
    cancelPendingRef.current = true;

    // Mark as cancelling so UI can show spinner immediately
    setIsCancelling(true);

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
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // If currently loading, cancel the request
    if (isLoading) {
      handleCancel();
      return;
    }
    
    if (!input.trim() || isNavigating) return;

    const userMessage = input.trim();
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
      setMessages(prev => [...prev, { text: userMessage, sender: 'user', timestamp: new Date().getTime() }]);
    }

    // Update currentSessionAtSendTime if a new session was created
    const updatedSessionAtSendTime = newSession || currentSessionAtSendTime;

    // If a new session was created, add it to the top of the sessions list
    if (newSession) {
      setSessionsList(prev => [newSession, ...prev]);
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
        (token) => {
          streamingResponse += token;
          setMessages(prev => {
            // Ensure we are still in the originating session before updating UI
            if (currentSessionRef.current?.id !== (currentSessionAtSendTime?.id || updatedSessionAtSendTime?.id) || chatSessionId !== currentChatSessionIdAtSendTime) {
              return prev; // Ignore tokens for other sessions
            }
            // Find the first streaming placeholder, claim it, and remove others.
            const newMessages = [...prev];
            let streamingIdx = newMessages.findIndex(m => m.sender === 'assistant' && m.isStreaming);

            if (streamingIdx === -1) {
              // No placeholder exists, create one.
              newMessages.push({
                id: streamingMessageId,
                text: streamingResponse,
                sender: 'assistant',
                timestamp: new Date().getTime(),
                isStreaming: true
              });
              streamingIdx = newMessages.length - 1;
            } else {
              // Placeholder found, update it.
              newMessages[streamingIdx] = {
                ...newMessages[streamingIdx],
                text: streamingResponse,
                id: streamingMessageId, // Claim the placeholder with the correct ID
              };
            }

            // Remove any other streaming placeholders to prevent duplicates.
            return newMessages.filter((m, idx) => 
              !(m.sender === 'assistant' && m.isStreaming && idx !== streamingIdx)
            );
          });
        },
        // onComplete callback - finalize the message
        async (fullResponse) => {
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
                const savedMessage = await chat.saveMessage(fullResponse, 'assistant', sessionToSaveIn.id);
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
          } else {
            // User switched sessions, save to database but remove from current UI
            const sessionIdToSave = currentSessionAtSendTime?.id || updatedSessionAtSendTime?.id;
            if (sessionIdToSave) {
              await chat.saveMessage(fullResponse, 'assistant', sessionIdToSave);
              // Mark session as unread by calling the backend
              try {
                await sessions.markSessionAsUnread(sessionIdToSave); // This function needs to be created in api.js
                setUnreadSessions(prev => new Set(prev).add(sessionIdToSave));
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
                const savedMessage = await chat.saveMessage(finalErrorMessage, 'assistant', sessionToSaveIn.id);
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
              await chat.saveMessage(errorMessage, 'assistant', sessionIdToSave);
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
            const savedMessage = await chat.saveMessage(errorMessage, 'assistant', sessionToSaveIn.id);
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
                className={`flex flex-col group ${
                  message.sender === 'system' 
                    ? 'items-center' 
                    : message.sender === 'user' 
                    ? 'items-end' 
                    : 'items-start'
                }`}
              >
                {editingMessageIndex === index && message.sender === 'user' ? (
                  // Edit mode for user messages
                  <div className="max-w-[80%] p-3 rounded-lg bg-blue-500 text-white">
                    <textarea
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      onKeyDown={(e) => handleEditKeyPress(e, index)}
                      className="w-full bg-white text-gray-800 p-2 rounded border-none resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                      rows={Math.max(2, editInput.split('\n').length)}
                      autoFocus
                    />
                    <div className="flex justify-end space-x-2 mt-2">
                      <button
                        onClick={cancelEditMessage}
                        className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => submitEditedMessage(index)}
                        className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  // Normal message display with MessageRenderer
                  <div
                    className={`${
                      message.sender === 'system'
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-200 px-4 py-2 rounded-full text-sm font-medium'
                        : `max-w-[80%] p-3 rounded-lg select-text ${
                            message.sender === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`
                    }`}
                  >
                    <div className={message.sender === 'system' ? 'text-sm' : getFontSizeClass()}>
                      <MessageRenderer content={message.text} isStreaming={message.isStreaming} />
                    </div>
                  </div>
                )}
                
                {/* Action buttons - appears below message on hover */}
                {message.sender !== 'system' && editingMessageIndex !== index && (
                  <div className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1 flex space-x-1 ${
                    message.sender === 'user' ? 'self-end' : 'self-start'
                  }`}>
                    <button
                      onClick={() => copyToClipboard(message.text)}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                      title="Copy message"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4" />
                    </button>
                    {message.sender === 'user' && (
                      <button
                        onClick={() => startEditMessage(index, message.text)}
                        disabled={isLoading || isCancelling}
                        className={`p-1 rounded transition-colors ${
                          isLoading || isCancelling
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                        }`}
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
                      second: '2-digit',
                      hour12: true,
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
                : "Ask me anything..."
            }
            disabled={isNavigating || isCancelling || isLoading}
            rows={Math.max(1, Math.min(10, input.split('\n').length))}
            className={`w-full p-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none ${
              isNavigating || isCancelling || isLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
            }`}
          />
          <button
            onClick={isLoading && !isCancelling ? handleCancel : undefined}
            type={isLoading && !isCancelling ? 'button' : 'submit'}
            disabled={isNavigating || (isLoading ? false : !input.trim())}
            className={`absolute bottom-2 right-2 p-2 rounded-lg transition-colors ${
              isNavigating || (isLoading ? false : !input.trim())
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