import * as chatApi from '../src/services/chatApi';

// Mock fetch globally
global.fetch = jest.fn();

describe('chatApi Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  describe('sendMessage', () => {
    it('should send message and return response', async () => {
      const mockResponse = {
        response: 'Hello! How can I help you?',
        session_id: 'test-session-123',
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await chatApi.sendMessage('Hello', 'session-123');

      expect(fetch).toHaveBeenCalledWith('/api/pa/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello',
          session_id: 'session-123',
        }),
        signal: null,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should trim whitespace from message', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: 'OK' }),
      });

      await chatApi.sendMessage('  Hello world  ', null);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            message: 'Hello world',
            session_id: null,
          }),
        })
      );
    });

    it('should handle HTTP errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Server error' }),
      });

      await expect(chatApi.sendMessage('Hello')).rejects.toThrow('Server error');
    });

    it('should handle abort signal', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      fetch.mockRejectedValueOnce(abortError);

      await expect(chatApi.sendMessage('Hello')).rejects.toThrow('Request cancelled');
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(chatApi.sendMessage('Hello')).rejects.toThrow('Network error');
    });

    it('should use custom API URL when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: 'OK' }),
      });

      await chatApi.sendMessage('Hello', null, null, '/custom/api');

      expect(fetch).toHaveBeenCalledWith('/custom/api', expect.any(Object));
    });
  });

  describe('checkHealth', () => {
    it('should check health and return status', async () => {
      const mockHealth = { status: 'healthy', version: '1.0.0' };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealth),
      });

      const result = await chatApi.checkHealth();

      expect(fetch).toHaveBeenCalledWith('/api/pa/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(mockHealth);
    });

    it('should use custom API URL when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      await chatApi.checkHealth('/api/career');

      expect(fetch).toHaveBeenCalledWith('/api/career/health', expect.any(Object));
    });

    it('should handle unhealthy API', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      await expect(chatApi.checkHealth()).rejects.toThrow('HTTP error! status: 503');
    });
  });

  describe('clearMemory', () => {
    it('should clear memory without session ID', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Memory cleared' }),
      });

      const result = await chatApi.clearMemory();

      expect(fetch).toHaveBeenCalledWith('/api/pa/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual({ message: 'Memory cleared' });
    });

    it('should clear memory with session ID', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Memory cleared' }),
      });

      await chatApi.clearMemory('session-123');

      expect(fetch).toHaveBeenCalledWith(
        '/api/pa/memory?session_id=session-123',
        expect.any(Object)
      );
    });
  });

  describe('generateSessionId', () => {
    beforeEach(() => {
      // Mock crypto.getRandomValues for test environment
      const mockGetRandomValues = jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      });

      Object.defineProperty(global, 'crypto', {
        value: { getRandomValues: mockGetRandomValues },
        writable: true,
        configurable: true,
      });
    });

    it('should generate unique session IDs', () => {
      const id1 = chatApi.generateSessionId();
      const id2 = chatApi.generateSessionId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate ID with correct format', () => {
      const id = chatApi.generateSessionId();
      // Format: session_{timestamp}_{hex}
      expect(id).toMatch(/^session_\d+_[a-f0-9]+$/);
    });
  });
});
