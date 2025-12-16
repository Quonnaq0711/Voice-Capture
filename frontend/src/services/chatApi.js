/**
 * Chat API service for communicating with the Personal Assistant Chat API
 * Handles all HTTP requests to the chat backend running on localhost:8001
 */

// Use relative paths for API calls (proxied through setupProxy.js in dev, Nginx in prod)
// This ensures all requests go through the proxy, avoiding CORS issues
// In production: /api/pa/ -> http://idii-PA-staging:8001/api/chat/ (via Nginx)
// In development: /api/pa/ -> http://localhost:6001/api/chat/ (via setupProxy.js)
const CHAT_API_BASE_URL = '/api/pa';
const CAREER_API_BASE_URL = '/api/career';

/**
 * Parse JSON response with error logging
 * Replaces empty catch blocks with proper error logging
 * @param {Response} response - Fetch response object
 * @returns {Promise<Object>} - Parsed JSON or empty object on failure
 */
const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[chatApi] Failed to parse JSON response:', err.message);
    }
    return {};
  }
};

/**
 * Helper function to build absolute URL from relative or absolute path
 * Needed for EventSource and URL constructor which require full URLs
 * @param {string} path - The API path (can be relative or absolute)
 * @returns {string} - Absolute URL
 */
const buildAbsoluteUrl = (path) => {
  // If path already starts with http:// or https://, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Otherwise, prepend with window.location.origin to make it absolute
  return `${window.location.origin}${path}`;
};

/**
 * Send a message to the AI assistant and get a response
 * @param {string} message - The user's message
 * @param {string} sessionId - Optional session ID for conversation context
 * @param {AbortSignal} signal - Optional abort signal for cancelling the request
 * @returns {Promise<Object>} - The AI response object
 */
