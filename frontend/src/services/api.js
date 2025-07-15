import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: add token
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

// Authentication related API
export const auth = {
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
  saveMessage: async (messageText, sender) => {
    const response = await api.post('/chat/messages', {
      message_text: messageText,
      sender: sender
    });
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