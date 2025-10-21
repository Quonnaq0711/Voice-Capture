/**
 * Chat API service for communicating with the Personal Assistant Chat API
 * Handles all HTTP requests to the chat backend running on localhost:8001
 */

// Use relative paths for API calls (proxied through Nginx)
// In production: /api/pa/ -> http://idii-PA-staging:8001/api/chat/
// In development: Use environment variables or fallback to dev ports
const CHAT_API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api/pa'  // Proxied through Nginx in production
  : (process.env.REACT_APP_PA_URL ? `${process.env.REACT_APP_PA_URL}/api/chat` : 'http://localhost:6001/api/chat');  // Dev mode: port 6001

const CAREER_API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api/career'  // Proxied through Nginx in production
  : (process.env.REACT_APP_CAREER_URL ? `${process.env.REACT_APP_CAREER_URL}/api/chat` : 'http://localhost:6002/api/chat');  // Dev mode: port 6002

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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request was cancelled by user');
      throw new Error('Request cancelled');
    }
    console.error('Error sending message to chat API:', error);
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
    const response = await fetch(healthUrl, {
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
    console.error('Error checking chat API health:', error);
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
      const errorData = await response.json().catch(() => ({}));
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
      const errorData = await response.json().catch(() => ({}));
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
 * Generate a session ID for conversation tracking
 * @returns {string} - Unique session ID
 */
export const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      const errorData = await response.json().catch(() => ({}));
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
      const errorData = await response.json().catch(() => ({}));
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

  // Get authentication token from localStorage
  const token = localStorage.getItem('token');
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
          eventSource.close();
          break;
        case 'error':
          if (onError) onError(data.content);
          eventSource.close();
          break;
        case 'message':
          // Initial assistant message is complete; treat it as a final response, not streaming
          if (onComplete) onComplete(data.content);
          break;
        case 'career_insights':
          // Handle career insights data
          if (onComplete) onComplete(data.message, data.professional_data, data.follow_up_questions);
          eventSource.close();
          break;
        case 'section_complete':
          // Handle section completion and dispatch DOM event
          const careerAgentElement = document.querySelector('[data-agent-type="career"]');
          if (careerAgentElement && data.section && data.data) {
            const sectionCompleteEvent = new CustomEvent('sectionComplete', {
              detail: {
                section: data.section,
                data: data.data,
                error: data.error || null
              }
            });
            careerAgentElement.dispatchEvent(sectionCompleteEvent);
            console.log('Section complete event dispatched:', data.section);
          }
          break;
        case 'section_start':
          // Handle section start and dispatch DOM event
          const careerAgentStartElement = document.querySelector('[data-agent-type="career"]');
          if (careerAgentStartElement && data.section) {
            const sectionStartEvent = new CustomEvent('sectionStart', {
              detail: {
                section: data.section,
                display_name: data.display_name,
                description: data.description,
                progress: data.progress || 0
              }
            });
            careerAgentStartElement.dispatchEvent(sectionStartEvent);
            console.log('Section start event dispatched:', data.section);
          }
          break;
        case 'analysis_progress':
          // Handle analysis progress and dispatch DOM event
          const careerAgentProgressElement = document.querySelector('[data-agent-type="career"]');
          if (careerAgentProgressElement) {
            const progressEvent = new CustomEvent('analysisProgress', {
              detail: {
                progress: data.progress,
                currentSection: data.current_section,
                message: data.message,
                status: data.status || 'analyzing'
              }
            });
            careerAgentProgressElement.dispatchEvent(progressEvent);
          }
          break;
        case 'analysis_complete':
          // Handle analysis completion
          const careerAgentCompleteElement = document.querySelector('[data-agent-type="career"]');
          if (careerAgentCompleteElement) {
            const completeEvent = new CustomEvent('analysisComplete', {
              detail: {
                success: !data.error,
                professional_data: data.professional_data,
                message: data.message,
                performance_metrics: data.performance_metrics
              }
            });
            careerAgentCompleteElement.dispatchEvent(completeEvent);
          }
          if (onComplete) onComplete(data.message, data.professional_data, data.follow_up_questions);
          eventSource.close();
          break;
        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing SSE data:', error);
      if (onError) onError('Error parsing response data');
      eventSource.close();
    }
  });

  // Handle connection errors
  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    if (eventSource.readyState === EventSource.CLOSED) {
      console.log('SSE connection was closed');
      // Check if this might be an authentication error (EventSource doesn't expose status codes)
      // If the connection closes immediately, it's likely a 401/403
      if (onError) {
        onError('Connection error occurred. This may be due to authentication failure or network issues.');
      }
    } else {
      if (onError) onError('Connection error occurred');
    }
    eventSource.close();
  };

  // Handle connection open
  eventSource.onopen = () => {
    console.log('SSE connection established');
  };

  return eventSource;
};

/**
 * Handle API errors and provide user-friendly messages
 * @param {Error} error - The error object
 * @returns {string} - User-friendly error message
 */
export const handleApiError = (error) => {
  if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    return 'Unable to connect to the chat service. Please make sure the chat API is running on localhost:8001.';
  }
  
  if (error.message.includes('500')) {
    return 'The chat service is experiencing issues. Please try again in a moment.';
  }
  
  if (error.message.includes('400')) {
    return 'Invalid message format. Please check your input and try again.';
  }
  
  return error.message || 'An unexpected error occurred. Please try again.';
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
      const errorData = await response.json().catch(() => ({}));
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
      const errorData = await response.json().catch(() => ({}));
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