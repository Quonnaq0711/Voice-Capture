/**
 * Work Agent API Service
 *
 * Provides API methods for the Work Agent backend including:
 * - Todo CRUD operations
 * - AI chat functionality
 * - Health check
 */
import axios from 'axios';

// Get the Work Agent API URL based on environment
const getWorkApiUrl = () => {
  // Always use relative path to leverage the proxy in setupProxy.js
  // This ensures requests work correctly in remote dev environments (browser -> frontend server -> proxy -> backend)
  // instead of browser -> localhost:6004 (which fails remotely)
  return '/api/work';
};

const WORK_API_URL = getWorkApiUrl();

// Create axios instance for Work Agent
const workApi = axios.create({
  baseURL: WORK_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
workApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Consume a Server-Sent Events (SSE) stream from a fetch Response.
 * Handles line ending normalization and event parsing.
 * 
 * @param {Response} response - Fetch API Response object
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onToken - Called for each token event
 * @param {Function} callbacks.onComplete - Called when stream completes
 * @param {Function} callbacks.onError - Called on error
 */
async function consumeSSEStream(response, { onToken, onComplete, onError, onToolCall, onToolResult }) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processEvents = (text, flush = false) => {
    // Normalize line endings (\r\n, \r -> \n)
    const normalized = text.replace(/\r\n?/g, '\n');
    const parts = normalized.split('\n\n');
    const remaining = flush ? '' : (parts.pop() || '');

    for (const part of parts) {
      if (!part.trim()) continue;
      const match = part.match(/^data:\s*(.+)$/m);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          switch (data.type) {
            case 'token':
              onToken?.(data.content);
              break;
            case 'complete':
              onComplete?.(data.content);
              break;
            case 'error':
              onError?.(data.content);
              break;
            case 'tool_call':
              onToolCall?.({ name: data.name, args: data.args });
              break;
            case 'tool_result':
              onToolResult?.({ name: data.name, preview: data.preview });
              break;
            case 'tool_error':
              onToolCall?.({ name: 'fallback', error: data.content });
              break;
          }
        } catch (e) {
          // Silently ignore parse errors for malformed events
        }
      }
    }
    return remaining;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        buffer = processEvents(buffer);
      }
      if (done) {
        if (buffer.trim()) {
          processEvents(buffer + '\n\n', true);
        }
        break;
      }
    }
  } catch (error) {
    // Abort is user-initiated cancellation — not an error (mirrors PA pattern)
    if (error.name === 'AbortError') return;
    onError?.(error.message);
  }
}

// ==================== Todo API ====================

export const todos = {
  /**
   * Get all todos for user with optional filters
   */
  getAll: async (userId, options = {}) => {
    const { status, priority, date, sort, limit = 50 } = options;
    const params = new URLSearchParams();

    if (userId) params.append('user_id', String(userId));
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);
    if (date) params.append('date', date);
    if (sort) params.append('sort', sort);
    if (limit) params.append('limit', String(limit));

    const url = `/todos${params.toString() ? '?' + params.toString() : ''}`;
    const response = await workApi.get(url);
    return response.data;
  },

  /**
   * Get a single todo by ID
   */
  getById: async (todoId, userId) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await workApi.get(`/todos/${todoId}${params}`);
    return response.data;
  },

  /**
   * Create a new todo
   */
  create: async (todoData, userId) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await workApi.post(`/todos${params}`, todoData);
    return response.data;
  },

  /**
   * Update an existing todo
   */
  update: async (todoId, todoData, userId) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await workApi.put(`/todos/${todoId}${params}`, todoData);
    return response.data;
  },

  /**
   * Delete a todo
   */
  delete: async (todoId, userId) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await workApi.delete(`/todos/${todoId}${params}`);
    return response.data;
  },

  /**
   * Mark a todo as completed
   */
  complete: async (todoId, userId) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await workApi.post(`/todos/${todoId}/complete${params}`);
    return response.data;
  },

  /**
   * Generate LLM-powered description bullets for a todo.
   * Results are persisted to DB — subsequent calls return cached data instantly.
   * @param {number} todoId - Todo ID
   * @param {number} userId - User ID
   * @param {boolean} force - Force regeneration (ignore cached summary)
   * @returns {Promise<{success: boolean, todo_id: number, bullets: string[], from_cache: boolean}>}
   */
  describe: async (todoId, userId = 1, force = false) => {
    const params = new URLSearchParams({ user_id: userId });
    if (force) params.append('force', 'true');
    const response = await workApi.post(`/todos/${todoId}/describe?${params.toString()}`);
    return response.data;
  },

  // ---- Comments ----
  getComments: async (todoId, userId) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await workApi.get(`/todos/${todoId}/comments${params}`);
    return response.data;
  },
  addComment: async (todoId, content, userId) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await workApi.post(`/todos/${todoId}/comments${params}`, { content });
    return response.data;
  },
  deleteComment: async (todoId, commentId, userId) => {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await workApi.delete(`/todos/${todoId}/comments/${commentId}${params}`);
    return response.data;
  },

  // ---- Attachments ----
  uploadAttachment: async (todoId, userId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await workApi.post(
      `/todos/${todoId}/attachments?user_id=${userId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },
  getAttachments: async (todoId, userId) => {
    const response = await workApi.get(`/todos/${todoId}/attachments?user_id=${userId}`);
    return response.data;
  },
  deleteAttachment: async (todoId, attachmentId, userId) => {
    const response = await workApi.delete(`/todos/${todoId}/attachments/${attachmentId}?user_id=${userId}`);
    return response.data;
  },

  /**
   * Generate a structured task from a natural-language description using AI.
   * Uses SSE streaming (generating → complete).
   * @param {string} description - User's natural-language task description
   * @param {string} currentStatus - Current board column status
   * @param {Function} onComplete - Called with parsed task JSON on success
   * @param {Function} onError - Called with error message on failure
   */
  generateFromAI: async (description, currentStatus, onComplete, onError) => {
    try {
      const response = await fetch(`${WORK_API_URL}/tasks/generate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ description, current_status: currentStatus })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await consumeSSEStream(response, {
        onToken: () => {},
        onComplete: (content) => onComplete?.(content),
        onError: (err) => onError?.(err),
      });
    } catch (error) {
      onError?.(error.message);
    }
  },
};

// ==================== Task Extraction API ====================