export const sendMessage = async (message, sessionId = null, signal = null, apiUrl = null) => {
  try {
    const response = await fetch(apiUrl || `${CHAT_API_BASE_URL}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message.trim(),
        session_id: sessionId
      }),
      signal: signal
    });

    if (!response.ok) {
      const errorData = await parseJsonSafe(response);
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json().catch(() => {
      throw new Error('Invalid response format from server');
    });
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      if (process.env.NODE_ENV === 'development') {
        console.log('Request was cancelled by user');
      }
      throw new Error('Request cancelled');
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('Error sending message to chat API:', error);
    }
    throw error;
  }
};


/**
 * Check the health status of the chat API
 * @param {string} apiUrl - Optional API URL to check health for (defaults to personal assistant)
 * @returns {Promise<Object>} - Health status information
 */
export const checkHealth = async (apiUrl = null) => {
  try {
    const healthUrl = apiUrl ? `${apiUrl}/health` : `${CHAT_API_BASE_URL}/health`;
    if (process.env.NODE_ENV === 'development') {
      console.log('[chatApi] checkHealth called with healthUrl:', healthUrl);
      console.log('[chatApi] CHAT_API_BASE_URL:', CHAT_API_BASE_URL);
    }

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[chatApi] Fetch response received:', response.status, response.ok);
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json().catch(() => {
      throw new Error('Invalid health check response format');
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('[chatApi] Health check data:', data);
    }
    return data;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[chatApi] Error checking chat API health:', error);
    }
    throw error;
  }
};

/**
 * Clear the conversation memory
 * @param {string} sessionId - Optional session ID to clear memory for
 * @returns {Promise<Object>} - Success response
 */
export const clearMemory = async (sessionId = null) => {
  try {
    let url = `${CHAT_API_BASE_URL}/memory`;
    if (sessionId) {
      url += `?session_id=${encodeURIComponent(sessionId)}`;
    }
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await parseJsonSafe(response);
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error clearing chat memory:', error);
    throw error;
  }
};

/**
 * Get the conversation history
 * @returns {Promise<Object>} - Conversation history
 */
export const getConversationHistory = async () => {
  try {
    const response = await fetch(`${CHAT_API_BASE_URL}/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await parseJsonSafe(response);
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting conversation history:', error);
    throw error;
  }
};

/**
 * Get information about available models
 * @returns {Promise<Object>} - Model information
 */
export const getModels = async () => {
  try {
    const response = await fetch(`${CHAT_API_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting model information:', error);
    throw error;
  }
};

/**
 * Check if the chat API is available
 * @returns {Promise<boolean>} - True if API is available, false otherwise
 */
export const isApiAvailable = async () => {
  try {
    await checkHealth();
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Generate a cryptographically secure session ID for conversation tracking
 * Uses crypto.getRandomValues() instead of Math.random() for security
 * @returns {string} - Unique session ID
 */
export const generateSessionId = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const randomHex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  return `session_${Date.now()}_${randomHex}`;
};

/**
 * Remove all messages after a specific index in the conversation history
 * @param {number} messageIndex - Index after which to remove messages (0-based)
 * @param {string} sessionId - Optional session ID
 * @returns {Promise<Object>} - Success response
 */
export const removeMessagesAfterIndex = async (messageIndex, sessionId = null) => {
  try {
    let url = `${CHAT_API_BASE_URL}/history/after/${messageIndex}`;
    if (sessionId) {
      url += `?session_id=${encodeURIComponent(sessionId)}`;
    }
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await parseJsonSafe(response);
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error removing messages after index:', error);
    throw error;
  }
};

/**
 * Update a specific message in the conversation history
 * @param {number} messageIndex - Index of the message to update (0-based)
 * @param {string} newContent - New content for the message
 * @param {string} sessionId - Optional session ID
 * @returns {Promise<Object>} - Success response
 */
export const updateMessageAtIndex = async (messageIndex, newContent, sessionId = null) => {
  try {
    let url = `${CHAT_API_BASE_URL}/history/${messageIndex}`;
    const params = new URLSearchParams();
    params.append('new_content', newContent);
    if (sessionId) {
      params.append('session_id', sessionId);
    }
    url += `?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await parseJsonSafe(response);
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating message at index:', error);
    throw error;
  }
};

/**
 * Send a message to the AI assistant using Server-Sent Events for streaming response
 * @param {string} message - The user's message
 * @param {string} sessionId - Optional session ID for conversation context
 * @param {function} onToken - Callback for each token received
 * @param {function} onComplete - Callback when response is complete
 * @param {function} onError - Callback for errors
 * @returns {EventSource} - The EventSource object for controlling the stream
 */
export const sendMessageStream = (message, sessionId, userId, onToken, onComplete, onError, streamApiUrl = null) => {
  // Build absolute URL (needed for EventSource)
  const baseUrl = streamApiUrl || `${CHAT_API_BASE_URL}/message/stream`;
  const absoluteUrl = buildAbsoluteUrl(baseUrl);

  // Get authentication token from localStorage (with try-catch for private browsing mode)
  let token;
  try {
    token = localStorage.getItem('token');
  } catch (e) {
    if (onError) onError('Storage access denied. Please check browser settings.');
    return null;
  }
  if (!token) {
    if (onError) onError('Not authenticated. Please log in.');
    return null;
  }

  const url = new URL(absoluteUrl);
  url.searchParams.append('message', message);
  url.searchParams.append('token', token); // Add JWT token for authentication
  if (sessionId) {
    url.searchParams.append('session_id', sessionId);
  }
  // Note: userId is no longer needed as a parameter - it's extracted from the JWT token on the backend

  const eventSource = new EventSource(url.toString());

  // Track connection state for better error handling
  let connectionOpened = false;
  let connectionTimeout = null;
  const CONNECTION_TIMEOUT_MS = 30000; // 30 second timeout for initial connection

  // Helper function to properly cleanup and close EventSource
  // Prevents memory leak by always clearing the timeout
  const cleanupAndClose = () => {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }
    eventSource.close();
  };

  // Set up connection timeout
  connectionTimeout = setTimeout(() => {
    if (!connectionOpened) {
      cleanupAndClose();
      if (onError) onError('Connection timeout. The server took too long to respond.');
    }
  }, CONNECTION_TIMEOUT_MS);

  // Cache DOM element reference to avoid repeated queries (performance optimization)
  let cachedCareerAgentElement = null;
  const getCareerAgentElement = () => {
    if (!cachedCareerAgentElement) {
      cachedCareerAgentElement = document.querySelector('[data-agent-type="career"]');
    }
    return cachedCareerAgentElement;
  };

  // Helper to dispatch career agent events (reduces code duplication)
  const dispatchCareerEvent = (eventName, detail) => {
    const element = getCareerAgentElement();
    if (element) {
      element.dispatchEvent(new CustomEvent(eventName, { detail }));
      if (process.env.NODE_ENV === 'development') {
        console.log(`${eventName} event dispatched:`, detail.section || detail.progress || 'complete');
      }
    }
  };

  // Handle incoming messages
  eventSource.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'token':
          if (onToken) onToken(data.content);
          break;
        case 'complete':
          if (onComplete) onComplete(data.content, null, data.follow_up_questions);
          cleanupAndClose();
          break;
        case 'error':
          if (onError) onError(data.content);
          cleanupAndClose();
          break;
        case 'message':
          // Initial assistant message is complete; treat it as a final response, not streaming
          if (onComplete) onComplete(data.content);
          break;
        case 'career_insights':
          // Handle career insights data
          if (onComplete) onComplete(data.message, data.professional_data, data.follow_up_questions);
          cleanupAndClose();
          break;
        case 'section_complete':
          // Handle section completion and dispatch DOM event
          if (data.section && data.data) {
            dispatchCareerEvent('sectionComplete', {
              section: data.section,
              data: data.data,
              error: data.error || null
            });
          }
          break;
        case 'section_start':
          // Handle section start and dispatch DOM event
          if (data.section) {
            dispatchCareerEvent('sectionStart', {
              section: data.section,
              display_name: data.display_name,
              description: data.description,
              progress: data.progress || 0
            });
          }
          break;
        case 'analysis_progress':
          // Handle analysis progress and dispatch DOM event
          dispatchCareerEvent('analysisProgress', {
            progress: data.progress,
            currentSection: data.current_section,
            message: data.message,
            status: data.status || 'analyzing'
          });
          break;
        case 'analysis_complete':
          // Handle analysis completion
          dispatchCareerEvent('analysisComplete', {
            success: !data.error,
            professional_data: data.professional_data,
            message: data.message,
            performance_metrics: data.performance_metrics
          });
          if (onComplete) onComplete(data.message, data.professional_data, data.follow_up_questions);
          cleanupAndClose();
          break;
        default:
          if (process.env.NODE_ENV === 'development') {
            console.warn('Unknown message type:', data.type);
          }
      }
    } catch (error) {
      console.error('Error parsing SSE data:', error);
      if (onError) onError('Error parsing response data');
      cleanupAndClose();
    }
  });

  // Handle connection errors
  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);

    // Determine error type based on connection state
    let errorMessage;
    if (!connectionOpened) {
      // Connection never opened - likely auth failure or server unreachable
      errorMessage = 'Unable to connect. Please check your authentication and try again.';
    } else if (eventSource.readyState === EventSource.CLOSED) {
      // Connection was open but closed unexpectedly
      errorMessage = 'Connection lost. The server closed the connection unexpectedly.';
    } else {
      // Connection error while still trying to connect
      errorMessage = 'Connection error. Please check your network and try again.';
    }

    if (onError) onError(errorMessage);
    cleanupAndClose();
  };

  // Handle connection open
  eventSource.onopen = () => {
    connectionOpened = true;
    // Clear the connection timeout since we connected successfully
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('SSE connection established');
    }
  };

  return eventSource;
};

