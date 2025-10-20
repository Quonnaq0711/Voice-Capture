import axios from 'axios'


const API_URL = '/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

  // Clear token and user state
  auth.logout();

  // Redirect to login page
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
    const isVerificationEndpoint = originalRequest.url && (
      originalRequest.url.includes('/auth/verify-registration') ||
      originalRequest.url.includes('/auth/resend-verification-otp') ||
      originalRequest.url.includes('/auth/reset-password')
    );

    // Skip interceptor for auth-related endpoints
    if (isLoginEndpoint || isRefreshEndpoint || isSignupEndpoint || isVerificationEndpoint) {
      return Promise.reject(error);
    }

    // If it's a 401 error and not already retried, and not an auth endpoint
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
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
        auth.refreshToken().then(data => {
          const newToken = data.access_token;
          api.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
          originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
          processQueue(null, newToken);
          resolve(api(originalRequest));
        }).catch((err) => {
          processQueue(err, null);
          handleAuthenticationFailure(); // Use centralized logout function
          reject(err);
        }).finally(() => {
          isRefreshing = false;
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
  // Refresh token
  refreshToken: async () => {
    const response = await api.post('/auth/token/refresh');
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    }
    return response.data;
  },

  // User registration
  register: async (first_name, last_name, email, password) => {
    const response = await api.post('/auth/signup', { first_name, last_name, email, password });
    return response.data;
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

  // User login
  login: async (email, password) => {
    const formData = new FormData();
    formData.append('username', email);  // OAuth2 standard uses 'username' field (contains email)
    formData.append('password', password);

    const response = await api.post('/auth/token', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
    }
    return response.data;
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

  // Logout
  logout: () => {
    localStorage.removeItem('token');
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
    let url = `/chat/messages?limit=${limit}&offset=${offset}`;
    if (sessionId) {
      url += `&session_id=${sessionId}`;
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
      : 'http://localhost:8001/api/chat/optimize';

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
  getRecentActivities: async (limit = 10) => {
    const response = await api.get(`/activities/recent?limit=${limit}`);
    return response.data;
  },

  // Get all user activities with filtering
  getUserActivities: async (options = {}) => {
    const {
      limit = 20,
      offset = 0,
      activityType = null,
      activitySource = null,
      daysBack = 30
    } = options;

    let url = `/activities/?limit=${limit}&offset=${offset}&days_back=${daysBack}`;
    if (activityType) url += `&activity_type=${activityType}`;
    if (activitySource) url += `&activity_source=${activitySource}`;

    const response = await api.get(url);
    return response.data;
  },

  // Get activity summary
  getActivitySummary: async (daysBack = 7) => {
    const response = await api.get(`/activities/summary?days_back=${daysBack}`);
    return response.data;
  },

  // Create a new activity
  createActivity: async (activityData) => {
    const response = await api.post('/activities/', activityData);
    return response.data;
  },

  // Track specific activity types
  trackChatActivity: async (source, sessionId = null, messageId = null, agentType = null) => {
    let url = `/activities/track/chat?source=${source}`;
    if (sessionId) url += `&session_id=${sessionId}`;
    if (messageId) url += `&message_id=${messageId}`;
    if (agentType) url += `&agent_type=${agentType}`;

    const response = await api.post(url);
    return response.data;
  },

  trackResumeAnalysis: async (resumeFilename = null) => {
    let url = '/activities/track/resume-analysis';
    if (resumeFilename) url += `?resume_filename=${resumeFilename}`;

    const response = await api.post(url);
    return response.data;
  },

  trackAgentInteraction: async (agentType, interactionType = 'general') => {
    const response = await api.post(`/activities/track/agent-interaction?agent_type=${agentType}&interaction_type=${interactionType}`);
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
    const response = await api.get(`/career-insights/all?limit=${limit}`);
    return response.data;
  }
};

// Daily Recommendations related API
export const dailyRecommendations = {
  // Get today's recommendations (or generate if not exists)
  getRecommendations: async (date = null) => {
    let url = '/daily-recommendations';
    if (date) url += `?date=${date}`;

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
    const response = await api.get(`/daily-recommendations/history?limit=${limit}`);
    return response.data;
  }
};

export default api;