export const taskExtraction = {
  /**
   * Get sync status for task extraction (database-first check)
   * Use this BEFORE calling extract() to check if cached data exists
   * @param {number} userId - User ID
   * @returns {Promise<{user_id, last_extraction_at, total_cached_tasks, pending_tasks, processed_sources, needs_extraction}>}
   */
  getSyncStatus: async (userId = 1) => {
    const response = await workApi.get(`/tasks/sync-status?user_id=${userId}`);
    return response.data;
  },

  /**
   * Extract tasks from emails using LLM
   * Supports incremental extraction - only processes new sources after first call
   *
   * Implements 2-stage pipeline:
   * - Stage 1: Rule-based pre-filtering (blacklist domains, patterns)
   * - Stage 2: LLM extraction (only high-potential emails)
   *
   * @param {Object} options - Extraction options
   * @param {string[]} options.sources - Sources to extract from: ['email']
   * @param {string} options.emailStartDate - Start date for emails (YYYY-MM-DD)
   * @param {string} options.emailEndDate - End date for emails (YYYY-MM-DD)
   * @param {string[]} options.emailAccountIds - Specific email account IDs to extract from (null = all)
   * @param {number} options.maxEmails - Max emails to analyze (default: 50)
   * @param {number} userId - User ID
   */
  extract: async (options = {}, userId = 1) => {
    const params = new URLSearchParams({ user_id: userId });
    const body = {
      sources: options.sources || ['email'],
      max_emails: options.maxEmails || 50,
    };
    // Add date range if provided
    if (options.emailStartDate) body.email_start_date = options.emailStartDate;
    if (options.emailEndDate) body.email_end_date = options.emailEndDate;
    // Add account filtering if provided (null = all accounts)
    if (options.emailAccountIds) body.email_account_ids = options.emailAccountIds;

    const response = await workApi.post(`/tasks/extract?${params.toString()}`, body);
    return response.data;
  },

  /**
   * Check background extraction status
   * @param {number} userId - User ID
   * @returns {Promise<{status: string, progress: string, new_tasks_count: number}>}
   */
  getExtractionStatus: async (userId = 1) => {
    const response = await workApi.get(`/tasks/extract/status?user_id=${userId}`);
    return response.data;
  },

  /**
   * Get pending extracted tasks with pagination
   * @param {number} userId - User ID
   * @param {Object} options - Filter and pagination options
   * @param {string} options.startDate - Start date filter (YYYY-MM-DD)
   * @param {string} options.endDate - End date filter (YYYY-MM-DD)
   * @param {number} options.page - Page number (1-indexed, default: 1)
   * @param {number} options.pageSize - Items per page (default: 10, max: 100)
   * @returns {Promise<{items: Array, total: number, page: number, page_size: number, total_pages: number, has_next: boolean, has_prev: boolean}>}
   */
  getExtracted: async (userId = 1, options = {}) => {
    const params = new URLSearchParams({ user_id: userId });
    if (options.startDate) params.append('start_date', options.startDate);
    if (options.endDate) params.append('end_date', options.endDate);
    if (options.page) params.append('page', options.page);
    if (options.pageSize) params.append('page_size', options.pageSize);
    const response = await workApi.get(`/tasks/extracted?${params.toString()}`);
    return response.data;
  },

  /**
   * Add an extracted task to todos (convert to permanent task)
   */
  addToTodos: async (taskId, userId = 1) => {
    const response = await workApi.post(`/tasks/extracted/${taskId}/add?user_id=${userId}`);
    return response.data;
  },

  /**
   * Revert an added extracted task: delete the Todo and restore to Triage
   */
  revert: async (todoId, userId = 1) => {
    const response = await workApi.post(`/tasks/extracted/revert/${todoId}?user_id=${userId}`);
    return response.data;
  },

  /**
   * Dismiss an extracted task (won't show again)
   */
  dismiss: async (taskId, userId = 1) => {
    const response = await workApi.post(`/tasks/extracted/${taskId}/dismiss?user_id=${userId}`);
    return response.data;
  },

  /**
   * Generate LLM-powered description bullets for an extracted task.
   * Results are persisted to DB — subsequent calls return cached data instantly.
   * @param {number} taskId - Extracted task ID
   * @param {number} userId - User ID
   * @param {boolean} force - Force regeneration (ignore cached summary)
   * @returns {Promise<{success: boolean, task_id: number, bullets: string[], from_cache: boolean}>}
   */
  describe: async (taskId, userId = 1, force = false) => {
    const params = new URLSearchParams({ user_id: userId });
    if (force) params.append('force', 'true');
    const response = await workApi.post(`/tasks/extracted/${taskId}/describe?${params.toString()}`);
    return response.data;
  },

  /**
   * Convert extracted task to todo format for creating
   * @param {Object} extractedTask - Task from extraction API
   */
  toTodoCreate: (extractedTask) => ({
    title: extractedTask.title,
    description: extractedTask.description ||
      `Source: ${extractedTask.source_type} - ${extractedTask.source_subject || 'N/A'}`,
    due_date: extractedTask.due_date,
    priority: extractedTask.priority || 'medium',
    category: extractedTask.source_type,
  }),
};

// ==================== Chat API ====================

