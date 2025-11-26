import axios from 'axios'


const API_URL = '/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== RATE LIMITER ====================
// Prevents brute force attacks with exponential backoff
const rateLimiter = {
  attempts: new Map(), // endpoint -> { count, lastAttempt, blockedUntil }

  canProceed(endpoint) {
    const now = Date.now();
    const state = this.attempts.get(endpoint);
    if (!state) return { allowed: true };
    if (state.blockedUntil && now < state.blockedUntil) {
      const waitSeconds = Math.ceil((state.blockedUntil - now) / 1000);
      return { allowed: false, waitSeconds };
    }
    return { allowed: true };
  },

  recordFailure(endpoint) {
    const now = Date.now();
    const state = this.attempts.get(endpoint) || { count: 0, lastAttempt: 0 };
    // Reset if last attempt was 5+ minutes ago
    if (now - state.lastAttempt > 300000) state.count = 0;
    state.count++;
    state.lastAttempt = now;
    // Block after 5 failures: 30s, 60s, 120s... (max 5 min)
    if (state.count >= 5) {
      state.blockedUntil = now + Math.min(30000 * Math.pow(2, state.count - 5), 300000);
    }
    this.attempts.set(endpoint, state);
  },

  recordSuccess(endpoint) {
    this.attempts.delete(endpoint);
  }
};

// Request interceptor: add token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue = [];
let isLoggingOut = false; // Prevent multiple simultaneous logout calls

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Centralized logout function to prevent race conditions
const handleAuthenticationFailure = () => {
  if (isLoggingOut) {
    return; // Already logging out, prevent duplicate calls
  }
  isLoggingOut = true;

  console.warn('Authentication failure detected, logging out user');

  // Clear token and user state
  auth.logout();

  // Redirect to login page immediately
  // Note: isLoggingOut will be reset when page reloads
  window.location.href = '/login';
};

// Response interceptor: handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip token refresh for login and refresh endpoints
    const isLoginEndpoint = originalRequest.url && originalRequest.url.includes('/auth/token');
    const isRefreshEndpoint = originalRequest.url && originalRequest.url.includes('/auth/token/refresh');
    const isSignupEndpoint = originalRequest.url && originalRequest.url.includes('/auth/signup');
    const isLogoutEndpoint = originalRequest.url && originalRequest.url.includes('/auth/logout');
    const isVerificationEndpoint = originalRequest.url && (
      originalRequest.url.includes('/auth/verify-registration') ||
      originalRequest.url.includes('/auth/resend-verification-otp') ||
      originalRequest.url.includes('/auth/reset-password')
    );

    // Skip interceptor for auth-related endpoints
    // For logout: if token is expired, just proceed with local cleanup
    if (isLoginEndpoint || isRefreshEndpoint || isSignupEndpoint || isLogoutEndpoint || isVerificationEndpoint) {
      return Promise.reject(error);
    }

    // If it's a 401 error and not already retried, and not an auth endpoint
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({resolve, reject});
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise(function (resolve, reject) {
        const refreshToken = localStorage.getItem('refresh_token');

        // Check if refresh token exists before attempting refresh
        if (!refreshToken) {
          console.warn('No refresh token available, cannot refresh access token');
          isRefreshing = false;
          processQueue(new Error('No refresh token'), null);
          handleAuthenticationFailure();
          reject(new Error('No refresh token available'));
          return;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('Access token expired, refreshing...');
        }

        auth.refreshToken().then(data => {
          const newToken = data.access_token;
          // Validate token before using
          if (typeof newToken !== 'string' || newToken.length === 0) {
            throw new Error('Invalid token received from refresh');
          }
          if (process.env.NODE_ENV === 'development') {
            console.log('Token refresh successful');
          }
          api.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
          originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
          // Reset isRefreshing before processQueue to prevent race conditions
          isRefreshing = false;
          processQueue(null, newToken);
          resolve(api(originalRequest));
        }).catch((err) => {
          console.error('Token refresh failed:', err.response?.data?.detail || err.message);
          isRefreshing = false;
          processQueue(err, null);
          handleAuthenticationFailure(); // Use centralized logout function
          reject(err);
        });
      });
    }

    // For refresh token endpoint failures or other errors, logout immediately
    if (error.response && error.response.status === 401 && originalRequest.url && originalRequest.url.includes('/auth/token/refresh')) {
      handleAuthenticationFailure(); // Use centralized logout function
    }

    return Promise.reject(error);
  }
);

