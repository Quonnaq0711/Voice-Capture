import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

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

// Response interceptor: handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
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
          auth.logout();
          window.location.href = '/login';
          reject(err);
        }).finally(() => {
          isRefreshing = false;
        });
      });
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
  register: async (username, email, password) => {
    const response = await api.post('/auth/signup', { username, email, password });
    return response.data;
  },

  // User login
  login: async (email, password) => {
    const formData = new FormData();
    formData.append('username', email);
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
  saveMessage: async (messageText, sender, sessionId = null) => {
    const payload = {
      message_text: messageText,
      sender: sender,
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
  }
};

// Session related API
export const sessions = {
  // Create new session
  createSession: async (sessionName, firstMessageTime) => {
    const response = await api.post('/chat/sessions', {
      session_name: sessionName,
      first_message_time: firstMessageTime
    });
    return response.data;
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

export default api;