export const chat = {
  /**
   * Send a message to the Work Assistant
   */
  sendMessage: async (message, sessionId = null) => {
    const response = await workApi.post('/chat/message', {
      message,
      session_id: sessionId,
    });
    return response.data;
  },

  /**
   * Stream a message response from the Work Assistant
   */
  streamMessage: async (message, onChunk, onDone, onError) => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ message });
    const url = `${WORK_API_URL}/chat/message/stream?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              const data = JSON.parse(jsonStr);
              onChunk(data);
            } catch (e) {
              // Ignore parse errors
            }
          } else if (line.startsWith('event: done')) {
            onDone();
          } else if (line.startsWith('event: error')) {
            onError(new Error('Stream error'));
          }
        }
      }

      onDone();
    } catch (error) {
      onError(error);
    }
  },
};

// ==================== Health API ====================

export const health = {
  /**
   * Check Work Agent health status
   */
  check: async () => {
    try {
      const response = await workApi.get('/health');
      return { healthy: true, ...response.data };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  },
};

// ==================== OAuth API ====================

export const oauth = {
  /**
   * Get Google OAuth authorization URL
   * Returns the URL to redirect user to for OAuth consent
   * @param {number} userId - User ID initiating OAuth
   */
  getGoogleAuthUrl: async (userId) => {
    const response = await workApi.get(`/oauth/google/authorize?user_id=${userId}`);
    return response.data;
  },

  /**
   * Get all connected OAuth accounts for the user
   * @param {number} userId - User ID
   */
  getAccounts: async (userId) => {
    const response = await workApi.get(`/oauth/accounts?user_id=${userId}`);
    return response.data;
  },

  /**
   * Disconnect (revoke) an OAuth account
   * @param {number} accountId - OAuth account ID to disconnect
   * @param {number} userId - User ID (for authorization)
   */
  disconnectAccount: async (accountId, userId) => {
    const response = await workApi.delete(`/oauth/accounts/${accountId}?user_id=${userId}`);
    return response.data;
  },

  /**
   * Handle OAuth callback - exchange code for tokens
   * This is typically done server-side via redirect, but can be called
   * if frontend needs to manually process the callback
   */
  handleCallback: async (provider, code, state) => {
    const params = new URLSearchParams({ code, state });
    const response = await workApi.get(`/oauth/${provider}/callback?${params.toString()}`);
    return response.data;
  },
};

// ==================== Gmail API ====================

export const gmail = {
  /**
   * Get Gmail messages with optional filters and pagination
   * @param {number} userId - User ID (required)
   * @param {Object} options - Filter options
   * @param {string} options.accountId - Specific account ID (optional, fetches from all if not specified)
   * @param {number} options.maxResults - Maximum messages to return (default: 20)
   * @param {string} options.query - Gmail search query (e.g., "is:unread", "from:someone@example.com")
   * @param {string} options.labelIds - Comma-separated label IDs (e.g., "INBOX,UNREAD")
   * @param {string} options.pageToken - Pagination token from previous response (single account)
   * @param {Object} options.accountPageTokens - Object mapping account_id to page_token (multi-account)
   * @param {boolean} options.includePagination - If true, returns {messages, nextPageToken, accountPageTokens, hasMore}
   */
  getMessages: async (userId, options = {}) => {
    const { accountId, maxResults = 20, query, labelIds, pageToken, accountPageTokens, includePagination = false } = options;
    const params = new URLSearchParams();

    params.append('user_id', String(userId));
    if (accountId) params.append('account_id', accountId);
    if (maxResults) params.append('max_results', String(maxResults));
    if (query) params.append('query', query);
    if (labelIds) params.append('label_ids', labelIds);
    if (pageToken) params.append('page_token', pageToken);
    // Multi-account pagination: send account page tokens as JSON
    if (accountPageTokens && Object.keys(accountPageTokens).length > 0) {
      params.append('page_tokens', JSON.stringify(accountPageTokens));
    }

    const url = `/gmail/messages?${params.toString()}`;
    const response = await workApi.get(url);

    // If pagination info requested, return full response
    if (includePagination) {
      return {
        messages: response.data.messages || [],
        nextPageToken: response.data.nextPageToken || null,
        accountPageTokens: response.data.accountPageTokens || null,
        hasMore: response.data.hasMore || false,
        total: response.data.total || 0,
        accounts: response.data.accounts || [],
      };
    }

    // Default: just return messages array for backward compatibility
    return response.data.messages || [];
  },

  /**
   * Mark a Gmail message as read
   * @param {string} messageId - Gmail message ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  markAsRead: async (messageId, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.post(`/gmail/messages/${messageId}/read?${params.toString()}`);
    return response.data;
  },

  /**
   * Archive a Gmail message (remove from inbox)
   * @param {string} messageId - Gmail message ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  archiveMessage: async (messageId, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.post(`/gmail/messages/${messageId}/archive?${params.toString()}`);
    return response.data;
  },

  /**
   * Get unread message count
   * @param {number} userId - User ID
   * @param {number} accountId - OAuth account ID (optional)
   */
  getUnreadCount: async (userId, accountId) => {
    try {
      const messages = await gmail.getMessages(userId, {
        accountId,
        query: 'is:unread',
        maxResults: 100,
      });
      return messages.length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  },

  /**
   * Get a single message by ID
   * @param {string} messageId - Gmail message ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  getMessage: async (messageId, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.get(`/gmail/messages/${messageId}?${params.toString()}`);
    return response.data;
  },

  /**
   * Get attachment data by ID
   * @param {string} messageId - Gmail message ID
   * @param {string} attachmentId - Attachment ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  getAttachment: async (messageId, attachmentId, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.get(`/gmail/messages/${messageId}/attachments/${attachmentId}?${params.toString()}`);
    return response.data;
  },

  /**
   * Download an attachment and trigger browser download
   * @param {string} messageId - Gmail message ID
   * @param {Object} attachment - Attachment object with attachment_id, name, mime_type
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - True if download succeeded
   */
  downloadAttachment: async (messageId, attachment, accountId, userId) => {
    try {
      // If attachment already has data (inline images), use it directly
      let base64Data = attachment.data;

      // Otherwise, fetch the attachment data from API
      if (!base64Data && attachment.attachment_id) {
        const response = await gmail.getAttachment(messageId, attachment.attachment_id, accountId, userId);
        if (!response || !response.data) {
          throw new Error('Failed to fetch attachment data');
        }
        base64Data = response.data;
      }

      if (!base64Data) {
        throw new Error('No attachment data available');
      }

      // Convert base64 to Blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: attachment.mime_type || 'application/octet-stream' });

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name || 'attachment';
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Error downloading attachment:', error);
      throw error;
    }
  },

  /**
   * Star or unstar a message
   * @param {string} messageId - Gmail message ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   * @param {boolean} star - True to star, false to unstar
   */
  starMessage: async (messageId, accountId, userId, star = true) => {
    const params = new URLSearchParams({
      account_id: accountId,
      user_id: userId,
      star: star.toString()
    });
    const response = await workApi.post(`/gmail/messages/${messageId}/star?${params.toString()}`);
    return response.data;
  },

  /**
   * Move a message to trash
   * @param {string} messageId - Gmail message ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  trashMessage: async (messageId, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.post(`/gmail/messages/${messageId}/trash?${params.toString()}`);
    return response.data;
  },

  /**
   * Restore a message from trash
   * @param {string} messageId - Gmail message ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  untrashMessage: async (messageId, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.post(`/gmail/messages/${messageId}/untrash?${params.toString()}`);
    return response.data;
  },

  /**
   * Permanently delete a message (cannot be undone)
   * @param {string} messageId - Gmail message ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  deleteMessagePermanently: async (messageId, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.delete(`/gmail/messages/${messageId}?${params.toString()}`);
    return response.data;
  },

  /**
   * Send a new email
   * @param {Object} emailData - Email data
   * @param {string} emailData.to - Recipient(s)
   * @param {string} emailData.subject - Subject
   * @param {string} emailData.body - Body content
   * @param {string[]} emailData.cc - CC recipients (optional)
   * @param {string[]} emailData.bcc - BCC recipients (optional)
   * @param {boolean} emailData.html - Is body HTML (optional)
   * @param {string} emailData.replyToMessageId - For replies (optional)
   * @param {string} emailData.threadId - Thread to add to (optional)
   * @param {Array} emailData.attachments - List of attachments (optional)
   *   Each attachment should have: { filename, mime_type, data (base64) }
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  sendEmail: async (emailData, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.post(`/gmail/messages/send?${params.toString()}`, {
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.body,
      cc: emailData.cc,
      bcc: emailData.bcc,
      html: emailData.html || false,
      reply_to_message_id: emailData.replyToMessageId,
      thread_id: emailData.threadId,
      attachments: emailData.attachments || null,
    });
    return response.data;
  },

  // ==================== Draft Operations ====================

  /**
   * Get all drafts
   * @param {number} userId - User ID
   * @param {Object} options - Options
   */
  getDrafts: async (userId, options = {}) => {
    const { accountId, maxResults = 20 } = options;
    const params = new URLSearchParams();
    params.append('user_id', String(userId));
    if (accountId) params.append('account_id', accountId);
    if (maxResults) params.append('max_results', String(maxResults));

    const response = await workApi.get(`/gmail/drafts?${params.toString()}`);
    return response.data.drafts || [];
  },

  /**
   * Create a new draft
   * @param {Object} draftData - Draft data
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  createDraft: async (draftData, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.post(`/gmail/drafts?${params.toString()}`, {
      to: draftData.to || '',
      subject: draftData.subject || '',
      body: draftData.body || '',
      cc: draftData.cc,
      bcc: draftData.bcc,
      thread_id: draftData.threadId,
      reply_to_message_id: draftData.replyToMessageId,
    });
    return response.data;
  },

  /**
   * Update an existing draft
   * @param {string} draftId - Draft ID
   * @param {Object} draftData - Updated draft data
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  updateDraft: async (draftId, draftData, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.put(`/gmail/drafts/${draftId}?${params.toString()}`, {
      to: draftData.to || '',
      subject: draftData.subject || '',
      body: draftData.body || '',
      cc: draftData.cc,
      bcc: draftData.bcc,
      thread_id: draftData.threadId,
      reply_to_message_id: draftData.replyToMessageId,
    });
    return response.data;
  },

  /**
   * Delete a draft
   * @param {string} draftId - Draft ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  deleteDraft: async (draftId, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.delete(`/gmail/drafts/${draftId}?${params.toString()}`);
    return response.data;
  },

  /**
   * Send an existing draft
   * @param {string} draftId - Draft ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   */
  sendDraft: async (draftId, accountId, userId) => {
    const params = new URLSearchParams({ account_id: accountId, user_id: userId });
    const response = await workApi.post(`/gmail/drafts/${draftId}/send?${params.toString()}`);
    return response.data;
  },
};

// ==================== Calendar API ====================

export const calendar = {
  /**
   * Get all calendars for the user
   * @param {number} userId - User ID
   * @param {number} accountId - OAuth account ID (optional)
   */
  getCalendars: async (userId, accountId) => {
    const params = new URLSearchParams();
    params.append('user_id', String(userId));
    if (accountId) params.append('account_id', String(accountId));

    const response = await workApi.get(`/calendar/calendars?${params.toString()}`);
    return response.data.calendars || [];
  },

  /**
   * Get calendar events with optional filters
   * @param {number} userId - User ID
   * @param {Object} options - Filter options
   * @param {number} options.accountId - Specific account ID (optional)
   * @param {string} options.calendarId - Calendar ID (default: 'primary')
   * @param {string} options.timeMin - Start time in ISO format
   * @param {string} options.timeMax - End time in ISO format
   * @param {number} options.maxResults - Maximum events to return (default: 50)
   * @param {boolean} options.singleEvents - Expand recurring events (default: true)
   * @param {string} options.orderBy - Order by 'startTime' or 'updated'
   */
  getEvents: async (userId, options = {}) => {
    const {
      accountId,
      calendarId = 'primary',
      timeMin,
      timeMax,
      maxResults = 50,
      singleEvents = true,
      orderBy = 'startTime',
    } = options;

    const params = new URLSearchParams();
    params.append('user_id', String(userId));
    if (accountId) params.append('account_id', String(accountId));
    if (calendarId) params.append('calendar_id', calendarId);
    if (timeMin) params.append('time_min', timeMin);
    if (timeMax) params.append('time_max', timeMax);
    if (maxResults) params.append('max_results', String(maxResults));
    params.append('single_events', String(singleEvents));
    if (orderBy) params.append('order_by', orderBy);

    const response = await workApi.get(`/calendar/events?${params.toString()}`);
    // Return full response to allow caller to check for account errors
    return {
      events: response.data.events || [],
      accounts: response.data.accounts || [],
      total: response.data.total || 0,
    };
  },

  /**
   * Get a single calendar event by ID
   * @param {string} eventId - Calendar event ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   * @param {string} calendarId - Calendar ID (default: 'primary')
   */
  getEvent: async (eventId, accountId, userId, calendarId = 'primary') => {
    const params = new URLSearchParams({
      account_id: String(accountId),
      user_id: String(userId),
      calendar_id: calendarId,
    });
    const response = await workApi.get(`/calendar/events/${eventId}?${params.toString()}`);
    return response.data;
  },

  /**
   * Create a new calendar event
   * @param {Object} eventData - Event data
   * @param {string} eventData.summary - Event title
   * @param {string} eventData.description - Event description (optional)
   * @param {string} eventData.location - Event location (optional)
   * @param {string} eventData.start - Start time in ISO format
   * @param {string} eventData.end - End time in ISO format
   * @param {boolean} eventData.allDay - Is all-day event (optional)
   * @param {string[]} eventData.attendees - List of attendee emails (optional)
   * @param {Object} eventData.reminders - Reminder settings (optional)
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   * @param {string} calendarId - Calendar ID (default: 'primary')
   */
  createEvent: async (eventData, accountId, userId, calendarId = 'primary') => {
    const params = new URLSearchParams({
      account_id: String(accountId),
      user_id: String(userId),
      calendar_id: calendarId,
    });
    const response = await workApi.post(`/calendar/events?${params.toString()}`, eventData);
    return response.data;
  },

  /**
   * Update an existing calendar event
   * @param {string} eventId - Calendar event ID
   * @param {Object} eventData - Updated event data
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   * @param {string} calendarId - Calendar ID (default: 'primary')
   */
  updateEvent: async (eventId, eventData, accountId, userId, calendarId = 'primary') => {
    const params = new URLSearchParams({
      account_id: String(accountId),
      user_id: String(userId),
      calendar_id: calendarId,
    });
    const response = await workApi.put(`/calendar/events/${eventId}?${params.toString()}`, eventData);
    return response.data;
  },

  /**
   * Delete a calendar event
   * @param {string} eventId - Calendar event ID
   * @param {number} accountId - OAuth account ID
   * @param {number} userId - User ID
   * @param {string} calendarId - Calendar ID (default: 'primary')
   */
  deleteEvent: async (eventId, accountId, userId, calendarId = 'primary') => {
    const params = new URLSearchParams({
      account_id: String(accountId),
      user_id: String(userId),
      calendar_id: calendarId,
    });
    const response = await workApi.delete(`/calendar/events/${eventId}?${params.toString()}`);
    return response.data;
  },

  /**
   * Get today's events
   * @param {number} userId - User ID
   * @param {number} accountId - OAuth account ID (optional)
   */
  getTodayEvents: async (userId, accountId) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return calendar.getEvents(userId, {
      accountId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
    });
  },

  /**
   * Get this week's events
   * @param {number} userId - User ID
   * @param {number} accountId - OAuth account ID (optional)
   */
  getWeekEvents: async (userId, accountId) => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return calendar.getEvents(userId, {
      accountId,
      timeMin: startOfWeek.toISOString(),
      timeMax: endOfWeek.toISOString(),
    });
  },

  /**
   * Get upcoming events (next 7 days)
   * @param {number} userId - User ID
   * @param {number} accountId - OAuth account ID (optional)
   * @param {number} days - Number of days ahead (default: 7)
   */
  getUpcomingEvents: async (userId, accountId, days = 7) => {
    const now = new Date();
    const future = new Date(now);
    future.setDate(now.getDate() + days);

    return calendar.getEvents(userId, {
      accountId,
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
    });
  },

  /**
   * Get AI-powered meeting preparation materials
   * @param {number} userId - User ID
   * @param {Object} event - Calendar event object
   * @param {number} accountId - OAuth account ID
   * @returns {Promise<Object>} Meeting prep data with AI insights
   */
  getMeetingPrep: async (userId, event, accountId) => {
    const response = await workApi.post(`/calendar/meeting-prep?user_id=${userId}`, {
      event_id: event.id,
      summary: event.summary || '(No title)',
      description: event.description || null,
      attendees: (event.attendees || []).map(a => a.email).filter(Boolean),
      start: event.start,
      end: event.end,
      account_id: accountId,
    });
    return response.data;
  },

  /**
   * Get AI-powered calendar analytics
   * @param {number} userId - User ID
   * @param {Object} options - Analytics options
   * @param {number} options.days - Analysis period in days (7-90, default: 30)
   * @param {number} options.accountId - Specific account ID (optional, all accounts if not specified)
   * @returns {Promise<Object>} Analytics data with:
   *   - period: Date range and work days count
   *   - summary: Total meetings, hours, focus time
   *   - meeting_vs_focus: Percentage breakdown
   *   - top_partners: Most frequent meeting attendees
   *   - daily_trends: Day-by-day meeting density
   *   - health_score: Work rhythm health score (0-100)
   *   - recommendations: AI-generated productivity recommendations
   */
  getCalendarAnalytics: async (userId, options = {}) => {
    const { days = 30, accountId } = options;
    const params = new URLSearchParams();
    params.append('user_id', String(userId));

    const requestBody = { days };
    if (accountId) requestBody.account_id = accountId;

    const response = await workApi.post(`/calendar/analytics?${params.toString()}`, requestBody);
    return response.data;
  },
};

// ==================== Sources (Unified Interface) ====================

export const sources = {
  /**
   * Get all connected sources with their status
   */
  getConnected: async (userId) => {
    try {
      const accounts = await oauth.getAccounts(userId);
      return accounts.map(account => ({
        id: account.id,
        type: account.provider,
        name: account.account_name || account.account_email,
        email: account.account_email,
        connected: true,
        connectedAt: account.created_at,
        // is_valid comes from backend now (not expired AND not revoked)
        status: account.is_valid ? 'active' : (account.is_revoked ? 'revoked' : 'expired'),
        isRevoked: account.is_revoked || false,
        revokedReason: account.revoked_reason || null,
      }));
    } catch (error) {
      console.error('Error fetching connected sources:', error);
      return [];
    }
  },

  /**
   * Connect a new source
   * @param {string} sourceType - Type of source ('gmail', 'outlook', 'calendar', etc.)
   * @returns {Promise<{authUrl: string}>} - Authorization URL to redirect to
   */
  connect: async (sourceType) => {
    switch (sourceType.toLowerCase()) {
      case 'gmail':
      case 'google':
        return oauth.getGoogleAuthUrl();
      case 'outlook':
      case 'microsoft':
        // Future: Microsoft OAuth
        throw new Error('Outlook integration coming soon');
      case 'slack':
        // Future: Slack OAuth
        throw new Error('Slack integration coming soon');
      default:
        throw new Error(`Unknown source type: ${sourceType}`);
    }
  },

  /**
   * Disconnect a source
   */
  disconnect: async (sourceId) => {
    return oauth.disconnectAccount(sourceId);
  },
};

// ==================== Email AI API ====================

export const emailAI = {
  /**
   * Summarize an email using AI
   * Returns summary, key points, and sentiment
   * @param {Object} options - Email data
   * @param {string} options.content - Email body content
   * @param {string} options.sender - Sender name/email (optional)
   * @param {string} options.subject - Email subject (optional)
   */
  summarize: async ({ content, sender, subject }) => {
    const response = await workApi.post('/email/analyze/summarize', {
      content,
      sender,
      subject,
    });
    return response.data;
  },

  /**
   * Summarize an email using AI with streaming response
   * Calls callbacks for each token and for completion
   * @param {Object} options - Email data
   * @param {string} options.content - Email body content
   * @param {string} options.sender - Sender name/email (optional)
   * @param {string} options.subject - Email subject (optional)
   * @param {function} onToken - Callback for each token received
   * @param {function} onComplete - Callback when analysis is complete with parsed result
   * @param {function} onError - Callback for errors
   * @returns {Promise<void>}
   */
  summarizeStream: ({ content, sender, subject }, onToken, onComplete, onError) => {
    const token = localStorage.getItem('token');
    if (!token) {
      if (onError) onError('Not authenticated. Please log in.');
      return null;
    }

    // Build URL with query parameters (EventSource only supports GET)
    const url = new URL(`${window.location.origin}${WORK_API_URL}/email/analyze/summarize/stream`);
    url.searchParams.append('content', content);
    if (sender) url.searchParams.append('sender', sender);
    if (subject) url.searchParams.append('subject', subject);

    // Use EventSource for true browser-native SSE streaming (same as personal assistant chat)
    const eventSource = new EventSource(url.toString());

    // Track connection state for better error handling
    let connectionOpened = false;
    let connectionTimeout = null;
    const CONNECTION_TIMEOUT_MS = 60000; // 60 second timeout for email analysis

    // Helper function to properly cleanup and close EventSource
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

    // Handle incoming messages
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'token':
            if (onToken) onToken(data.content);
            break;
          case 'complete':
            if (onComplete) onComplete({
              summary: data.summary,
              key_points: data.key_points,
              sentiment: data.sentiment,
            });
            cleanupAndClose();
            break;
          case 'error':
            if (onError) onError(data.content);
            cleanupAndClose();
            break;
          default:
            console.debug('[Email AI Stream] Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('[Email AI Stream] Error parsing SSE data:', error);
        if (onError) onError('Error parsing response data');
        cleanupAndClose();
      }
    });

    // Handle connection errors
    eventSource.onerror = (error) => {
      console.error('[Email AI Stream] SSE connection error:', error);

      let errorMessage;
      if (!connectionOpened) {
        errorMessage = 'Unable to connect. Please check your authentication and try again.';
      } else if (eventSource.readyState === EventSource.CLOSED) {
        errorMessage = 'Connection lost. The server closed the connection unexpectedly.';
      } else {
        errorMessage = 'Connection error. Please check your network and try again.';
      }

      if (onError) onError(errorMessage);
      cleanupAndClose();
    };

    // Handle connection open
    eventSource.onopen = () => {
      connectionOpened = true;
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      console.debug('[Email AI Stream] SSE connection established');
    };

    return eventSource;
  },

  /**
   * Translate an email using AI with streaming response
   * @param {Object} options - Translation options
   * @param {string} options.content - Email body content
   * @param {string} options.targetLanguage - Target language code
   * @param {string} options.subject - Email subject
   * @param {function} onToken - Callback for tokens
   * @param {function} onComplete - Callback for completion
   * @param {function} onError - Callback for errors
   */
  translateStream: ({ content, targetLanguage, subject }, onToken, onComplete, onError) => {
    const token = localStorage.getItem('token');
    if (!token) {
      if (onError) onError('Not authenticated. Please log in.');
      return null;
    }

    const url = new URL(`${window.location.origin}${WORK_API_URL}/email/analyze/translate/stream`);
    url.searchParams.append('content', content);
    url.searchParams.append('target_language', targetLanguage);
    if (subject) url.searchParams.append('subject', subject);

    const eventSource = new EventSource(url.toString());

    let connectionOpened = false;
    let connectionTimeout = null;
    const CONNECTION_TIMEOUT_MS = 60000;

    const cleanupAndClose = () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      eventSource.close();
    };

    connectionTimeout = setTimeout(() => {
      if (!connectionOpened) {
        cleanupAndClose();
        if (onError) onError('Connection timeout. The server took too long to respond.');
      }
    }, CONNECTION_TIMEOUT_MS);

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'token':
            if (onToken) onToken(data.content);
            break;
          case 'complete':
            if (onComplete) onComplete({
              translated_content: data.translated_content,
              translated_subject: data.translated_subject,
              detected_language: data.detected_language,
              target_language: data.target_language,
            });
            cleanupAndClose();
            break;
          case 'error':
            if (onError) onError(data.content);
            cleanupAndClose();
            break;
        }
      } catch (error) {
        console.error('[Email AI Stream] Error parsing SSE data:', error);
        if (onError) onError('Error parsing response data');
        cleanupAndClose();
      }
    });

    eventSource.onerror = (error) => {
      console.error('[Email AI Stream] SSE connection error:', error);
      let errorMessage;
      if (!connectionOpened) {
        errorMessage = 'Unable to connect. Please check your authentication and try again.';
      } else if (eventSource.readyState === EventSource.CLOSED) {
        errorMessage = 'Connection lost. The server closed the connection unexpectedly.';
      } else {
        errorMessage = 'Connection error. Please check your network and try again.';
      }
      if (onError) onError(errorMessage);
      cleanupAndClose();
    };

    eventSource.onopen = () => {
      connectionOpened = true;
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      console.debug('[Email AI Stream] SSE connection established');
    };

    return eventSource;
  },

  /**
   * Draft an email based on instructions with streaming response
   * @param {string} instructions - Instructions for drafting
   * @param {string} context - Original email context (optional)
   * @param {string} senderName - Sender name (optional)
   * @param {string} recipientName - Recipient name (optional)
   * @param {function} onToken - Callback for tokens
   * @param {function} onComplete - Callback for completion
   * @param {function} onError - Callback for errors
   */
  draftStream: async (instructions, context, senderName, recipientName, onToken, onComplete, onError) => {
    const token = localStorage.getItem('token');
    if (!token) {
      onError?.('Not authenticated. Please log in.');
      return;
    }

    try {
      const response = await fetch(`${WORK_API_URL}/email/draft/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          instructions,
          context,
          sender_name: senderName,
          recipient_name: recipientName,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await consumeSSEStream(response, { onToken, onComplete, onError });
    } catch (error) {
      onError?.(error.message);
    }
  },

  /**
   * Translate an email using AI
   * @param {Object} options - Translation options
   * @param {string} options.content - Email body content
   * @param {string} options.targetLanguage - Target language code (e.g., 'zh', 'es', 'fr')
   * @param {string} options.subject - Email subject (optional, will be translated too)
   */
  translate: async ({ content, targetLanguage, subject }) => {
    const response = await workApi.post('/email/analyze/translate', {
      content,
      target_language: targetLanguage,
      subject,
    });
    return response.data;
  },

  /**
   * Get generated subject lines for a reply
   * @param {string} content - Original email content
   * @param {string} originalSubject - Original email subject line
   * @param {string} intent - Response intent (e.g., 'Response', 'Request', 'Follow-up')
   * @param {string} tone - Response tone (e.g., 'professional', 'friendly')
   * @param {number} count - Number of subjects to generate
   */
  getReplySubjects: async (content, originalSubject = '', intent = 'Response', tone = 'professional', count = 3) => {
    const response = await workApi.post('/email/analyze/subjects', {
      content,
      original_subject: originalSubject,
      intent,
      tone,
      count,
    });
    return response.data.subjects;
  },

  /**
   * Polish an email draft
   * @param {string} content - Draft content to polish
   * @param {string} tone - Desired tone
   * @param {string} type - Instruction type
   * @param {function} onToken
   * @param {function} onComplete
   * @param {function} onError
   */
  polishStream: async (content, tone, type, onToken, onComplete, onError) => {
    const token = localStorage.getItem('token');
    if (!token) {
      onError?.('Not authenticated. Please log in.');
      return;
    }

    try {
      const response = await fetch(`${WORK_API_URL}/email/draft/polish/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          content,
          tone,
          instruction: type,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await consumeSSEStream(response, { onToken, onComplete, onError });
    } catch (error) {
      onError?.(error.message);
    }
  },
  /**
   * Get list of supported languages for translation
   */
  getSupportedLanguages: async () => {
    const response = await workApi.get('/email/analyze/languages');
    return response.data.languages;
  },
};


// ==================== AI Task Prioritization API ====================

export const taskPrioritization = {
  /**
   * Analyze tasks with AI and get prioritization recommendations
   * @param {Object} options - Prioritization options
   * @param {number} options.userId - User ID
   * @param {number[]} options.taskIds - Specific task IDs to analyze (null = all pending)
   * @param {boolean} options.includeTriage - Include extracted/triage tasks (default: false)
   * @param {Object} options.context - Work preferences
   * @param {number} options.context.workHoursPerDay - Hours per day (default: 8)
   * @param {string[]} options.context.workDays - Work days (default: ['mon', 'tue', 'wed', 'thu', 'fri'])
   * @param {string} options.context.preferredStartTime - Start time (default: '09:00')
   * @param {string} options.context.scheduleStartDate - Schedule start date (YYYY-MM-DD)
   * @param {number} options.context.scheduleDays - Days to schedule (default: 7)
   * @returns {Promise<Object>} Prioritization results with tasks, schedule, warnings, summary
   */
  analyze: async ({ userId, taskIds, includeTriage = false, context = {}, mode = 'auto' }) => {
    const requestBody = {
      user_id: userId,
      task_ids: taskIds || null,
      include_triage: includeTriage,
      mode,
      context: context ? {
        work_hours_per_day: context.workHoursPerDay || 8,
        work_days: context.workDays || ['mon', 'tue', 'wed', 'thu', 'fri'],
        preferred_start_time: context.preferredStartTime || '09:00',
        schedule_start_date: context.scheduleStartDate || null,
        schedule_days: context.scheduleDays || 7,
      } : null,
    };

    const response = await workApi.post('/tasks/prioritize', requestBody);
    return response.data;
  },

  /**
   * Apply AI-suggested priorities to tasks
   * @param {number} userId - User ID
   * @param {Array} updates - List of priority updates
   * @param {number} updates[].taskId - Task ID
   * @param {string} updates[].taskType - Task type ('todo' or 'extracted')
   * @param {string} updates[].priority - New priority ('urgent', 'high', 'medium', 'low')
   * @param {number} updates[].estimatedMinutes - AI-estimated duration (optional)
   * @returns {Promise<Object>} Result with success status and updated count
   */
  applyPriorities: async (userId, updates) => {
    const requestBody = {
      user_id: userId,
      updates: updates.map(u => ({
        task_id: u.taskId,
        task_type: u.taskType || 'todo',
        priority: u.priority,
        estimated_minutes: u.estimatedMinutes || null,
      })),
    };

    const response = await workApi.post('/tasks/apply-priorities', requestBody);
    return response.data;
  },

  /**
   * Save manual task reorder from drag-and-drop
   * @param {number} userId - User ID
   * @param {Array} order - List of { taskId, suggestedOrder }
   * @returns {Promise<Object>} Result with success status
   */
  saveReorder: async (userId, order) => {
    const response = await workApi.post('/todos/reorder', {
      user_id: userId,
      order: order.map(o => ({
        task_id: o.taskId,
        suggested_order: o.suggestedOrder,
      })),
    });
    return response.data;
  },
};


// ==================== AI Task Scheduler API ====================

export const taskScheduler = {
  /**
   * Preview — generate proposed schedule slots WITHOUT creating calendar events.
   * Returns slots for user review/editing before confirmation.
   *
   * @param {Object} options
   * @param {number} options.userId - User ID
   * @param {number[]} options.taskIds - Specific task IDs (null = all pending)
   * @param {number} options.accountId - OAuth account ID for Google Calendar
   * @param {string} options.scheduleStartDate - Start date (YYYY-MM-DD)
   * @param {number} options.scheduleDays - Days to schedule across (default: 7)
   * @param {string} options.preferredStartTime - Work start time (default: '09:00')
   * @param {string} options.preferredEndTime - Work end time (default: '17:00')
   * @param {string[]} options.workDays - Working days (default: weekdays)
   * @returns {Promise<Object>} { success, scheduled_slots, skipped_tasks, warnings }
   */
  preview: async ({ userId, taskIds, accountId, scheduleStartDate, scheduleDays, preferredStartTime, preferredEndTime, workDays, schedulerInstructions }) => {
    const response = await workApi.post('/tasks/schedule', {
      user_id: userId,
      task_ids: taskIds || null,
      account_id: accountId,
      schedule_start_date: scheduleStartDate || null,
      schedule_days: scheduleDays || 7,
      preferred_start_time: preferredStartTime || '09:00',
      preferred_end_time: preferredEndTime || '17:00',
      work_days: workDays || ['mon', 'tue', 'wed', 'thu', 'fri'],
      user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      scheduling_instructions: schedulerInstructions || null,
    });
    return response.data;
  },

  /**
   * Accept — save schedule slots locally (DB only, no Google Calendar).
   *
   * @param {Object} options
   * @param {number} options.userId - User ID
   * @param {Array} options.slots - Array of ScheduleSlot objects
   * @returns {Promise<Object>} { success, accepted_count, warnings }
   */
  accept: async ({ userId, slots }) => {
    const response = await workApi.post('/tasks/schedule/accept', {
      user_id: userId,
      slots,
      user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return response.data;
  },

  /**
   * Push accepted tasks to Google Calendar.
   *
   * @param {Object} options
   * @param {number} options.userId - User ID
   * @param {number} options.accountId - OAuth account ID for Google Calendar
   * @param {number[]} options.taskIds - Task IDs to push to Google Calendar
   * @returns {Promise<Object>} { success, scheduled_events, skipped_tasks, warnings }
   */
  pushToCalendar: async ({ userId, accountId, taskIds }) => {
    const response = await workApi.post('/tasks/schedule/confirm', {
      user_id: userId,
      account_id: accountId,
      task_ids: taskIds,
      user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return response.data;
  },

  /**
   * Get locally-scheduled tasks for calendar display.
   *
   * @param {number} userId - User ID
   * @returns {Promise<Object>} { scheduled_events: Array<ScheduledTaskEvent> }
   */
  getScheduledEvents: async (userId) => {
    const response = await workApi.get(`/tasks/scheduled-events?user_id=${userId}`);
    return response.data;
  },

  /**
   * Unaccept — clear local scheduling for a task (reset is_scheduled to false).
   *
   * @param {Object} options
   * @param {number} options.userId - User ID
   * @param {number} options.taskId - Task ID to unschedule locally
   * @returns {Promise<Object>} { status, message }
   */
  unaccept: async ({ userId, taskId }) => {
    const response = await workApi.post('/tasks/schedule/unaccept', {
      user_id: userId,
      task_id: taskId,
    });
    return response.data;
  },

  /**
   * Remove an AI-scheduled event from Google Calendar and reset the task as unscheduled.
   *
   * @param {Object} options
   * @param {number} options.userId - User ID
   * @param {number} options.accountId - OAuth account ID
   * @param {string} options.calendarEventId - Google Calendar event ID to delete
   * @param {number} options.taskId - Task ID to reset
   * @returns {Promise<Object>} { status, message }
   */
  remove: async ({ userId, accountId, calendarEventId, taskId }) => {
    const response = await workApi.post('/tasks/schedule/remove', {
      user_id: userId,
      account_id: accountId,
      calendar_event_id: calendarEventId,
      task_id: taskId,
    });
    return response.data;
  },
};


// ==================== AI Task Solver API ====================

export const taskSolver = {
  /**
   * Stream an AI solver chat response for a task.
   * Uses POST + fetch streaming (not EventSource) to send conversation history in body.
   *
   * @param {Object} params
   * @param {number} params.taskId - Task ID
   * @param {number} params.userId - User ID
   * @param {string} params.message - User message
   * @param {Array} params.conversationHistory - Previous messages [{role, content}]
   * @param {string} params.quickAction - Quick action key (optional)
   * @param {Function} onToken - Called with each token string
   * @param {Function} onComplete - Called with full response on completion
   * @param {Function} onError - Called with error message
   * @returns {AbortController} - Call .abort() to cancel the stream
   */
  chatStream: (
    { taskId, userId = 1, message, conversationHistory = [], quickAction, sessionId },
    onToken,
    onComplete,
    onError,
    onToolCall,
    onToolResult
  ) => {
    const abortController = new AbortController();

    (async () => {
      try {
        const params = new URLSearchParams({ user_id: userId });
        const response = await fetch(
          `${WORK_API_URL}/tasks/${taskId}/ai-solver/chat?${params.toString()}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
              'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
              message: message || '',
              conversation_history: conversationHistory.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              quick_action: quickAction || null,
              session_id: sessionId || null,
            }),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        await consumeSSEStream(response, { onToken, onComplete, onError, onToolCall, onToolResult });
      } catch (error) {
        if (error.name === 'AbortError') {
          // Cancelled by user — not an error
          return;
        }
        onError?.(error.message);
      }
    })();

    return abortController;
  },
};


