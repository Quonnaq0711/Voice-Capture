/**
 * Chat API service for communicating with the Personal Assistant Chat API
 * Handles all HTTP requests to the chat backend running on localhost:8001
 */

const CHAT_API_BASE_URL = 'http://localhost:8001/api/chat';

/**
 * Send a message to the AI assistant and get a response
 * @param {string} message - The user's message
 * @param {string} sessionId - Optional session ID for conversation context
 * @param {AbortSignal} signal - Optional abort signal for cancelling the request
 * @returns {Promise<Object>} - The AI response object
 */
export const sendMessage = async (message, sessionId = null, signal = null) => {
  try {
    const response = await fetch(`${CHAT_API_BASE_URL}/message`, {
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
 * @returns {Promise<Object>} - Health status information
 */
export const checkHealth = async () => {
  try {
    const response = await fetch(`${CHAT_API_BASE_URL}/health`, {
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
export const sendMessageStream = (message, sessionId, userId, onToken, onComplete, onError) => {
  const url = new URL(`${CHAT_API_BASE_URL}/message/stream`);
  url.searchParams.append('message', message);
  if (sessionId) {
    url.searchParams.append('session_id', sessionId);
  }
  if (userId) {
    url.searchParams.append('user_id', userId);
  }

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
          if (onComplete) onComplete(data.content);
          eventSource.close();
          break;
        case 'error':
          if (onError) onError(data.content);
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