// Authentication related API
export const auth = {
  // Refresh token using refresh token (not access token)
  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // Note: This endpoint does NOT require Authorization header
    // It uses the refresh token in the request body instead
    const response = await axios.post(`${API_URL}/auth/token/refresh`, {
      refresh_token: refreshToken
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Store both new tokens with validation
    const accessToken = response.data.access_token;
    const refreshTokenNew = response.data.refresh_token;

    if (typeof accessToken === 'string' && accessToken.length > 0) {
      localStorage.setItem('token', accessToken);
    } else {
      throw new Error('Invalid access token received');
    }
    if (typeof refreshTokenNew === 'string' && refreshTokenNew.length > 0) {
      localStorage.setItem('refresh_token', refreshTokenNew);
    }

    return response.data;
  },

  // User registration with rate limiting
  register: async (first_name, last_name, email, password) => {
    const endpoint = 'register';
    const { allowed, waitSeconds } = rateLimiter.canProceed(endpoint);
    if (!allowed) {
      throw new Error(`Too many registration attempts. Please wait ${waitSeconds} seconds.`);
    }

    try {
      const response = await api.post('/auth/signup', { first_name, last_name, email, password });
      rateLimiter.recordSuccess(endpoint);
      return response.data;
    } catch (error) {
      rateLimiter.recordFailure(endpoint);
      throw error;
    }
  },
  
  
  verifyRegistrationOTP: async (email, otp) => {
    const response = await api.post('/auth/verify-registration', { email, otp });
    return response.data;
  },

  // Resend registration OTP
resendRegistrationOTP: async (email) => {
  const response = await api.post('/auth/resend-verification-otp', { email });
  return response.data;
},

  // Get user profile
  getProfile: async (token) => {
    const response = await api.get('/profile/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  // User login with rate limiting
  login: async (email, password) => {
    const endpoint = 'login';
    const { allowed, waitSeconds } = rateLimiter.canProceed(endpoint);
    if (!allowed) {
      throw new Error(`Too many login attempts. Please wait ${waitSeconds} seconds.`);
    }

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      // Store tokens on success with validation
      const accessToken = response.data.access_token;
      const refreshTokenVal = response.data.refresh_token;

      if (typeof accessToken === 'string' && accessToken.length > 0) {
        localStorage.setItem('token', accessToken);
      } else {
        throw new Error('Invalid access token received');
      }
      if (typeof refreshTokenVal === 'string' && refreshTokenVal.length > 0) {
        localStorage.setItem('refresh_token', refreshTokenVal);
      }

      rateLimiter.recordSuccess(endpoint);
      return response.data;
    } catch (error) {
      rateLimiter.recordFailure(endpoint);
      throw error;
    }
  },

  // Password Reset Request
  resetPasswordRequest: async (email) => {
    const response = await api.post('/auth/reset-password-request', { email });
    return response.data;
  },

  
  verifyPasswordOTP: async (email, otp, newPassword) => {
    const response = await api.post('/auth/reset-password-confirm', { 
      email, 
      otp, 
      new_password: newPassword 
    });
    return response.data;
  },

  // Logout with retry mechanism for server-side token revocation
  logout: async () => {
    const maxRetries = 2;
    let serverRevoked = false;

    // Attempt server-side token revocation with retries
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await api.post('/auth/logout');
        serverRevoked = true;
        break;
      } catch (error) {
        // Only retry on network errors, not auth errors
        const isNetworkError = !error.response;
        const isAuthError = error.response?.status === 401;

        if (isAuthError) {
          // Token already invalid - no need to revoke
          serverRevoked = true;
          break;
        }

        if (attempt === maxRetries || !isNetworkError) {
          // Final attempt failed or non-retryable error
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Server token revocation failed after ${attempt} attempt(s)`);
          }
          break;
        }

        // Wait before retry (exponential backoff: 500ms, 1000ms)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }

    // Always clear local storage for security
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');

    return { serverRevoked };
  },

  // Upload resume
  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/auth/upload-resume', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getResumes: async () => {
    const response = await api.get('/auth/resumes');
    return response.data;
  },

  deleteResume: async (resumeId) => {
    const response = await api.delete(`/auth/resumes/${resumeId}`);
    return response.data;
  },
};

// Chat related API
export const chat = {
  // Save chat message
  saveMessage: async (messageText, sender, sessionId = null, agentType = 'dashboard') => {
    const payload = {
      message_text: messageText,
      sender: sender,
      agent_type: agentType,
    };
    if (sessionId) {
      payload.session_id = sessionId;
    }
    const response = await api.post('/chat/messages', payload);
    return response.data;
  },

  // Get chat history
  getHistory: async (sessionId = null, limit = 50, offset = 0) => {
    let url = `/chat/messages?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
    if (sessionId) {
      url += `&session_id=${encodeURIComponent(sessionId)}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  // Clear chat history
  clearHistory: async () => {
    const response = await api.delete('/chat/messages');
    return response.data;
  },

  // Update a specific message
  updateMessage: async (messageId, messageText) => {
    const response = await api.put(`/chat/messages/${messageId}`, {
      message_text: messageText
    });
    return response.data;
  },

  // Delete messages after a specific index
  deleteMessagesAfterIndex: async (messageIndex) => {
    const response = await api.delete(`/chat/messages/after/${messageIndex}`);
    return response.data;
  },

  // Optimize query
  optimizeQuery: async (query) => {
    // Use relative path in production (proxied through Nginx), localhost in development
    const apiUrl = process.env.NODE_ENV === 'production'
      ? '/api/pa/optimize'
      : (process.env.REACT_APP_PA_URL || 'http://localhost:6001') + '/api/chat/optimize';

    const response = await axios.post(apiUrl,
      { query: query },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }
};

// Session related API
export const sessions = {
  // Create new session
  createSession: async (sessionName, firstMessageTime) => {
    // The backend marks the newly created session as active, so create it first and then fetch the active session details
    await api.post('/chat/sessions', {
      session_name: sessionName,
      first_message_time: firstMessageTime
    });
    const activeSessionResponse = await api.get('/chat/sessions/active');
    return activeSessionResponse.data;
  },

  // Get all user sessions
  getSessions: async () => {
    const response = await api.get('/chat/sessions');
    return response.data;
  },

  // Get messages for a specific session
  getSessionMessages: async (sessionId) => {
    const response = await api.get(`/chat/sessions/${sessionId}/messages`);
    return response.data;
  },

  // Activate a session
  activateSession: async (sessionId) => {
    const response = await api.put(`/chat/sessions/${sessionId}/activate`);
    return response.data;
  },

  // Get active session
  getActiveSession: async () => {
    const response = await api.get('/chat/sessions/active');
    return response.data;
  },

  // Delete a session
  deleteSession: async (sessionId) => {
    const response = await api.delete(`/chat/sessions/${sessionId}`);
    return response.data;
  },

  // Update session name
  updateSessionName: async (sessionId, sessionName) => {
    const response = await api.put(`/chat/sessions/${sessionId}/name`, {
      session_name: sessionName
    });
    return response.data;
  },

  // Mark a session as read
  markSessionAsRead: async (sessionId) => {
    const response = await api.put(`/chat/sessions/${sessionId}/read`);
    return response.data;
  },

  // Mark a session as unread
  markSessionAsUnread: async (sessionId) => {
    const response = await api.put(`/chat/sessions/${sessionId}/unread`);
    return response.data;
  },

  // Get count of unread sessions
  getUnreadSessionsCount: async () => {
    const response = await api.get('/chat/sessions/unread/count');
    return response.data;
  }
}

// Profile related API
export const profile = {
  // Get current user with profile
  getCurrentUser: async () => {
    const response = await api.get('/profile/me');
    return response.data;
  },

  // Get user profile
  getProfile: async () => {
    const response = await api.get('/profile/profile');
    return response.data;
  },

  // Create or update profile
  saveProfile: async (profileData) => {
    const response = await api.post('/profile/profile', profileData);
    return response.data;
  },

  // Update profile (alias for saveProfile)
  updateProfile: async (profileData) => {
    const response = await api.post('/profile/profile', profileData);
    return response.data;
  },

  // Change password
  changePassword: async (passwordData) => {
    const response = await api.put('/profile/password', passwordData);
    return response.data;
  },

  // Upload avatar
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete avatar
  deleteAvatar: async () => {
    const response = await api.delete('/profile/avatar');
    return response.data;
  },

  // Get avatar URL
  getAvatarUrl: async () => {
    const response = await api.get('/profile/avatar');
    return response.data;
  }
};

// Activities related API
export const activities = {
  // Get recent activities
  getRecentActivities: async (limit = 1000) => {
    const response = await api.get(`/activities/recent?limit=${limit}`);
    return response.data;
  },

  // Get all user activities with filtering
  getUserActivities: async (options = {}) => {
    const {
      limit = 1000,
      offset = 0,
      activityType = null,
      activitySource = null,
      daysBack = 30
    } = options;

    let url = `/activities/?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}&days_back=${encodeURIComponent(daysBack)}`;
    if (activityType) url += `&activity_type=${encodeURIComponent(activityType)}`;
    if (activitySource) url += `&activity_source=${encodeURIComponent(activitySource)}`;

    const response = await api.get(url);
    return response.data;
  },

  // Get activity summary
  getActivitySummary: async (daysBack = 7) => {
    const response = await api.get(`/activities/summary?days_back=${encodeURIComponent(daysBack)}`);
    return response.data;
  },

  // Get comprehensive usage analytics
  getUsageAnalytics: async (daysBack = 30) => {
    const response = await api.get(`/activities/analytics?days_back=${encodeURIComponent(daysBack)}`);
    return response.data;
  },

  // Create a new activity
  createActivity: async (activityData) => {
    const response = await api.post('/activities/', activityData);
    return response.data;
  },

  // Track specific activity types
  trackChatActivity: async (source, sessionId = null, messageId = null, agentType = null) => {
    let url = `/activities/track/chat?source=${encodeURIComponent(source)}`;
    if (sessionId) url += `&session_id=${encodeURIComponent(sessionId)}`;
    if (messageId) url += `&message_id=${encodeURIComponent(messageId)}`;
    if (agentType) url += `&agent_type=${encodeURIComponent(agentType)}`;

    const response = await api.post(url);
    return response.data;
  },

  trackResumeAnalysis: async (resumeFilename = null) => {
    let url = '/activities/track/resume-analysis';
    if (resumeFilename) url += `?resume_filename=${encodeURIComponent(resumeFilename)}`;

    const response = await api.post(url);
    return response.data;
  },

  trackAgentInteraction: async (agentType, interactionType = 'general') => {
    const response = await api.post(`/activities/track/agent-interaction?agent_type=${encodeURIComponent(agentType)}&interaction_type=${encodeURIComponent(interactionType)}`);
    return response.data;
  }
};

// Career Insights related API
export const careerInsights = {
  // Get career insights summary for dashboard
  getSummary: async () => {
    const response = await api.get('/career-insights/summary');
    return response.data;
  },

  // Get latest career insight data
  getLatest: async () => {
    const response = await api.get('/career-insights/latest');
    return response.data;
  },

  // Get all career insights
  getAll: async (limit = 10) => {
    const response = await api.get(`/career-insights/all?limit=${encodeURIComponent(limit)}`);
    return response.data;
  }
};

// Daily Recommendations related API
export const dailyRecommendations = {
  // Get today's recommendations (or generate if not exists)
  getRecommendations: async (date = null) => {
    let url = '/daily-recommendations';
    if (date) url += `?date=${encodeURIComponent(date)}`;

    const response = await api.get(url);
    return response.data;
  },

  // Force generate new recommendations for today
  generateRecommendations: async () => {
    const response = await api.post('/daily-recommendations/generate');
    return response.data;
  },

  // Get recommendations history
  getHistory: async (limit = 7) => {
    const response = await api.get(`/daily-recommendations/history?limit=${encodeURIComponent(limit)}`);
    return response.data;
  }
};

// ==================== STREAMING FETCH HELPER ====================
// For streaming endpoints that require ReadableStream (can't use axios)
// Provides consistent token handling and 401 error management
export const streamingFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  // Handle 401 by triggering auth failure flow
  if (response.status === 401) {
    // Try to refresh token first
    try {
      await auth.refreshToken();
      // Retry with new token
      const newToken = localStorage.getItem('token');
      return fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
          ...options.headers,
        },
      });
    } catch {
      // Refresh failed, redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
      throw new Error('Authentication failed');
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
};

export default api;