// ==================== Solver Sessions API ====================

export const solverSessions = {
  list: async (taskId, userId, search = '') => {
    const params = new URLSearchParams({ user_id: userId });
    if (search) params.append('search', search);
    const response = await workApi.get(`/tasks/${taskId}/solver/sessions?${params.toString()}`);
    return response.data;
  },

  create: async (taskId, userId, title = null) => {
    const params = new URLSearchParams({ user_id: userId });
    const response = await workApi.post(
      `/tasks/${taskId}/solver/sessions?${params.toString()}`,
      title ? { title } : {}
    );
    return response.data;
  },

  get: async (taskId, sessionId, userId) => {
    const response = await workApi.get(
      `/tasks/${taskId}/solver/sessions/${sessionId}?user_id=${userId}`
    );
    return response.data;
  },

  delete: async (taskId, sessionId, userId) => {
    const response = await workApi.delete(
      `/tasks/${taskId}/solver/sessions/${sessionId}?user_id=${userId}`
    );
    return response.data;
  },

  rename: async (taskId, sessionId, userId, title) => {
    const response = await workApi.patch(
      `/tasks/${taskId}/solver/sessions/${sessionId}?user_id=${userId}`,
      { title }
    );
    return response.data;
  },

  deleteMessagesFromIndex: async (taskId, sessionId, userId, messageIndex) => {
    const response = await workApi.delete(
      `/tasks/${taskId}/solver/sessions/${sessionId}/messages/from/${messageIndex}?user_id=${userId}`
    );
    return response.data;
  },
};