/**
 * Handle API errors and provide user-friendly messages
 * Uses generic messages to prevent sensitive information leakage
 * @param {Error} error - The error object
 * @returns {string} - User-friendly error message
 */
export const handleApiError = (error) => {
  // Log actual error for debugging (not exposed to users)
  console.error('API error:', error.message);

  if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    return 'Unable to connect to the service. Please check your connection.';
  }

  if (error.message.includes('500')) {
    return 'Service temporarily unavailable. Please try again later.';
  }

  if (error.message.includes('401') || error.message.includes('403')) {
    return 'Authentication required. Please log in again.';
  }

  if (error.message.includes('400')) {
    return 'Invalid request. Please check your input.';
  }

  if (error.message.includes('404')) {
    return 'Resource not found.';
  }

  // Generic fallback - never expose raw error messages
  return 'An unexpected error occurred. Please try again.';
};

/**
 * Retrieve stored career insights for a specific user
 * @param {number} userId - The user ID to retrieve career insights for
 * @returns {Promise<Object>} - The career insights response object
 */
export const getCareerInsights = async (userId) => {
  try {
    // Validate user ID
    if (!userId || typeof userId !== 'number') {
      throw new Error('Valid user ID is required');
    }

    // Get authentication token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${CAREER_API_BASE_URL}/insights/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await parseJsonSafe(response);
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving career insights:', error);
    throw error;
  }
};

/**
 * Retrieve career insights for a specific resume
 * @param {number} resumeId - The resume ID to retrieve career insights for
 * @returns {Promise<Object>} - The career insights response object
 *
 * Note: Authorization is handled via JWT token. Backend verifies the resume
 * belongs to the authenticated user before returning data.
 */
export const getCareerInsightsByResume = async (resumeId) => {
  try {
    // Validate parameters
    if (!resumeId || typeof resumeId !== 'number') {
      throw new Error('Valid resume ID is required');
    }

    // Get authentication token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    // Backend uses authenticated user from JWT token for authorization
    const response = await fetch(`${CAREER_API_BASE_URL}/insights/resume/${resumeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await parseJsonSafe(response);
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error retrieving career insights by resume:', error);
    throw error;
  }
};

/**
 * Check if career insights exist for a user
 * @param {number} userId - The user ID to check
 * @returns {Promise<boolean>} - True if career insights exist, false otherwise
 */
export const hasCareerInsights = async (userId) => {
  try {
    const response = await getCareerInsights(userId);
    return response.success && response.has_data;
  } catch (error) {
    console.error('Error checking career insights existence:', error);
    return false;
  }
};