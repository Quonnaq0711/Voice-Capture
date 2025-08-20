// Mock axios before importing anything
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn(),
      },
      response: {
        use: jest.fn(),
      },
    },
  };

  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    },
    create: jest.fn(() => mockAxiosInstance),
  };
});

const axios = require('axios');
const { auth, chat, sessions, profile } = require('../src/services/api');

// Get the mocked axios instance
const mockAxiosInstance = axios.default.create();

describe('API Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Auth API', () => {
    describe('register', () => {
      it('should register a new user successfully', async () => {
        const mockResponse = {
          data: {
            message: 'User registered successfully',
            user_id: 1,
          },
        };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await auth.register('testuser', 'test@example.com', 'password123');

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/signup', {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });
        expect(result).toEqual(mockResponse.data);
      });

      it('should handle registration error', async () => {
        const mockError = new Error('Registration failed');
        mockAxiosInstance.post.mockRejectedValue(mockError);

        await expect(auth.register('testuser', 'test@example.com', 'password123'))
          .rejects.toThrow('Registration failed');
      });
    });

    describe('login', () => {
      it('should login user successfully and store token', async () => {
        const mockResponse = {
          data: {
            access_token: 'mock-token-123',
            token_type: 'bearer',
          },
        };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await auth.login('test@example.com', 'password123');

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/auth/token',
          expect.any(FormData),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
        expect(localStorage.setItem).toHaveBeenCalledWith('token', 'mock-token-123');
        expect(result).toEqual(mockResponse.data);
      });

      it('should handle login error', async () => {
        const mockError = new Error('Invalid credentials');
        mockAxiosInstance.post.mockRejectedValue(mockError);

        await expect(auth.login('test@example.com', 'wrongpassword'))
          .rejects.toThrow('Invalid credentials');
      });
    });

    describe('logout', () => {
      it('should remove token from localStorage', () => {
        auth.logout();
        expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      });
    });

    describe('uploadResume', () => {
      it('should upload resume file successfully', async () => {
        const mockFile = new File(['resume content'], 'resume.pdf', { type: 'application/pdf' });
        const mockResponse = {
          data: {
            message: 'Resume uploaded successfully',
            resume_id: 1,
          },
        };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await auth.uploadResume(mockFile);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/auth/upload-resume',
          expect.any(FormData),
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
        expect(result).toEqual(mockResponse.data);
      });
    });
  });

  describe('Chat API', () => {
    describe('saveMessage', () => {
      it('should save chat message successfully', async () => {
        const mockResponse = {
          data: {
            id: 1,
            message_text: 'Hello, world!',
            sender: 'user',
          },
        };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await chat.saveMessage('Hello, world!', 'user');

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/messages', {
          message_text: 'Hello, world!',
          sender: 'user',
        });
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('getHistory', () => {
      it('should get chat history with default parameters', async () => {
        const mockResponse = {
          data: {
            messages: [],
            total: 0,
          },
        };
        mockAxiosInstance.get.mockResolvedValue(mockResponse);

        const result = await chat.getHistory();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/chat/messages?limit=50&offset=0');
        expect(result).toEqual(mockResponse.data);
      });

      it('should get chat history with session ID', async () => {
        const mockResponse = {
          data: {
            messages: [],
            total: 0,
          },
        };
        mockAxiosInstance.get.mockResolvedValue(mockResponse);

        const result = await chat.getHistory('session-123', 20, 10);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
          '/chat/messages?limit=20&offset=10&session_id=session-123'
        );
        expect(result).toEqual(mockResponse.data);
      });
    });
  });

  describe('Sessions API', () => {
    describe('createSession', () => {
      it('should create new session successfully', async () => {
        const mockResponse = {
          data: {
            id: 1,
            session_name: 'Test Session',
            created_at: '2023-01-01T00:00:00Z',
          },
        };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await sessions.createSession('Test Session', '2023-01-01T00:00:00Z');

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/sessions', {
          session_name: 'Test Session',
          first_message_time: '2023-01-01T00:00:00Z',
        });
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('getSessions', () => {
      it('should get all user sessions', async () => {
        const mockResponse = {
          data: {
            sessions: [],
          },
        };
        mockAxiosInstance.get.mockResolvedValue(mockResponse);

        const result = await sessions.getSessions();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/chat/sessions');
        expect(result).toEqual(mockResponse.data);
      });
    });
  });

  describe('Profile API', () => {
    describe('getCurrentUser', () => {
      it('should get current user successfully', async () => {
        const mockResponse = {
          data: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
          },
        };
        mockAxiosInstance.get.mockResolvedValue(mockResponse);

        const result = await profile.getCurrentUser();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/profile/me');
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('saveProfile', () => {
      it('should save profile data successfully', async () => {
        const profileData = {
          first_name: 'John',
          last_name: 'Doe',
          bio: 'Software Developer',
        };
        const mockResponse = {
          data: {
            ...profileData,
            id: 1,
          },
        };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await profile.saveProfile(profileData);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/profile/profile', profileData);
        expect(result).toEqual(mockResponse.data);
      });
    });
  });
});