// ==================== NoteBook Tool APIs ====================

/**
 * Notebooks API - Manage notebook folders
 */
export const notebooks = {
  /**
   * Get all notebooks for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} List of notebooks
   */
  getAll: async (userId) => {
    return workApi.get(`/notebook/notebooks?user_id=${userId}`);
  },

  /**
   * Create a new notebook
   * @param {Object} data - Notebook data (title, description, color, icon)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Created notebook
   */
  create: async (data, userId) => {
    return workApi.post(`/notebook/notebooks?user_id=${userId}`, data);
  },

  /**
   * Get a specific notebook
   * @param {number} notebookId - Notebook ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Notebook details
   */
  get: async (notebookId, userId) => {
    return workApi.get(`/notebook/notebooks/${notebookId}?user_id=${userId}`);
  },

  /**
   * Update a notebook
   * @param {number} notebookId - Notebook ID
   * @param {Object} data - Update data
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated notebook
   */
  update: async (notebookId, data, userId) => {
    return workApi.put(`/notebook/notebooks/${notebookId}?user_id=${userId}`, data);
  },

  /**
   * Delete a notebook
   * @param {number} notebookId - Notebook ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Deletion result
   */
  delete: async (notebookId, userId) => {
    return workApi.delete(`/notebook/notebooks/${notebookId}?user_id=${userId}`);
  },

  /**
   * Get notebook statistics (all notes count, archived count, etc.)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Stats object with all_notes, archived, trashed counts
   */
  getStats: async (userId) => {
    return workApi.get(`/notebook/stats?user_id=${userId}`);
  },
};

/**
 * Notes API - Manage notes
 */
export const notes = {
  /**
   * Get notes for a user with optional filtering
   * @param {number} userId - User ID
   * @param {Object} options - Filter options (notebook_id, search, archived, trashed)
   * @returns {Promise<Object>} List of notes
   */
  getAll: async (userId, options = {}) => {
    const params = new URLSearchParams({ user_id: userId });
    if (options.notebook_id) params.append('notebook_id', options.notebook_id);
    if (options.search) params.append('search', options.search);
    if (options.archived !== undefined) params.append('archived', options.archived);
    if (options.trashed !== undefined) params.append('trashed', options.trashed);
    return workApi.get(`/notebook/notes?${params.toString()}`);
  },

  /**
   * Create a new note
   * @param {Object} data - Note data (title, content, notebook_id, template_id)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Created note
   */
  create: async (data, userId) => {
    return workApi.post(`/notebook/notes?user_id=${userId}`, data);
  },

  /**
   * Get a specific note
   * @param {number} noteId - Note ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Note details with content
   */
  get: async (noteId, userId) => {
    return workApi.get(`/notebook/notes/${noteId}?user_id=${userId}`);
  },

  /**
   * Update a note
   * @param {number} noteId - Note ID
   * @param {Object} data - Update data (title, content, notebook_id, is_pinned, is_archived)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated note
   */
  update: async (noteId, data, userId) => {
    return workApi.put(`/notebook/notes/${noteId}?user_id=${userId}`, data);
  },

  /**
   * Delete a note
   * @param {number} noteId - Note ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Deletion result
   */
  delete: async (noteId, userId) => {
    return workApi.delete(`/notebook/notes/${noteId}?user_id=${userId}`);
  },

  /**
   * Toggle pin status of a note
   * @param {number} noteId - Note ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated note
   */
  togglePin: async (noteId, userId) => {
    return workApi.post(`/notebook/notes/${noteId}/pin?user_id=${userId}`);
  },

  /**
   * Toggle archive status of a note
   * @param {number} noteId - Note ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated note
   */
  toggleArchive: async (noteId, userId) => {
    return workApi.post(`/notebook/notes/${noteId}/archive?user_id=${userId}`);
  },

  /**
   * Move a note to trash (soft delete)
   * @param {number} noteId - Note ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated note
   */
  moveToTrash: async (noteId, userId) => {
    return workApi.post(`/notebook/notes/${noteId}/trash?user_id=${userId}`);
  },

  /**
   * Restore a note from trash
   * @param {number} noteId - Note ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Restored note
   */
  restore: async (noteId, userId) => {
    return workApi.post(`/notebook/notes/${noteId}/restore?user_id=${userId}`);
  },

  /**
   * Permanently delete a note from trash
   * @param {number} noteId - Note ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Deletion result
   */
  permanentDelete: async (noteId, userId) => {
    return workApi.delete(`/notebook/notes/${noteId}/permanent?user_id=${userId}`);
  },

  /**
   * Empty trash - permanently delete all trashed notes
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Deletion result with count
   */
  emptyTrash: async (userId) => {
    return workApi.delete(`/notebook/trash/empty?user_id=${userId}`);
  },
};

/**
 * Note Templates API - Get pre-built note templates
 */
export const noteTemplates = {
  /**
   * Get all available templates
   * @returns {Promise<Object>} List of templates
   */
  getAll: async () => {
    return workApi.get('/notebook/templates');
  },

  /**
   * Get a specific template with content
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Template with content
   */
  get: async (templateId) => {
    return workApi.get(`/notebook/templates/${templateId}`);
  },
};

export default {
  todos,
  taskExtraction,
  chat,
  health,
  oauth,
  gmail,
  calendar,
  sources,
  emailAI,
  taskPrioritization,
  notebooks,
  notes,
  noteTemplates,
};
